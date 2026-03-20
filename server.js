require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const SERVER_START_TIME = Date.now();

// ── In-memory rate limiter ────────────────────────────────────────────────────
const rateLimitBuckets = new Map(); // key: `${ip}:${bucket}` → { count, resetAt }

function rateLimit(bucket, maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${bucket}`;
    const now = Date.now();

    let entry = rateLimitBuckets.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitBuckets.set(key, entry);
    }

    entry.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' });
    }
    next();
  };
}

// Periodically clean up expired rate-limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitBuckets) {
    if (now > entry.resetAt) rateLimitBuckets.delete(key);
  }
}, 5 * 60 * 1000);

// ── CORS — allow localhost, Vercel URL, and production frontend ───────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Username, X-Sample-Rate, X-Bit-Depth, X-Channels, Stripe-Signature');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Request logging middleware ─────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${req.method} ${req.path} ${status} ${duration}ms`);
  });
  next();
});

// Apply general rate limiting (100 req/min) to all routes
app.use(rateLimit('general', 100, 60 * 1000));

app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AUDD_API_TOKEN = process.env.AUDD_API_TOKEN || '';

// In-memory Vinyl Buddy state (simple local-dev backend).
const MAX_VB_SESSIONS = 1000;
const vinylSessions = [];
const devicesById = new Map();
const calibrationByDevice = new Map();
const pairedDevices = new Map(); // deviceId -> { username, pairedAt }
let lastIdentifyDebug = null;
const DEFAULT_TRACK_LENGTH_SEC = 240;
const CAPTURE_COUNT_MIN_GAP_MS = 120000;
const VB_FIRMWARE_CURRENT = '2.1.0';

function _parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function _normalizeYear(value) {
  const y = Number.parseInt(value, 10);
  return Number.isFinite(y) ? y : 0;
}

function _normalizeTrackKey(track) {
  const title = String(track?.title || '').trim().toLowerCase();
  const artist = String(track?.artist || '').trim().toLowerCase();
  return `${artist}::${title}`;
}

function _extractCanonicalTrackId(track) {
  const isrc = String(track?.isrc || '').trim();
  if (isrc) return `isrc:${isrc}`;

  const spotifyId = String(track?.spotify?.id || '').trim();
  if (spotifyId) return `spotify:${spotifyId}`;

  const deezerId = String(track?.deezer?.id || '').trim();
  if (deezerId) return `deezer:${deezerId}`;

  const appleId = String(track?.apple_music?.id || '').trim();
  if (appleId) return `apple:${appleId}`;

  return '';
}

function _extractTrackLengthSec(track) {
  const spotifyMs = Number(track?.spotify?.duration_ms);
  if (Number.isFinite(spotifyMs) && spotifyMs > 0) {
    return Math.round(spotifyMs / 1000);
  }

  const appleMs = Number(track?.apple_music?.durationInMillis);
  if (Number.isFinite(appleMs) && appleMs > 0) {
    return Math.round(appleMs / 1000);
  }

  const deezerSec = Number(track?.deezer?.duration);
  if (Number.isFinite(deezerSec) && deezerSec > 0) {
    return Math.round(deezerSec);
  }

  return DEFAULT_TRACK_LENGTH_SEC;
}

function _buildWavFromPcm16(pcmBuffer, sampleRate, channels) {
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20);  // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function _identifyTrackWithAudd(wavBuffer) {
  if (!AUDD_API_TOKEN) return null;

  const form = new FormData();
  form.append('api_token', AUDD_API_TOKEN);
  form.append('return', 'apple_music,spotify,deezer');
  form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'vinyl-buddy.wav');

  const resp = await fetch('https://api.audd.io/', {
    method: 'POST',
    body: form,
  });

  if (!resp.ok) {
    throw new Error(`AudD HTTP ${resp.status}`);
  }

  const data = await resp.json();
  if (data?.status !== 'success' || !data?.result) return null;

  const track = data.result;
  let year = 0;
  if (track.release_date) {
    year = _normalizeYear(String(track.release_date).slice(0, 4));
  }

  const confidence = Number.isFinite(track?.score)
    ? Math.round(Math.max(0, Math.min(100, Number(track.score) * 100)))
    : 0;

  return {
    title: track.title || 'Unknown',
    artist: track.artist || 'Unknown',
    album: track.album || '',
    year,
    score: confidence,
    lengthSec: _extractTrackLengthSec(track),
    canonicalTrackId: _extractCanonicalTrackId(track),
  };
}

function _setLastIdentifyDebug(data) {
  lastIdentifyDebug = {
    ...data,
    at: new Date().toISOString(),
  };
}

function _upsertDeviceHeartbeat({ deviceId, username, uptime, freeHeap }) {
  const nowIso = new Date().toISOString();
  const prev = devicesById.get(deviceId);

  const next = {
    deviceId,
    username,
    firstSeen: prev?.firstSeen || nowIso,
    lastSeen: nowIso,
    totalHeartbeats: (prev?.totalHeartbeats || 0) + 1,
    uptime: Number.isFinite(uptime) ? uptime : (prev?.uptime || 0),
    freeHeap: Number.isFinite(freeHeap) ? freeHeap : (prev?.freeHeap || 0),
  };

  devicesById.set(deviceId, next);
  return next;
}

function _storeVinylSession(session) {
  vinylSessions.unshift(session);
  if (vinylSessions.length > MAX_VB_SESSIONS) {
    vinylSessions.length = MAX_VB_SESSIONS;
  }
}

const VERIFY_PROMPT = `You are the AI verification system for Groovestack, a vinyl record collector community. Your sole job is to verify that a collector is showing you an actual physical vinyl record before they add it to their collection — this keeps listings authentic and sellers accountable.

Examine the image carefully. Grant verification (verified: true) if the image clearly shows:
- A vinyl record disc (the round, grooved plastic object — LP, EP, 45, 78, etc.)
- A record sleeve or album cover held up or placed flat, with the disc visible or clearly implied by the packaging
- A record label (center label on the disc itself)

Deny verification (verified: false) if the image shows:
- No vinyl record whatsoever
- Screenshots, digital images of album art on a screen
- Just hands or a room with no record visible
- Food, pets, people, or unrelated objects

Be encouraging but firm. Collectors must show real vinyl. Respond with ONLY valid JSON — no markdown, no code fences, no extra text:
{"verified": true/false, "message": "One warm, on-brand sentence. If verified, celebrate the find. If not, kindly explain what you need to see."}`;

app.post('/api/verify-vinyl', async (req, res) => {
  const { imageBase64, mediaType = 'image/jpeg' } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          { type: 'text', text: VERIFY_PROMPT }
        ]
      }]
    });

    const raw = response.content[0].text.trim();
    // Strip any accidental markdown fences just in case
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleaned);
    return res.json(result);

  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Claude returned non-JSON:', err.message);
      return res.json({
        verified: false,
        message: "Couldn't read that photo clearly — try again with better lighting and the record in full view."
      });
    }
    console.error('Verification error:', err.message);
    return res.status(500).json({ error: 'Verification service unavailable. Check your API key.' });
  }
});

// ── Vinyl Buddy: heartbeat from ESP32 ─────────────────────────────────────
app.post('/api/vinyl-buddy/heartbeat', (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = String(body.device_id || body.deviceId || '').trim();
    const username = String(body.username || '').trim();

    if (!deviceId || !username) {
      return res.status(400).json({ error: 'device_id and username are required.' });
    }

    const uptime = Number(body.uptime);
    const freeHeap = Number(body.heap ?? body.freeHeap);
    const device = _upsertDeviceHeartbeat({ deviceId, username, uptime, freeHeap });

    // Persist device info to database
    if (pool) {
      pool.query(
        `INSERT INTO vinyl_devices (device_id, username, heartbeats, uptime_sec, free_heap)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (device_id) DO UPDATE SET
           last_seen = now(),
           heartbeats = vinyl_devices.heartbeats + 1,
           uptime_sec = $3,
           free_heap = $4`,
        [deviceId, username, uptime || 0, freeHeap || 0]
      ).catch(err => console.error('Device persist error:', err.message));
    }

    return res.json({ success: true, device });
  } catch (err) {
    console.error('[vinyl-buddy] heartbeat error:', err.message);
    return res.status(500).json({ error: 'Failed to process heartbeat.' });
  }
});

// ── Vinyl Buddy: identify track from raw PCM stream ───────────────────────
app.post('/api/vinyl-buddy/identify', express.raw({ type: 'application/octet-stream', limit: '4mb' }), async (req, res) => {
  try {
    const pcm = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!pcm.length) {
      _setLastIdentifyDebug({
        success: false,
        reason: 'empty_payload',
        bytes: 0,
      });
      return res.status(400).json({ success: false, error: 'Empty audio payload.' });
    }

    const username = String(req.get('X-Username') || 'unknown').trim();
    const deviceId = String(req.get('X-Device-Id') || 'unknown-device').trim();
    const sampleRate = _parsePositiveInt(req.get('X-Sample-Rate'), 16000);
    const channels = _parsePositiveInt(req.get('X-Channels'), 1);
    const captureSeconds = Number((pcm.length / (sampleRate * channels * 2)).toFixed(2));

    // Keep device presence fresh even if explicit heartbeat is sparse.
    _upsertDeviceHeartbeat({ deviceId, username, uptime: NaN, freeHeap: NaN });

    let identified = null;
    let score = 0;
    let providerError = null;

    try {
      const wav = _buildWavFromPcm16(pcm, sampleRate, channels);
      identified = await _identifyTrackWithAudd(wav);
      score = identified?.score || 0;
    } catch (identifyErr) {
      providerError = identifyErr.message;
      console.error('[vinyl-buddy] identify provider error:', providerError);
    }

    const found = !!identified;
    const now = Date.now();
    const sessionId = `vb-${now}-${Math.floor(Math.random() * 100000)}`;

    const session = {
      id: sessionId,
      username,
      deviceId,
      track: found
        ? {
            title: identified.title,
            artist: identified.artist,
            album: identified.album,
            year: identified.year,
            canonicalTrackId: identified.canonicalTrackId || '',
          }
        : {
            title: 'Unidentified Track',
            artist: 'Unknown Artist',
            album: '',
            year: 0,
            canonicalTrackId: '',
          },
      score,
      timestamp: new Date(now).toISOString(),
      timestampMs: now,
      captureCount: 1,
      listenedSeconds: captureSeconds,
      trackLengthSec: found ? (identified.lengthSec || DEFAULT_TRACK_LENGTH_SEC) : 0,
      lastCountedCaptureAtMs: now,
    };

    let dedupedIntoExisting = false;
    if (found) {
      const newKey = _normalizeTrackKey(session.track);
      const newCanonical = String(session.track.canonicalTrackId || '').trim();
      const existing = vinylSessions.find((s) => {
        if (s.username !== username || s.deviceId !== deviceId) return false;

        const sCanonical = String(s.track?.canonicalTrackId || '').trim();
        const sameTrack = (newCanonical && sCanonical)
          ? (newCanonical === sCanonical)
          : (_normalizeTrackKey(s.track) === newKey);
        if (!sameTrack) return false;

        const trackLenSec = Number(s.trackLengthSec || identified.lengthSec || DEFAULT_TRACK_LENGTH_SEC);
        const dedupeWindowMs = Math.max(trackLenSec * 1000, 60000);
        return (now - Number(s.timestampMs || 0)) <= dedupeWindowMs;
      });

      if (existing) {
        const lastCountedAt = Number(existing.lastCountedCaptureAtMs || existing.timestampMs || 0);
        if ((now - lastCountedAt) >= CAPTURE_COUNT_MIN_GAP_MS) {
          existing.captureCount = Number(existing.captureCount || 1) + 1;
          existing.lastCountedCaptureAtMs = now;
        }
        existing.listenedSeconds = Number(existing.listenedSeconds || captureSeconds) + captureSeconds;
        existing.timestamp = new Date(now).toISOString();
        existing.timestampMs = now;
        existing.score = Math.max(Number(existing.score || 0), Number(score || 0));
        existing.trackLengthSec = Number(existing.trackLengthSec || identified.lengthSec || DEFAULT_TRACK_LENGTH_SEC);
        dedupedIntoExisting = true;
      }
    }

    // Persist only successful identifications.
    if (found && !dedupedIntoExisting) {
      _storeVinylSession(session);

      // Persist to database
      if (pool) {
        const track = session.track;
        const trackLengthSec = session.trackLengthSec || 0;
        const canonicalId = track.canonicalTrackId || '';
        pool.query(
          `INSERT INTO vinyl_sessions (username, device_id, track_title, track_artist, track_album, track_year, score, track_length_sec, canonical_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [username, deviceId, track.title, track.artist, track.album || '', track.year || '', score, trackLengthSec, canonicalId]
        ).catch(err => console.error('Session persist error:', err.message));
      }
    }

    const activeSession = dedupedIntoExisting
      ? vinylSessions.find((s) => _normalizeTrackKey(s.track) === _normalizeTrackKey(session.track) && s.username === username && s.deviceId === deviceId)
      : session;

    const failureReason = found
      ? null
      : (!AUDD_API_TOKEN
        ? 'no_provider_configured'
        : (providerError ? 'provider_error' : 'no_confident_match'));

    _setLastIdentifyDebug({
      success: found,
      reason: failureReason,
      provider: found ? 'audd' : (AUDD_API_TOKEN ? 'audd_no_match' : 'no_provider_configured'),
      providerError,
      username,
      deviceId,
      bytes: pcm.length,
      sampleRate,
      channels,
      captureSeconds,
      score,
      track: session.track,
      sessionId: activeSession?.id || sessionId,
      dedupedIntoExisting,
    });

    return res.json({
      success: found,
      track: session.track,
      score,
      session_id: activeSession?.id || sessionId,
      deduped: dedupedIntoExisting,
      capture_count: activeSession?.captureCount || 1,
      listened_seconds: activeSession?.listenedSeconds || captureSeconds,
      provider: found ? 'audd' : (AUDD_API_TOKEN ? 'audd_no_match' : 'no_provider_configured'),
      debug_reason: failureReason,
      debug_provider_error: providerError,
      debug_capture_seconds: captureSeconds,
      message: found
        ? 'Track identified.'
        : (AUDD_API_TOKEN
          ? 'No confident match found for this capture.'
          : 'No recognition provider configured. Set AUDD_API_TOKEN to enable identification.'),
    });
  } catch (err) {
    console.error('[vinyl-buddy] identify error:', err.message);
    return res.status(500).json({ success: false, error: 'Identification failed.' });
  }
});

// ── Vinyl Buddy: latest identify diagnostics ──────────────────────────────
app.get('/api/vinyl-buddy/debug/last-identify', (_req, res) => {
  return res.json({
    hasData: !!lastIdentifyDebug,
    lastIdentify: lastIdentifyDebug,
  });
});

// ── Vinyl Buddy: recent sessions for a user ───────────────────────────────
app.get('/api/vinyl-buddy/history/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  const limit = Math.min(_parsePositiveInt(req.query.limit, 50), 200);

  // Try database first, fall back to in-memory
  if (pool) {
    try {
      const dbResult = await pool.query(
        'SELECT * FROM vinyl_sessions WHERE username = $1 ORDER BY timestamp DESC LIMIT $2',
        [username, limit]
      );
      if (dbResult.rows.length > 0) {
        const sessions = dbResult.rows.map(r => ({
          id: r.id,
          username: r.username,
          deviceId: r.device_id,
          track: { title: r.track_title, artist: r.track_artist, album: r.track_album, year: r.track_year },
          score: r.score,
          trackLengthSec: r.track_length_sec,
          captureCount: r.capture_count,
          listenedSeconds: r.listened_seconds,
          canonicalId: r.canonical_id,
          timestamp: r.timestamp,
          timestampMs: new Date(r.timestamp).getTime(),
        }));
        return res.json({ sessions });
      }
    } catch (err) {
      console.error('DB history fetch error:', err.message);
    }
  }
  // Fall through to existing in-memory logic

  const rawSessions = vinylSessions
    .filter((s) => s.username === username)
    .sort((a, b) => b.timestampMs - a.timestampMs);

  // Fold repeated captures of the same track within track-length window so
  // UI history shows a single song entry while listened duration still grows.
  const folded = [];
  for (const s of rawSessions) {
    const sCanonical = String(s.track?.canonicalTrackId || '').trim();
    const sKey = _normalizeTrackKey(s.track);

    const existing = folded.find((f) => {
      if (f.deviceId !== s.deviceId) return false;

      const fCanonical = String(f.track?.canonicalTrackId || '').trim();
      const sameTrack = (sCanonical && fCanonical)
        ? (sCanonical === fCanonical)
        : (_normalizeTrackKey(f.track) === sKey);
      if (!sameTrack) return false;

      const windowMs = Math.max(Number(f.trackLengthSec || DEFAULT_TRACK_LENGTH_SEC) * 1000, 60000);
      return Math.abs(Number(f.timestampMs || 0) - Number(s.timestampMs || 0)) <= windowMs;
    });

    if (!existing) {
      folded.push({ ...s });
      continue;
    }

    existing.captureCount = Number(existing.captureCount || 1) + Number(s.captureCount || 1);
    existing.listenedSeconds = Number(existing.listenedSeconds || 0) + Number(s.listenedSeconds || 0);
    existing.score = Math.max(Number(existing.score || 0), Number(s.score || 0));
    if (Number(s.timestampMs || 0) > Number(existing.timestampMs || 0)) {
      existing.timestamp = s.timestamp;
      existing.timestampMs = s.timestampMs;
    }
  }

  const sessions = folded.slice(0, limit);

  return res.json({ sessions });
});

// ── Vinyl Buddy: devices for a user ────────────────────────────────────────
app.get('/api/vinyl-buddy/devices/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();

  // Try database first, fall back to in-memory
  if (pool) {
    try {
      const dbResult = await pool.query(
        'SELECT * FROM vinyl_devices WHERE username = $1 ORDER BY last_seen DESC',
        [username]
      );
      if (dbResult.rows.length > 0) {
        const devices = dbResult.rows.map(r => ({
          deviceId: r.device_id,
          username: r.username,
          firstSeen: r.first_seen,
          lastSeen: r.last_seen,
          totalHeartbeats: r.heartbeats,
          uptime: r.uptime_sec,
          freeHeap: r.free_heap,
        }));
        return res.json({ devices });
      }
    } catch (err) {
      console.error('DB devices fetch error:', err.message);
    }
  }
  // Fall through to existing in-memory logic

  const devices = Array.from(devicesById.values())
    .filter((d) => d.username === username)
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return res.json({ devices });
});

// ── Vinyl Buddy: store device calibration settings ─────────────────────────
app.post('/api/vinyl-buddy/calibrate', (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = String(body.device_id || body.deviceId || '').trim();
    if (!deviceId) return res.status(400).json({ error: 'device_id is required.' });

    const gain = Number(body.gain);
    const threshold = Number(body.threshold);
    const sampleRate = Number(body.sample_rate || body.sampleRate);

    const settings = {
      deviceId,
      gain: Number.isFinite(gain) && gain >= 0 && gain <= 100 ? gain : 50,
      threshold: Number.isFinite(threshold) && threshold >= 0 && threshold <= 100 ? threshold : 30,
      sampleRate: [8000, 16000, 22050, 44100].includes(sampleRate) ? sampleRate : 16000,
      updatedAt: new Date().toISOString(),
    };

    calibrationByDevice.set(deviceId, settings);
    return res.json({ success: true, calibration: settings });
  } catch (err) {
    console.error('[vinyl-buddy] calibrate error:', err.message);
    return res.status(500).json({ error: 'Failed to store calibration.' });
  }
});

// ── Vinyl Buddy: get calibration settings for a device ─────────────────────
app.get('/api/vinyl-buddy/calibration/:deviceId', (req, res) => {
  const deviceId = String(req.params.deviceId || '').trim();
  const settings = calibrationByDevice.get(deviceId) || {
    deviceId,
    gain: 50,
    threshold: 30,
    sampleRate: 16000,
    updatedAt: null,
  };
  return res.json({ calibration: settings });
});

// ── Vinyl Buddy: check firmware update availability ────────────────────────
app.post('/api/vinyl-buddy/firmware-check', (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = String(body.device_id || body.deviceId || '').trim();
    const currentVersion = String(body.version || body.firmware_version || '').trim();

    if (!deviceId) return res.status(400).json({ error: 'device_id is required.' });

    const updateAvailable = currentVersion && currentVersion !== VB_FIRMWARE_CURRENT;

    return res.json({
      success: true,
      deviceId,
      currentVersion: currentVersion || 'unknown',
      latestVersion: VB_FIRMWARE_CURRENT,
      updateAvailable,
      releaseNotes: updateAvailable
        ? 'Improved audio capture quality, reduced power consumption, and better WiFi reconnection handling.'
        : null,
    });
  } catch (err) {
    console.error('[vinyl-buddy] firmware-check error:', err.message);
    return res.status(500).json({ error: 'Firmware check failed.' });
  }
});

// ── Vinyl Buddy: detailed listening analytics ──────────────────────────────
app.get('/api/vinyl-buddy/stats/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'username is required.' });

  const sessions = vinylSessions.filter(s => s.username === username);

  // Top artists
  const artistCounts = {};
  for (const s of sessions) {
    const a = s.track?.artist || 'Unknown';
    artistCounts[a] = (artistCounts[a] || 0) + 1;
  }
  const topArtists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count }));

  // Genre mapping (same as frontend)
  const genreMap = {
    "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock",
    "The Doors": "Rock", "The Beatles": "Rock", "The Who": "Rock",
    "Eagles": "Rock", "Nirvana": "Grunge", "The Rolling Stones": "Rock",
    "John Coltrane": "Jazz", "Miles Davis": "Jazz", "Charles Mingus": "Jazz",
    "Fleetwood Mac": "Rock", "Daft Punk": "Electronic",
  };
  const genreCounts = {};
  for (const s of sessions) {
    const genre = genreMap[s.track?.artist] || 'Other';
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  }
  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([genre, count]) => ({ genre, count }));

  // Peak listening hours
  const hourCounts = new Array(24).fill(0);
  for (const s of sessions) {
    const hour = new Date(s.timestampMs).getHours();
    hourCounts[hour]++;
  }
  const peakHours = hourCounts
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Total listening time
  const totalSeconds = sessions.reduce((sum, s) => sum + (Number(s.listenedSeconds) || 0), 0);

  return res.json({
    username,
    totalListens: sessions.length,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    uniqueArtists: Object.keys(artistCounts).length,
    uniqueAlbums: new Set(sessions.map(s => `${s.track?.artist}::${s.track?.album}`)).size,
    topArtists,
    topGenres,
    peakHours,
  });
});

// ── Vinyl Buddy: pair device with user account ─────────────────────────────
app.post('/api/vinyl-buddy/pair', (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = String(body.device_id || body.deviceId || '').trim();
    const username = String(body.username || '').trim();

    if (!deviceId || !username) {
      return res.status(400).json({ error: 'device_id and username are required.' });
    }

    // Validate device code format: 12 hex chars
    if (!/^[A-Fa-f0-9]{12}$/.test(deviceId)) {
      return res.status(400).json({ error: 'Invalid device code format. Must be 12 hex characters.' });
    }

    // Check if device is already paired to a different user
    const existing = pairedDevices.get(deviceId);
    if (existing && existing.username !== username) {
      return res.status(409).json({ error: 'Device is already paired to another account.' });
    }

    pairedDevices.set(deviceId, {
      username,
      pairedAt: new Date().toISOString(),
    });

    return res.json({ success: true, deviceId, username, pairedAt: pairedDevices.get(deviceId).pairedAt });
  } catch (err) {
    console.error('[vinyl-buddy] pair error:', err.message);
    return res.status(500).json({ error: 'Failed to pair device.' });
  }
});

// ── Vinyl Buddy: unpair device ─────────────────────────────────────────────
app.delete('/api/vinyl-buddy/unpair/:deviceId', (req, res) => {
  const deviceId = String(req.params.deviceId || '').trim();
  if (!deviceId) return res.status(400).json({ error: 'deviceId is required.' });

  const existing = pairedDevices.get(deviceId);
  if (!existing) {
    return res.status(404).json({ error: 'Device not found or already unpaired.' });
  }

  pairedDevices.delete(deviceId);
  calibrationByDevice.delete(deviceId);

  return res.json({ success: true, deviceId, message: 'Device unpaired successfully.' });
});

// ── Vinyl Buddy: last 5 identified tracks (lightweight widget) ─────────────
app.get('/api/vinyl-buddy/recent/:username', (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return res.status(400).json({ error: 'username is required.' });

  const recent = vinylSessions
    .filter(s => s.username === username)
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, 5)
    .map(s => ({
      id: s.id,
      track: s.track,
      score: s.score,
      timestampMs: s.timestampMs,
      deviceId: s.deviceId,
    }));

  return res.json({ recent });
});

// Health check
// ── Postgres connection (Railway injects DATABASE_URL) ────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false })
  : null;

const JWT_SECRET = process.env.JWT_SECRET || 'groovestack-dev-secret-change-me';

// Initialize profiles table on startup
if (pool) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      bio TEXT DEFAULT '',
      location TEXT DEFAULT '',
      fav_genre TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      header_url TEXT DEFAULT '',
      accent TEXT DEFAULT '#0ea5e9',
      shipping_name TEXT DEFAULT '',
      shipping_street TEXT DEFAULT '',
      shipping_city TEXT DEFAULT '',
      shipping_state TEXT DEFAULT '',
      shipping_zip TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).then(() => {
    console.log('   Profiles table: ready');
    // Add shipping columns if they don't exist (migration for existing DBs)
    return pool.query(`
      DO $$ BEGIN
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_name TEXT DEFAULT '';
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_street TEXT DEFAULT '';
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_city TEXT DEFAULT '';
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_state TEXT DEFAULT '';
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shipping_zip TEXT DEFAULT '';
      END $$;
    `);
  }).then(() => console.log('   Shipping columns: ready'))
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS vinyl_sessions (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        device_id TEXT NOT NULL,
        track_title TEXT NOT NULL,
        track_artist TEXT NOT NULL,
        track_album TEXT DEFAULT '',
        track_year TEXT DEFAULT '',
        score REAL DEFAULT 0,
        track_length_sec INTEGER DEFAULT 0,
        capture_count INTEGER DEFAULT 1,
        listened_seconds REAL DEFAULT 0,
        canonical_id TEXT DEFAULT '',
        timestamp TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_vinyl_sessions_username ON vinyl_sessions(username);
      CREATE INDEX IF NOT EXISTS idx_vinyl_sessions_device ON vinyl_sessions(device_id);

      CREATE TABLE IF NOT EXISTS vinyl_devices (
        device_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        first_seen TIMESTAMPTZ DEFAULT now(),
        last_seen TIMESTAMPTZ DEFAULT now(),
        heartbeats INTEGER DEFAULT 0,
        uptime_sec INTEGER DEFAULT 0,
        free_heap INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_vinyl_devices_username ON vinyl_devices(username);
    `))
    .then(() => console.log('   Vinyl Buddy tables: ready'))
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        album TEXT NOT NULL,
        artist TEXT NOT NULL,
        year TEXT DEFAULT '',
        format TEXT DEFAULT 'LP',
        label TEXT DEFAULT '',
        condition TEXT DEFAULT 'VG+',
        for_sale BOOLEAN DEFAULT false,
        price TEXT DEFAULT '0',
        rating INTEGER DEFAULT 0,
        review TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        accent TEXT DEFAULT '#555',
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_records_user ON records(user_id);
      CREATE INDEX IF NOT EXISTS idx_records_for_sale ON records(for_sale) WHERE for_sale = true;

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        caption TEXT DEFAULT '',
        media_url TEXT DEFAULT '',
        media_type TEXT DEFAULT '',
        tagged_record_id INTEGER REFERENCES records(id),
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        record_id INTEGER,
        post_id INTEGER,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS offers (
        id SERIAL PRIMARY KEY,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        record_id INTEGER,
        type TEXT DEFAULT 'cash',
        price TEXT DEFAULT '0',
        trade_record_id INTEGER,
        status TEXT DEFAULT 'pending',
        album TEXT DEFAULT '',
        artist TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        buyer TEXT NOT NULL,
        seller TEXT NOT NULL,
        record_id INTEGER,
        album TEXT DEFAULT '',
        artist TEXT DEFAULT '',
        price TEXT DEFAULT '0',
        condition TEXT DEFAULT '',
        stripe_session_id TEXT DEFAULT '',
        shipping_name TEXT DEFAULT '',
        shipping_street TEXT DEFAULT '',
        shipping_city TEXT DEFAULT '',
        shipping_state TEXT DEFAULT '',
        shipping_zip TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        text TEXT NOT NULL,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user, to_user);

      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower TEXT NOT NULL,
        following TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(follower, following)
      );
    `))
    .then(() => console.log('   Collection & social tables: ready'))
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS record_likes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, record_id)
      );
      CREATE INDEX IF NOT EXISTS idx_record_likes_record ON record_likes(record_id);

      CREATE TABLE IF NOT EXISTS record_saves (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, record_id)
      );
      CREATE INDEX IF NOT EXISTS idx_record_saves_user ON record_saves(user_id);

      CREATE TABLE IF NOT EXISTS post_likes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, post_id)
      );
      CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(user_id, post_id)
      );
      CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON post_bookmarks(user_id);

      DO $$ BEGIN
        ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
      END $$;
    `))
    .then(() => console.log('   Likes, saves, bookmarks & order status: ready'))
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        related_id INTEGER,
        related_type TEXT DEFAULT '',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

      CREATE TABLE IF NOT EXISTS wishlist (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT DEFAULT '',
        genre TEXT DEFAULT '',
        max_price TEXT DEFAULT '',
        condition_min TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
    `))
    .then(() => console.log('   Notifications & wishlist tables: ready'))
    .catch(err => console.error('   DB init error:', err.message));
}

// JWT auth middleware — attaches req.user = { id, username } if valid token
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function makeToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Auth API routes ──────────────────────────────────────────────────────────

const authRateLimit = rateLimit('auth', 10, 60 * 1000);

// POST /api/auth/signup — create account
app.post('/api/auth/signup', authRateLimit, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { email, password, username, displayName } = req.body;
  if (!email || !password || !username) return res.status(400).json({ error: 'Email, password, and username are required', code: 'MISSING_FIELDS' });
  if (typeof email !== 'string' || typeof password !== 'string' || typeof username !== 'string') return res.status(400).json({ error: 'email, password, and username must be strings', code: 'INVALID_TYPES' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format', code: 'INVALID_EMAIL' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters', code: 'WEAK_PASSWORD' });
  if (username.length < 2 || username.length > 30) return res.status(400).json({ error: 'Username must be 2-30 characters', code: 'INVALID_USERNAME' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return res.status(400).json({ error: 'Username may only contain letters, numbers, underscores, hyphens, and dots', code: 'INVALID_USERNAME_CHARS' });

  try {
    // Check username uniqueness
    const existing = await pool.query('SELECT id FROM profiles WHERE username = $1 OR email = $2', [username.toLowerCase(), email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username or email already taken' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO profiles (email, password_hash, username, display_name) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, bio, location, fav_genre, avatar_url, header_url, accent',
      [email.toLowerCase(), hash, username.toLowerCase(), displayName || username]
    );
    const user = result.rows[0];
    const token = makeToken(user);
    res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, bio: user.bio, location: user.location, favGenre: user.fav_genre, avatarUrl: user.avatar_url, headerUrl: user.header_url, accent: user.accent, shippingName: user.shipping_name || '', shippingStreet: user.shipping_street || '', shippingCity: user.shipping_city || '', shippingState: user.shipping_state || '', shippingZip: user.shipping_zip || '' } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login — sign in
app.post('/api/auth/login', authRateLimit, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required', code: 'MISSING_FIELDS' });
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'email and password must be strings', code: 'INVALID_TYPES' });

  try {
    const result = await pool.query('SELECT * FROM profiles WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = makeToken(user);
    res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, bio: user.bio, location: user.location, favGenre: user.fav_genre, avatarUrl: user.avatar_url, headerUrl: user.header_url, accent: user.accent, shippingName: user.shipping_name || '', shippingStreet: user.shipping_street || '', shippingCity: user.shipping_city || '', shippingState: user.shipping_state || '', shippingZip: user.shipping_zip || '' } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me — get current user profile (requires token)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query('SELECT id, username, display_name, bio, location, fav_genre, avatar_url, header_url, accent, shipping_name, shipping_street, shipping_city, shipping_state, shipping_zip FROM profiles WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const u = result.rows[0];
    res.json({ id: u.id, username: u.username, displayName: u.display_name, bio: u.bio, location: u.location, favGenre: u.fav_genre, avatarUrl: u.avatar_url, headerUrl: u.header_url, accent: u.accent, shippingName: u.shipping_name || '', shippingStreet: u.shipping_street || '', shippingCity: u.shipping_city || '', shippingState: u.shipping_state || '', shippingZip: u.shipping_zip || '' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/profile — update profile (requires token)
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { displayName, bio, location, favGenre, avatarUrl, headerUrl, shippingName, shippingStreet, shippingCity, shippingState, shippingZip } = req.body;
  try {
    await pool.query(
      'UPDATE profiles SET display_name=$1, bio=$2, location=$3, fav_genre=$4, avatar_url=$5, header_url=$6, shipping_name=$7, shipping_street=$8, shipping_city=$9, shipping_state=$10, shipping_zip=$11 WHERE id=$12',
      [displayName || '', bio || '', location || '', favGenre || '', avatarUrl || '', headerUrl || '', shippingName || '', shippingStreet || '', shippingCity || '', shippingState || '', shippingZip || '', req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/username — change username (requires token)
app.put('/api/auth/username', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    const existing = await pool.query('SELECT id FROM profiles WHERE username = $1 AND id != $2', [username.toLowerCase(), req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken' });
    await pool.query('UPDATE profiles SET username=$1 WHERE id=$2', [username.toLowerCase(), req.user.id]);
    res.json({ ok: true, token: jwt.sign({ id: req.user.id, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' }) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/check-username/:username — check if username is available
app.get('/api/auth/check-username/:username', async (req, res) => {
  if (!pool) return res.json({ available: true });
  try {
    const result = await pool.query('SELECT id FROM profiles WHERE username = $1', [req.params.username.toLowerCase()]);
    res.json({ available: result.rows.length === 0 });
  } catch {
    res.json({ available: true });
  }
});

// POST /api/auth/forgot-password — request password reset (placeholder for future email integration)
app.post('/api/auth/forgot-password', authRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required', code: 'MISSING_FIELDS' });
  // Always return success to avoid leaking whether an email exists
  res.json({ ok: true, message: 'If an account with that email exists, a password reset link has been sent.' });
});

// ── Stripe Checkout — platform fee: 5% or $1 min ────────────────────────────

const SHIPPING_FEE_CENTS = 600; // $6.00

function calcPlatformFee(priceCents) {
  return Math.max(Math.round(priceCents * 0.05), 100); // 5% or $1.00 min
}

// POST /api/checkout/create-session — creates a Stripe Checkout Session
app.post('/api/checkout/create-session', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { recordId, album, artist, price, condition, seller, shippingName, shippingStreet, shippingCity, shippingState, shippingZip } = req.body;
  if (!recordId || !price) return res.status(400).json({ error: 'Missing record info' });

  const priceCents = Math.round(parseFloat(price) * 100);
  const feeCents = calcPlatformFee(priceCents);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${album} — ${artist}`, description: `${condition} condition vinyl record` },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Shipping & handling' },
            unit_amount: SHIPPING_FEE_CENTS,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Groovestack transaction fee (5%)' },
            unit_amount: feeCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}?checkout=success&record=${recordId}`,
      cancel_url: `${frontendUrl}?checkout=cancel`,
      metadata: { recordId: String(recordId), seller: seller || '', buyer: req.user.username, platformFeeCents: String(feeCents), shippingName: shippingName || '', shippingAddress: `${shippingStreet || ''}, ${shippingCity || ''}, ${shippingState || ''} ${shippingZip || ''}` },
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// GET /api/checkout/fee?price=XX — preview fee for UI
app.get('/api/checkout/fee', (req, res) => {
  const priceCents = Math.round(parseFloat(req.query.price || 0) * 100);
  const feeCents = calcPlatformFee(priceCents);
  res.json({ fee: (feeCents / 100).toFixed(2), feeCents, shipping: (SHIPPING_FEE_CENTS / 100).toFixed(2) });
});

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'not_configured';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    database: dbStatus,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + ' MB',
    },
    vinylBuddy: {
      sessions: vinylSessions.length,
      devices: devicesById.size,
      identifyProvider: AUDD_API_TOKEN ? 'audd' : 'none',
    },
  });
});

// ── Discogs price lookup ─────────────────────────────────
app.get('/api/prices/lookup', async (req, res) => {
  const { album, artist } = req.query;
  if (!album && !artist) return res.status(400).json({ error: 'album or artist required' });

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const userAgent = 'GrooveStack/1.0 +https://groovestack.vercel.app';

  try {
    // Search Discogs for the release
    const searchUrl = `https://api.discogs.com/database/search?type=release&format=Vinyl&q=${encodeURIComponent(`${artist || ''} ${album || ''}`.trim())}${DISCOGS_TOKEN ? `&token=${DISCOGS_TOKEN}` : ''}`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': userAgent }
    });
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return res.json({ found: false, prices: [] });
    }

    // Get price suggestions for top results (up to 3)
    const topResults = searchData.results.slice(0, 3);
    const prices = [];

    for (const result of topResults) {
      try {
        // Discogs marketplace stats
        const statsUrl = `https://api.discogs.com/marketplace/stats/${result.id}${DISCOGS_TOKEN ? `?token=${DISCOGS_TOKEN}` : ''}`;
        const statsRes = await fetch(statsUrl, {
          headers: { 'User-Agent': userAgent }
        });
        const stats = await statsRes.json();

        prices.push({
          id: result.id,
          title: result.title,
          year: result.year,
          format: result.format?.join(', ') || 'Vinyl',
          country: result.country,
          label: result.label?.join(', ') || '',
          thumbnail: result.thumb,
          lowestPrice: stats.lowest_price?.value || null,
          medianPrice: stats.median?.value || null,
          highestPrice: stats.highest_price?.value || null,
          numForSale: stats.num_for_sale || 0,
          currency: stats.lowest_price?.currency || 'USD',
          discogsUrl: `https://www.discogs.com${result.uri || ''}`,
        });
      } catch {
        // Skip individual price fetch errors
      }
    }

    // Calculate suggested price: lowest found + $10 markup, minimum $15
    const allLowPrices = prices.filter(p => p.lowestPrice).map(p => p.lowestPrice);
    const lowestFound = allLowPrices.length > 0 ? Math.min(...allLowPrices) : null;
    const medianPrices = prices.filter(p => p.medianPrice).map(p => p.medianPrice);
    const medianFound = medianPrices.length > 0 ? medianPrices.reduce((a, b) => a + b, 0) / medianPrices.length : null;

    let suggestedPrice = null;
    if (lowestFound !== null) {
      // $10 above lowest, but if that's way below median, adjust up
      const base = lowestFound + 10;
      if (medianFound && base < medianFound * 0.8) {
        suggestedPrice = Math.round(medianFound * 0.95 * 100) / 100;
      } else {
        suggestedPrice = Math.round(base * 100) / 100;
      }
      suggestedPrice = Math.max(suggestedPrice, 15); // minimum $15
    }

    res.json({
      found: true,
      artist: artist || '',
      album: album || '',
      suggestedPrice,
      lowestFound,
      medianFound: medianFound ? Math.round(medianFound * 100) / 100 : null,
      numListings: prices.reduce((sum, p) => sum + p.numForSale, 0),
      prices,
    });
  } catch (err) {
    console.error('Discogs lookup error:', err.message);
    res.status(500).json({ error: 'Price lookup failed' });
  }
});

// ── Records API ──────────────────────────────────────────────────────────────

// POST /api/records — create a record (requires auth)
app.post('/api/records', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { album, artist, year, format, label, condition, forSale, price, rating, review, tags, accent, verified } = req.body;
  if (!album || !artist) return res.status(400).json({ error: 'Album and artist are required', code: 'MISSING_FIELDS' });
  if (typeof album !== 'string' || typeof artist !== 'string') return res.status(400).json({ error: 'album and artist must be strings', code: 'INVALID_TYPES' });
  if (forSale && (!price || parseFloat(price) <= 0)) return res.status(400).json({ error: 'Price must be positive when listing for sale', code: 'INVALID_PRICE' });
  try {
    const result = await pool.query(
      `INSERT INTO records (user_id, album, artist, year, format, label, condition, for_sale, price, rating, review, tags, accent, verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.username, album, artist, year || '', format || 'LP', label || '', condition || 'VG+', forSale || false, price || '0', rating || 0, review || '', tags || '{}', accent || '#555', verified || false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create record error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/records — list records (optional: ?user=X, ?forSale=true, ?limit=50)
app.get('/api/records', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.query.user) {
      conditions.push(`user_id = $${idx++}`);
      params.push(req.query.user);
    }
    if (req.query.forSale === 'true') {
      conditions.push(`for_sale = true`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const result = await pool.query(
      `SELECT * FROM records ${where} ORDER BY created_at DESC LIMIT $${idx}`,
      [...params, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List records error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/records/:id — update record (requires auth, must be owner)
app.put('/api/records/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const existing = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (existing.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    const { album, artist, year, format, label, condition, forSale, price, rating, review, tags, accent, verified } = req.body;
    const prev = existing.rows[0];
    const result = await pool.query(
      `UPDATE records SET album=$1, artist=$2, year=$3, format=$4, label=$5, condition=$6, for_sale=$7, price=$8, rating=$9, review=$10, tags=$11, accent=$12, verified=$13, updated_at=now() WHERE id=$14 RETURNING *`,
      [album || prev.album, artist || prev.artist, year ?? prev.year, format || prev.format, label ?? prev.label, condition || prev.condition, forSale !== undefined ? forSale : prev.for_sale, price ?? prev.price, rating ?? prev.rating, review ?? prev.review, tags || prev.tags, accent || prev.accent, verified !== undefined ? verified : prev.verified, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update record error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/records/:id — delete record (requires auth, must be owner)
app.delete('/api/records/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const existing = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (existing.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete record error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Posts & Comments API ─────────────────────────────────────────────────────

// POST /api/posts — create a post (requires auth)
app.post('/api/posts', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { caption, mediaUrl, mediaType, taggedRecordId } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, caption, media_url, media_type, tagged_record_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.username, caption || '', mediaUrl || '', mediaType || '', taggedRecordId || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create post error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts — list posts (?limit=50, ?user=X)
app.get('/api/posts', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    if (req.query.user) {
      const result = await pool.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [req.query.user, limit]);
      return res.json(result.rows);
    }
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('List posts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments — add a comment (requires auth)
app.post('/api/comments', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { recordId, postId, text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  if (!recordId && !postId) return res.status(400).json({ error: 'recordId or postId is required' });
  try {
    const result = await pool.query(
      `INSERT INTO comments (record_id, post_id, user_id, text) VALUES ($1,$2,$3,$4) RETURNING *`,
      [recordId || null, postId || null, req.user.username, text]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create comment error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/comments/:recordId — get comments for a record
app.get('/api/comments/:recordId', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query('SELECT * FROM comments WHERE record_id = $1 ORDER BY created_at ASC', [req.params.recordId]);
    res.json(result.rows);
  } catch (err) {
    console.error('List comments error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/comments/post/:postId — get comments for a post
app.get('/api/comments/post/:postId', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query('SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC', [req.params.postId]);
    res.json(result.rows);
  } catch (err) {
    console.error('List post comments error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Offers API ───────────────────────────────────────────────────────────────

// POST /api/offers — create an offer (requires auth)
app.post('/api/offers', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { toUser, recordId, type, price, tradeRecordId, album, artist } = req.body;
  if (!toUser) return res.status(400).json({ error: 'toUser is required', code: 'MISSING_FIELDS' });
  if (typeof toUser !== 'string') return res.status(400).json({ error: 'toUser must be a string', code: 'INVALID_TYPES' });
  if (toUser === req.user.username) return res.status(400).json({ error: 'Cannot make an offer to yourself', code: 'SELF_OFFER' });
  try {
    const result = await pool.query(
      `INSERT INTO offers (from_user, to_user, record_id, type, price, trade_record_id, album, artist) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.username, toUser, recordId || null, type || 'cash', price || '0', tradeRecordId || null, album || '', artist || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create offer error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/offers — list user's offers (requires auth)
app.get('/api/offers', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM offers WHERE from_user = $1 OR to_user = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List offers error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/offers/:id/accept — accept an offer (requires auth, must be recipient)
app.put('/api/offers/:id/accept', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const existing = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    if (existing.rows[0].to_user !== req.user.username) return res.status(403).json({ error: 'Not your offer to accept' });
    if (existing.rows[0].status !== 'pending') return res.status(400).json({ error: 'Offer is no longer pending' });

    const result = await pool.query('UPDATE offers SET status = $1 WHERE id = $2 RETURNING *', ['accepted', req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Accept offer error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/offers/:id/decline — decline an offer (requires auth, must be recipient)
app.put('/api/offers/:id/decline', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const existing = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    if (existing.rows[0].to_user !== req.user.username) return res.status(403).json({ error: 'Not your offer to decline' });
    if (existing.rows[0].status !== 'pending') return res.status(400).json({ error: 'Offer is no longer pending' });

    const result = await pool.query('UPDATE offers SET status = $1 WHERE id = $2 RETURNING *', ['declined', req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Decline offer error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Purchases API ────────────────────────────────────────────────────────────

// POST /api/purchases — record a purchase (requires auth)
app.post('/api/purchases', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { seller, recordId, album, artist, price, condition, stripeSessionId, shippingName, shippingStreet, shippingCity, shippingState, shippingZip } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO purchases (buyer, seller, record_id, album, artist, price, condition, stripe_session_id, shipping_name, shipping_street, shipping_city, shipping_state, shipping_zip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.username, seller || '', recordId || null, album || '', artist || '', price || '0', condition || '', stripeSessionId || '', shippingName || '', shippingStreet || '', shippingCity || '', shippingState || '', shippingZip || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create purchase error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/purchases — list user's purchases (requires auth)
app.get('/api/purchases', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM purchases WHERE buyer = $1 OR seller = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List purchases error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Messages (DMs) API ──────────────────────────────────────────────────────

// POST /api/messages — send a message (requires auth)
app.post('/api/messages', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { toUser, text } = req.body;
  if (!toUser || !text) return res.status(400).json({ error: 'toUser and text are required', code: 'MISSING_FIELDS' });
  if (typeof toUser !== 'string' || typeof text !== 'string') return res.status(400).json({ error: 'toUser and text must be strings', code: 'INVALID_TYPES' });
  if (text.trim().length === 0) return res.status(400).json({ error: 'Message text cannot be empty', code: 'EMPTY_MESSAGE' });
  try {
    const result = await pool.query(
      'INSERT INTO messages (from_user, to_user, text) VALUES ($1,$2,$3) RETURNING *',
      [req.user.username, toUser, text]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages — list conversations (requires auth)
app.get('/api/messages', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (partner) *
      FROM (
        SELECT *, CASE WHEN from_user = $1 THEN to_user ELSE from_user END AS partner
        FROM messages
        WHERE from_user = $1 OR to_user = $1
      ) sub
      ORDER BY partner, created_at DESC
    `, [req.user.username]);
    res.json(result.rows);
  } catch (err) {
    console.error('List conversations error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/messages/:otherUser — get conversation with a user (requires auth)
app.get('/api/messages/:otherUser', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      `SELECT * FROM messages
       WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
       ORDER BY created_at ASC`,
      [req.user.username, req.params.otherUser]
    );
    // Mark messages from the other user as read
    await pool.query(
      'UPDATE messages SET read = true WHERE from_user = $1 AND to_user = $2 AND read = false',
      [req.params.otherUser, req.user.username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get conversation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Follows API ──────────────────────────────────────────────────────────────

// POST /api/follows — follow a user (requires auth)
app.post('/api/follows', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  if (username === req.user.username) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    await pool.query(
      'INSERT INTO follows (follower, following) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.username, username]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Follow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/follows/:username — unfollow a user (requires auth)
app.delete('/api/follows/:username', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    await pool.query('DELETE FROM follows WHERE follower = $1 AND following = $2', [req.user.username, req.params.username]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Unfollow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/follows/:username — get followers and following for a user
app.get('/api/follows/:username', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const followers = await pool.query('SELECT follower FROM follows WHERE following = $1', [req.params.username]);
    const following = await pool.query('SELECT following FROM follows WHERE follower = $1', [req.params.username]);
    res.json({
      followers: followers.rows.map(r => r.follower),
      following: following.rows.map(r => r.following),
    });
  } catch (err) {
    console.error('Get follows error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Records: search ───────────────────────────────────────────────────────────

// GET /api/records/search — full-text search across records (album, artist, label)
app.get('/api/records/search', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query "q" is required', code: 'MISSING_QUERY' });
  }
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  try {
    const pattern = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT * FROM records
       WHERE album ILIKE $1 OR artist ILIKE $1 OR label ILIKE $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [pattern, limit, offset]
    );
    res.json({ results: result.rows, total: result.rows.length, query: q.trim() });
  } catch (err) {
    console.error('Record search error:', err.message);
    res.status(500).json({ error: 'Search failed', code: 'SEARCH_ERROR' });
  }
});

// GET /api/records/:id — get single record by ID
app.get('/api/records/:id', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const result = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get record error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/records/:id/like — toggle like on record (requires auth)
app.post('/api/records/:id/like', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    // Check record exists
    const record = await pool.query('SELECT id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });

    // Toggle like
    const existing = await pool.query(
      'SELECT id FROM record_likes WHERE user_id = $1 AND record_id = $2',
      [req.user.username, recordId]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM record_likes WHERE user_id = $1 AND record_id = $2', [req.user.username, recordId]);
      const count = await pool.query('SELECT COUNT(*) FROM record_likes WHERE record_id = $1', [recordId]);
      return res.json({ liked: false, likes: parseInt(count.rows[0].count) });
    }
    await pool.query('INSERT INTO record_likes (user_id, record_id) VALUES ($1, $2)', [req.user.username, recordId]);
    const count = await pool.query('SELECT COUNT(*) FROM record_likes WHERE record_id = $1', [recordId]);
    res.json({ liked: true, likes: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('Like record error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/records/:id/save — toggle save/bookmark on record (requires auth)
app.post('/api/records/:id/save', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const record = await pool.query('SELECT id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });

    const existing = await pool.query(
      'SELECT id FROM record_saves WHERE user_id = $1 AND record_id = $2',
      [req.user.username, recordId]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM record_saves WHERE user_id = $1 AND record_id = $2', [req.user.username, recordId]);
      return res.json({ saved: false });
    }
    await pool.query('INSERT INTO record_saves (user_id, record_id) VALUES ($1, $2)', [req.user.username, recordId]);
    res.json({ saved: true });
  } catch (err) {
    console.error('Save record error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Users: search ─────────────────────────────────────────────────────────────

// GET /api/users/search — search users by username or display name
app.get('/api/users/search', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Search query "q" is required', code: 'MISSING_QUERY' });
  }
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const pattern = `%${q.trim()}%`;
    const result = await pool.query(
      `SELECT id, username, display_name, bio, avatar_url, location
       FROM profiles
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY username ASC LIMIT $2`,
      [pattern, limit]
    );
    res.json({ results: result.rows.map(u => ({ id: u.id, username: u.username, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, location: u.location })), query: q.trim() });
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ error: 'Search failed', code: 'SEARCH_ERROR' });
  }
});

// ── Public stats ──────────────────────────────────────────────────────────────

// GET /api/stats — public stats (total users, total records, total transactions)
app.get('/api/stats', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  try {
    const [users, records, transactions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM profiles'),
      pool.query('SELECT COUNT(*) FROM records'),
      pool.query('SELECT COUNT(*) FROM purchases'),
    ]);
    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalRecords: parseInt(records.rows[0].count),
      totalTransactions: parseInt(transactions.rows[0].count),
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Social feed ───────────────────────────────────────────────────────────────

// GET /api/feed — social feed with pagination (public posts + records activity)
app.get('/api/feed', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  try {
    const result = await pool.query(
      `SELECT p.*, pr.display_name, pr.avatar_url,
              r.album AS tagged_album, r.artist AS tagged_artist, r.accent AS tagged_accent
       FROM posts p
       LEFT JOIN profiles pr ON pr.username = p.user_id
       LEFT JOIN records r ON r.id = p.tagged_record_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      items: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        displayName: row.display_name || row.user_id,
        avatarUrl: row.avatar_url || '',
        caption: row.caption,
        mediaUrl: row.media_url,
        mediaType: row.media_type,
        taggedRecord: row.tagged_record_id ? { id: row.tagged_record_id, album: row.tagged_album, artist: row.tagged_artist, accent: row.tagged_accent } : null,
        likes: row.likes,
        createdAt: row.created_at,
      })),
      limit,
      offset,
      hasMore: result.rows.length === limit,
    });
  } catch (err) {
    console.error('Feed error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Post interactions ─────────────────────────────────────────────────────────

// POST /api/posts/:id/like — toggle like on post (requires auth)
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID', code: 'INVALID_ID' });
  try {
    const post = await pool.query('SELECT id, likes FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found', code: 'NOT_FOUND' });

    const existing = await pool.query(
      'SELECT id FROM post_likes WHERE user_id = $1 AND post_id = $2',
      [req.user.username, postId]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2', [req.user.username, postId]);
      await pool.query('UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1', [postId]);
      const updated = await pool.query('SELECT likes FROM posts WHERE id = $1', [postId]);
      return res.json({ liked: false, likes: updated.rows[0].likes });
    }
    await pool.query('INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2)', [req.user.username, postId]);
    await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [postId]);
    const updated = await pool.query('SELECT likes FROM posts WHERE id = $1', [postId]);
    res.json({ liked: true, likes: updated.rows[0].likes });
  } catch (err) {
    console.error('Like post error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// POST /api/posts/:id/bookmark — toggle bookmark on post (requires auth)
app.post('/api/posts/:id/bookmark', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  const postId = parseInt(req.params.id);
  if (!Number.isFinite(postId) || postId <= 0) return res.status(400).json({ error: 'Invalid post ID', code: 'INVALID_ID' });
  try {
    const post = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) return res.status(404).json({ error: 'Post not found', code: 'NOT_FOUND' });

    const existing = await pool.query(
      'SELECT id FROM post_bookmarks WHERE user_id = $1 AND post_id = $2',
      [req.user.username, postId]
    );
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.username, postId]);
      return res.json({ bookmarked: false });
    }
    await pool.query('INSERT INTO post_bookmarks (user_id, post_id) VALUES ($1, $2)', [req.user.username, postId]);
    res.json({ bookmarked: true });
  } catch (err) {
    console.error('Bookmark post error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────

// POST /api/webhook — Stripe webhook handler for payment confirmation
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured', code: 'NO_STRIPE' });

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook verification failed', code: 'WEBHOOK_INVALID' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};
        console.log(`[Stripe] Payment complete: record=${meta.recordId} buyer=${meta.buyer} seller=${meta.seller}`);

        if (pool && meta.recordId) {
          // Update order status to 'paid'
          await pool.query(
            `UPDATE purchases SET status = 'paid' WHERE stripe_session_id = $1`,
            [session.id]
          );
          // If no purchase row yet, create one
          const existing = await pool.query('SELECT id FROM purchases WHERE stripe_session_id = $1', [session.id]);
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO purchases (buyer, seller, record_id, album, artist, price, stripe_session_id, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid')`,
              [meta.buyer || '', meta.seller || '', parseInt(meta.recordId) || null, '', '', String((session.amount_total || 0) / 100), session.id]
            );
          }
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (pool) {
          await pool.query(`UPDATE purchases SET status = 'expired' WHERE stripe_session_id = $1`, [session.id]);
        }
        break;
      }
      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed', code: 'WEBHOOK_ERROR' });
  }
});

// ── Orders API ────────────────────────────────────────────────────────────────

// GET /api/orders — list user's orders with status (requires auth)
app.get('/api/orders', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured', code: 'NO_DB' });
  try {
    const result = await pool.query(
      `SELECT p.*, r.album, r.artist, r.condition, r.accent
       FROM purchases p
       LEFT JOIN records r ON r.id = p.record_id
       WHERE p.buyer = $1 OR p.seller = $1
       ORDER BY p.created_at DESC`,
      [req.user.username]
    );
    res.json({
      orders: result.rows.map(row => ({
        id: row.id,
        buyer: row.buyer,
        seller: row.seller,
        recordId: row.record_id,
        album: row.album || '',
        artist: row.artist || '',
        price: row.price,
        condition: row.condition || '',
        status: row.status || 'pending',
        stripeSessionId: row.stripe_session_id || '',
        shippingName: row.shipping_name || '',
        shippingStreet: row.shipping_street || '',
        shippingCity: row.shipping_city || '',
        shippingState: row.shipping_state || '',
        shippingZip: row.shipping_zip || '',
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('List orders error:', err.message);
    res.status(500).json({ error: 'Server error', code: 'INTERNAL_ERROR' });
  }
});

// ── Analytics & Reporting API ─────────────────────────────────────────────────

// GET /api/analytics/top-sellers — top 10 sellers by transaction count
app.get('/api/analytics/top-sellers', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT seller AS username, COUNT(*) AS transaction_count,
             SUM(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)) AS total_revenue
      FROM purchases
      GROUP BY seller
      ORDER BY transaction_count DESC
      LIMIT 10
    `);
    res.json({ sellers: result.rows.map(r => ({ username: r.username, transactionCount: parseInt(r.transaction_count), totalRevenue: parseFloat(r.total_revenue || 0) })) });
  } catch (err) {
    console.error('Top sellers error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/top-records — most liked/saved records
app.get('/api/analytics/top-records', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(`
      SELECT r.id, r.album, r.artist, r.user_id, r.accent, r.condition,
             COALESCE(lk.like_count, 0) AS like_count,
             COALESCE(sv.save_count, 0) AS save_count,
             COALESCE(lk.like_count, 0) + COALESCE(sv.save_count, 0) AS popularity
      FROM records r
      LEFT JOIN (SELECT record_id, COUNT(*) AS like_count FROM record_likes GROUP BY record_id) lk ON lk.record_id = r.id
      LEFT JOIN (SELECT record_id, COUNT(*) AS save_count FROM record_saves GROUP BY record_id) sv ON sv.record_id = r.id
      ORDER BY popularity DESC, r.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ records: result.rows.map(r => ({ id: r.id, album: r.album, artist: r.artist, userId: r.user_id, accent: r.accent, condition: r.condition, likeCount: parseInt(r.like_count), saveCount: parseInt(r.save_count), popularity: parseInt(r.popularity) })) });
  } catch (err) {
    console.error('Top records error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/genre-distribution — record count by genre (using tags)
app.get('/api/analytics/genre-distribution', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT tag AS genre, COUNT(*) AS count
      FROM records, unnest(tags) AS tag
      WHERE tag != ''
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 30
    `);
    res.json({ genres: result.rows.map(r => ({ genre: r.genre, count: parseInt(r.count) })) });
  } catch (err) {
    console.error('Genre distribution error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/price-trends — average price by condition grade
app.get('/api/analytics/price-trends', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT condition AS grade,
             COUNT(*) AS count,
             ROUND(AVG(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 2) AS avg_price,
             ROUND(MIN(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 2) AS min_price,
             ROUND(MAX(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 2) AS max_price
      FROM records
      WHERE for_sale = true AND price IS NOT NULL AND price != '' AND price != '0'
      GROUP BY condition
      ORDER BY avg_price DESC
    `);
    res.json({ trends: result.rows.map(r => ({ grade: r.grade, count: parseInt(r.count), avgPrice: parseFloat(r.avg_price), minPrice: parseFloat(r.min_price), maxPrice: parseFloat(r.max_price) })) });
  } catch (err) {
    console.error('Price trends error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/analytics/activity — daily activity counts for last 30 days
app.get('/api/analytics/activity', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const result = await pool.query(`
      SELECT day, SUM(records_added) AS records_added, SUM(posts_created) AS posts_created,
             SUM(purchases_made) AS purchases_made, SUM(signups) AS signups
      FROM (
        SELECT DATE(created_at) AS day, COUNT(*) AS records_added, 0 AS posts_created, 0 AS purchases_made, 0 AS signups
        FROM records WHERE created_at >= now() - ($1 || ' days')::INTERVAL GROUP BY DATE(created_at)
        UNION ALL
        SELECT DATE(created_at) AS day, 0, COUNT(*), 0, 0
        FROM posts WHERE created_at >= now() - ($1 || ' days')::INTERVAL GROUP BY DATE(created_at)
        UNION ALL
        SELECT DATE(created_at) AS day, 0, 0, COUNT(*), 0
        FROM purchases WHERE created_at >= now() - ($1 || ' days')::INTERVAL GROUP BY DATE(created_at)
        UNION ALL
        SELECT DATE(created_at) AS day, 0, 0, 0, COUNT(*)
        FROM profiles WHERE created_at >= now() - ($1 || ' days')::INTERVAL GROUP BY DATE(created_at)
      ) combined
      GROUP BY day
      ORDER BY day DESC
    `, [days.toString()]);
    res.json({ activity: result.rows.map(r => ({ date: r.day, recordsAdded: parseInt(r.records_added), postsCreated: parseInt(r.posts_created), purchasesMade: parseInt(r.purchases_made), signups: parseInt(r.signups) })) });
  } catch (err) {
    console.error('Activity error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── User Features ────────────────────────────────────────────────────────────

// PUT /api/auth/change-password — change password (requires old password)
app.put('/api/auth/change-password', authMiddleware, authRateLimit, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Old and new passwords are required', code: 'MISSING_FIELDS' });
  if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') return res.status(400).json({ error: 'Passwords must be strings', code: 'INVALID_TYPES' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters', code: 'WEAK_PASSWORD' });
  try {
    const result = await pool.query('SELECT password_hash FROM profiles WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify-email — placeholder for email verification
app.post('/api/auth/verify-email', authMiddleware, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Verification token is required', code: 'MISSING_TOKEN' });
  res.json({ ok: false, message: 'Email verification is not yet implemented. Your account is active without verification.' });
});

// GET /api/users/:username/profile — public profile endpoint
app.get('/api/users/:username/profile', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT id, username, display_name, bio, location, fav_genre, avatar_url, header_url, accent, created_at FROM profiles WHERE username = $1',
      [req.params.username.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({ id: u.id, username: u.username, displayName: u.display_name, bio: u.bio, location: u.location, favGenre: u.fav_genre, avatarUrl: u.avatar_url, headerUrl: u.header_url, accent: u.accent, joinedAt: u.created_at });
  } catch (err) {
    console.error('Public profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:username/records — user's public records
app.get('/api/users/:username/records', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const result = await pool.query(
      'SELECT * FROM records WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.username.toLowerCase(), limit, offset]
    );
    res.json({ records: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('User records error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:username/stats — user stats (records, followers, posts)
app.get('/api/users/:username/stats', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const username = req.params.username.toLowerCase();
    const [records, posts, followers, following] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM records WHERE user_id = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM posts WHERE user_id = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM follows WHERE following = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM follows WHERE follower = $1', [username]),
    ]);
    res.json({
      username,
      recordCount: parseInt(records.rows[0].count),
      postCount: parseInt(posts.rows[0].count),
      followerCount: parseInt(followers.rows[0].count),
      followingCount: parseInt(following.rows[0].count),
    });
  } catch (err) {
    console.error('User stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Notifications API ────────────────────────────────────────────────────────

// POST /api/notifications — create notification
app.post('/api/notifications', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { userId, type, title, body, relatedId, relatedType } = req.body;
  if (!userId || !type || !title) return res.status(400).json({ error: 'userId, type, and title are required', code: 'MISSING_FIELDS' });
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, related_id, related_type)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, type, title, body || '', relatedId || null, relatedType || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create notification error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications — list user's notifications with pagination
app.get('/api/notifications', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const unreadOnly = req.query.unread === 'true';
    const where = unreadOnly ? 'AND read = false' : '';
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.username, limit, offset]
    );
    const countResult = await pool.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN read = false THEN 1 ELSE 0 END) AS unread FROM notifications WHERE user_id = $1',
      [req.user.username]
    );
    res.json({
      notifications: result.rows.map(n => ({ id: n.id, type: n.type, title: n.title, body: n.body, relatedId: n.related_id, relatedType: n.related_type, read: n.read, createdAt: n.created_at })),
      total: parseInt(countResult.rows[0].total || 0),
      unread: parseInt(countResult.rows[0].unread || 0),
    });
  } catch (err) {
    console.error('List notifications error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read — mark notification as read
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/read-all — mark all as read
app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [req.user.username]
    );
    res.json({ ok: true, marked: result.rowCount });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Wishlist API ─────────────────────────────────────────────────────────────

// POST /api/wishlist — add to wishlist
app.post('/api/wishlist', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { artist, album, genre, maxPrice, conditionMin, notes } = req.body;
  if (!artist) return res.status(400).json({ error: 'Artist is required', code: 'MISSING_FIELDS' });
  try {
    const result = await pool.query(
      `INSERT INTO wishlist (user_id, artist, album, genre, max_price, condition_min, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.username, artist, album || '', genre || '', maxPrice || '', conditionMin || '', notes || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add wishlist error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/wishlist/:id — remove from wishlist
app.delete('/api/wishlist/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM wishlist WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Wishlist item not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove wishlist error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wishlist — list user's wishlist
app.get('/api/wishlist', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM wishlist WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ items: result.rows.map(w => ({ id: w.id, artist: w.artist, album: w.album, genre: w.genre, maxPrice: w.max_price, conditionMin: w.condition_min, notes: w.notes, createdAt: w.created_at })) });
  } catch (err) {
    console.error('List wishlist error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wishlist/matches — find marketplace records matching wishlist items
app.get('/api/wishlist/matches', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const wishlist = await pool.query('SELECT * FROM wishlist WHERE user_id = $1', [req.user.username]);
    if (wishlist.rows.length === 0) return res.json({ matches: [] });

    const matches = [];
    for (const wish of wishlist.rows) {
      const conditions = ['for_sale = true', 'user_id != $1'];
      const params = [req.user.username];
      let idx = 2;

      conditions.push(`LOWER(artist) LIKE $${idx++}`);
      params.push(`%${wish.artist.toLowerCase()}%`);

      if (wish.album) {
        conditions.push(`LOWER(album) LIKE $${idx++}`);
        params.push(`%${wish.album.toLowerCase()}%`);
      }
      if (wish.max_price && wish.max_price !== '') {
        conditions.push(`CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC) <= $${idx++}`);
        params.push(parseFloat(wish.max_price));
      }

      const result = await pool.query(
        `SELECT * FROM records WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 10`,
        params
      );

      if (result.rows.length > 0) {
        matches.push({
          wishlistItem: { id: wish.id, artist: wish.artist, album: wish.album },
          records: result.rows,
        });
      }
    }
    res.json({ matches });
  } catch (err) {
    console.error('Wishlist matches error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Unified Search API ───────────────────────────────────────────────────────

// GET /api/search — unified search across records, users, and posts with relevance scoring
app.get('/api/search', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Search query (q) is required', code: 'MISSING_QUERY' });
  const types = (req.query.type || 'all').split(',');
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  try {
    const results = { records: [], users: [], posts: [] };
    const searchPattern = `%${q.toLowerCase()}%`;

    if (types.includes('all') || types.includes('records')) {
      const recordsResult = await pool.query(`
        SELECT id, album, artist, user_id, year, format, condition, for_sale, price, accent, verified,
          CASE
            WHEN LOWER(album) = $1 THEN 100
            WHEN LOWER(artist) = $1 THEN 95
            WHEN LOWER(album) LIKE $2 THEN 70
            WHEN LOWER(artist) LIKE $2 THEN 65
            ELSE 50
          END AS relevance
        FROM records
        WHERE LOWER(album) LIKE $2 OR LOWER(artist) LIKE $2
        ORDER BY relevance DESC, created_at DESC
        LIMIT $3
      `, [q.toLowerCase(), searchPattern, limit]);
      results.records = recordsResult.rows.map(r => ({ ...r, _type: 'record', relevance: parseInt(r.relevance) }));
    }

    if (types.includes('all') || types.includes('users')) {
      const usersResult = await pool.query(`
        SELECT id, username, display_name, bio, avatar_url, accent,
          CASE
            WHEN LOWER(username) = $1 THEN 100
            WHEN LOWER(display_name) = $1 THEN 95
            WHEN LOWER(username) LIKE $2 THEN 70
            WHEN LOWER(display_name) LIKE $2 THEN 65
            ELSE 50
          END AS relevance
        FROM profiles
        WHERE LOWER(username) LIKE $2 OR LOWER(display_name) LIKE $2
        ORDER BY relevance DESC
        LIMIT $3
      `, [q.toLowerCase(), searchPattern, limit]);
      results.users = usersResult.rows.map(u => ({ id: u.id, username: u.username, displayName: u.display_name, bio: u.bio, avatarUrl: u.avatar_url, accent: u.accent, _type: 'user', relevance: parseInt(u.relevance) }));
    }

    if (types.includes('all') || types.includes('posts')) {
      const postsResult = await pool.query(`
        SELECT id, user_id, caption, media_url, media_type, likes, created_at,
          CASE
            WHEN LOWER(caption) LIKE $1 THEN 70
            ELSE 50
          END AS relevance
        FROM posts
        WHERE LOWER(caption) LIKE $1
        ORDER BY relevance DESC, created_at DESC
        LIMIT $2
      `, [searchPattern, limit]);
      results.posts = postsResult.rows.map(p => ({ ...p, _type: 'post', relevance: parseInt(p.relevance) }));
    }

    res.json({
      query: q,
      results,
      counts: { records: results.records.length, users: results.users.length, posts: results.posts.length },
    });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`\n🎵 Groovestack API server running on :${PORT}`);
  console.log(`   Claude vinyl verification: ready`);
  console.log(`   Discogs price lookup: /api/prices/lookup`);
  console.log(`   Vinyl Buddy API: /api/vinyl-buddy/* (${AUDD_API_TOKEN ? 'AudD enabled' : 'set AUDD_API_TOKEN to enable identification'})\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('   HTTP server closed');
    if (pool) {
      pool.end().then(() => {
        console.log('   Database pool closed');
        process.exit(0);
      }).catch(() => process.exit(1));
    } else {
      process.exit(0);
    }
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('   Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
