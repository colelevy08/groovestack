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
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        price TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_price_history_record ON price_history(record_id);

      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);

      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocker TEXT NOT NULL,
        blocked TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(blocker, blocked)
      );
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker);

      CREATE TABLE IF NOT EXISTS moderation_queue (
        id SERIAL PRIMARY KEY,
        reported_by TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_moderation_status ON moderation_queue(status);

      CREATE TABLE IF NOT EXISTS condition_verification_log (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        verified_by TEXT NOT NULL,
        grade TEXT NOT NULL,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS offer_negotiations (
        id SERIAL PRIMARY KEY,
        offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        counter_price TEXT NOT NULL,
        message TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_offer_negotiations_offer ON offer_negotiations(offer_id);

      CREATE TABLE IF NOT EXISTS promo_codes (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        discount_amount TEXT DEFAULT '0',
        max_uses INTEGER DEFAULT 0,
        current_uses INTEGER DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer TEXT NOT NULL,
        referred TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(referrer, referred)
      );
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer);

      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        name TEXT DEFAULT '',
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT[] DEFAULT '{}',
        secret TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

      CREATE TABLE IF NOT EXISTS price_alerts (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT DEFAULT '',
        max_price TEXT NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);

      CREATE TABLE IF NOT EXISTS collection_shares (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        share_token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_collection_shares_token ON collection_shares(share_token);
    `))
    .then(() => console.log('   Extended feature tables: ready'))
    .then(() => pool.query(`
      CREATE TABLE IF NOT EXISTS record_views (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        viewer_ip TEXT DEFAULT '',
        viewer_user TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_record_views_record ON record_views(record_id);

      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        preferences JSONB DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS condition_change_history (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        old_condition TEXT NOT NULL,
        new_condition TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        reason TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_condition_change_record ON condition_change_history(record_id);

      CREATE TABLE IF NOT EXISTS authenticity_queue (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        submitted_by TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reviewer TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now(),
        reviewed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_authenticity_queue_status ON authenticity_queue(status);

      CREATE TABLE IF NOT EXISTS order_cancellations (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        cancelled_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS record_provenance (
        id SERIAL PRIMARY KEY,
        record_id INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        owner TEXT NOT NULL,
        acquired_from TEXT DEFAULT '',
        acquired_at TIMESTAMPTZ DEFAULT now(),
        price_paid TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_record_provenance_record ON record_provenance(record_id);

      CREATE TABLE IF NOT EXISTS escrow_holds (
        id SERIAL PRIMARY KEY,
        buyer TEXT NOT NULL,
        seller TEXT NOT NULL,
        record_id INTEGER REFERENCES records(id) ON DELETE SET NULL,
        amount TEXT NOT NULL,
        status TEXT DEFAULT 'held',
        created_at TIMESTAMPTZ DEFAULT now(),
        released_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_escrow_holds_status ON escrow_holds(status);

      CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
        filed_by TEXT NOT NULL,
        against TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        resolution TEXT DEFAULT '',
        mediator TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now(),
        resolved_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

      CREATE TABLE IF NOT EXISTS user_verification (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        level TEXT DEFAULT 'unverified',
        email_verified BOOLEAN DEFAULT false,
        id_verified BOOLEAN DEFAULT false,
        seller_verified BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      DO $$ BEGIN
        ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT false;
        ALTER TABLE records ADD COLUMN IF NOT EXISTS catalog_number TEXT DEFAULT '';
      END $$;
    `))
    .then(() => console.log('   Marketplace v2 tables: ready'))
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

// ── Improvement 1: Request logging with ISO timestamps ────────────────────────
// (Already exists above at line 73, enhanced here with request ID tracking)
let _requestCounter = 0;
app.use((req, _res, next) => {
  req._requestId = `req-${Date.now()}-${++_requestCounter}`;
  req._startedAt = new Date().toISOString();
  next();
});

// ── Improvement 2: CORS preflight caching ─────────────────────────────────────
// (Already configured above via Access-Control-Max-Age: 86400 — 24h cache)
// Explicitly handle OPTIONS with 204 for all /api/v1/* prefixed routes too
app.options('/api/v1/*', (_req, res) => res.sendStatus(204));

// ── Improvement 3: Response compression (gzip) ───────────────────────────────
// Inline gzip compression middleware (no external dependency)
const zlib = require('zlib');
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const raw = JSON.stringify(body);
    if (raw.length < 1024) return originalJson(body); // skip small responses

    zlib.gzip(Buffer.from(raw), (err, compressed) => {
      if (err) return originalJson(body);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json');
      res.end(compressed);
    });
  };
  next();
});

// ── Improvement 4: API versioning prefix (/api/v1/) ──────────────────────────
// Mirror key endpoints under /api/v1/ for forward compatibility
const v1Router = express.Router();
v1Router.get('/health', async (_req, res) => {
  let dbStatus = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); dbStatus = 'connected'; } catch { dbStatus = 'error'; }
  }
  res.json({ version: 'v1', status: 'ok', database: dbStatus });
});
v1Router.get('/records', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query('SELECT * FROM records ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ version: 'v1', records: result.rows });
  } catch (err) {
    console.error('v1 records error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
v1Router.get('/stats', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const [users, records, transactions] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM profiles'),
      pool.query('SELECT COUNT(*) FROM records'),
      pool.query('SELECT COUNT(*) FROM purchases'),
    ]);
    res.json({ version: 'v1', totalUsers: parseInt(users.rows[0].count), totalRecords: parseInt(records.rows[0].count), totalTransactions: parseInt(transactions.rows[0].count) });
  } catch (err) {
    console.error('v1 stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
app.use('/api/v1', v1Router);

// ── Improvement 5: Batch operations endpoint ─────────────────────────────────
app.post('/api/batch', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { operations } = req.body;
  if (!Array.isArray(operations) || operations.length === 0) return res.status(400).json({ error: 'operations array is required', code: 'MISSING_FIELDS' });
  if (operations.length > 20) return res.status(400).json({ error: 'Maximum 20 operations per batch', code: 'TOO_MANY_OPS' });

  const results = [];
  for (const op of operations) {
    try {
      switch (op.action) {
        case 'create_record': {
          const { album, artist, year, format, label, condition, forSale, price } = op.data || {};
          if (!album || !artist) { results.push({ action: op.action, success: false, error: 'album and artist required' }); break; }
          const r = await pool.query(
            'INSERT INTO records (user_id, album, artist, year, format, label, condition, for_sale, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
            [req.user.username, album, artist, year || '', format || 'LP', label || '', condition || 'VG+', forSale || false, price || '0']
          );
          results.push({ action: op.action, success: true, record: r.rows[0] });
          break;
        }
        case 'delete_record': {
          const { id } = op.data || {};
          const existing = await pool.query('SELECT user_id FROM records WHERE id = $1', [id]);
          if (existing.rows.length === 0 || existing.rows[0].user_id !== req.user.username) {
            results.push({ action: op.action, success: false, error: 'Record not found or not owned' });
          } else {
            await pool.query('DELETE FROM records WHERE id = $1', [id]);
            results.push({ action: op.action, success: true, id });
          }
          break;
        }
        case 'like_record': {
          const { id } = op.data || {};
          await pool.query('INSERT INTO record_likes (user_id, record_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.username, id]);
          results.push({ action: op.action, success: true, id });
          break;
        }
        default:
          results.push({ action: op.action, success: false, error: 'Unknown action' });
      }
    } catch (err) {
      results.push({ action: op.action, success: false, error: err.message });
    }
  }
  res.json({ results });
});

// ── Improvement 6: Record price history tracking ─────────────────────────────
app.get('/api/records/:id/price-history', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID' });
  try {
    const result = await pool.query(
      'SELECT * FROM price_history WHERE record_id = $1 ORDER BY created_at DESC LIMIT 50',
      [recordId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Price history error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/records/:id/price-history', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID' });
  try {
    const record = await pool.query('SELECT user_id, price FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (record.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    const { price } = req.body;
    if (!price) return res.status(400).json({ error: 'Price is required' });

    // Log old price
    await pool.query(
      'INSERT INTO price_history (record_id, price, changed_by) VALUES ($1, $2, $3)',
      [recordId, record.rows[0].price, req.user.username]
    );
    // Update record price
    await pool.query('UPDATE records SET price = $1, updated_at = now() WHERE id = $2', [price, recordId]);
    res.json({ ok: true, oldPrice: record.rows[0].price, newPrice: price });
  } catch (err) {
    console.error('Price update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 7: User activity log ──────────────────────────────────────────
app.get('/api/activity-log', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      'SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.username, limit]
    );
    res.json({ activities: result.rows });
  } catch (err) {
    console.error('Activity log error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper to log activity (used internally)
async function logActivity(userId, action, details) {
  if (!pool) return;
  try {
    await pool.query(
      'INSERT INTO activity_log (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(details || {})]
    );
  } catch (err) {
    console.error('Activity log write error:', err.message);
  }
}

// ── Improvement 8: Collection statistics endpoint ─────────────────────────────
app.get('/api/collection/stats', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const username = req.query.user || req.user.username;
    const records = await pool.query('SELECT * FROM records WHERE user_id = $1', [username]);
    const rows = records.rows;

    let totalValue = 0;
    const genreBreakdown = {};
    const formatBreakdown = {};
    const conditionBreakdown = {};
    const decadeBreakdown = {};

    for (const r of rows) {
      const price = parseFloat(r.price) || 0;
      totalValue += price;
      const fmt = r.format || 'Unknown';
      formatBreakdown[fmt] = (formatBreakdown[fmt] || 0) + 1;
      const cond = r.condition || 'Unknown';
      conditionBreakdown[cond] = (conditionBreakdown[cond] || 0) + 1;
      const yr = parseInt(r.year);
      if (Number.isFinite(yr) && yr > 0) {
        const decade = `${Math.floor(yr / 10) * 10}s`;
        decadeBreakdown[decade] = (decadeBreakdown[decade] || 0) + 1;
      }
      if (Array.isArray(r.tags)) {
        for (const tag of r.tags) {
          if (tag) genreBreakdown[tag] = (genreBreakdown[tag] || 0) + 1;
        }
      }
    }

    res.json({
      username,
      totalRecords: rows.length,
      totalValue: Math.round(totalValue * 100) / 100,
      averageValue: rows.length > 0 ? Math.round((totalValue / rows.length) * 100) / 100 : 0,
      genreBreakdown,
      formatBreakdown,
      conditionBreakdown,
      decadeBreakdown,
    });
  } catch (err) {
    console.error('Collection stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 9: Trending records algorithm ─────────────────────────────────
app.get('/api/trending', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const result = await pool.query(`
      SELECT r.id, r.album, r.artist, r.user_id, r.accent, r.condition, r.price, r.for_sale,
             COALESCE(recent_likes.cnt, 0) AS recent_like_count,
             COALESCE(recent_saves.cnt, 0) AS recent_save_count,
             COALESCE(recent_likes.cnt, 0) * 2 + COALESCE(recent_saves.cnt, 0) AS trend_score
      FROM records r
      LEFT JOIN (
        SELECT record_id, COUNT(*) AS cnt FROM record_likes
        WHERE created_at >= now() - ($1 || ' days')::INTERVAL
        GROUP BY record_id
      ) recent_likes ON recent_likes.record_id = r.id
      LEFT JOIN (
        SELECT record_id, COUNT(*) AS cnt FROM record_saves
        WHERE created_at >= now() - ($1 || ' days')::INTERVAL
        GROUP BY record_id
      ) recent_saves ON recent_saves.record_id = r.id
      WHERE COALESCE(recent_likes.cnt, 0) + COALESCE(recent_saves.cnt, 0) > 0
      ORDER BY trend_score DESC, r.created_at DESC
      LIMIT $2
    `, [days.toString(), limit]);
    res.json({
      trending: result.rows.map(r => ({
        id: r.id, album: r.album, artist: r.artist, userId: r.user_id,
        accent: r.accent, condition: r.condition, price: r.price, forSale: r.for_sale,
        recentLikes: parseInt(r.recent_like_count), recentSaves: parseInt(r.recent_save_count),
        trendScore: parseInt(r.trend_score),
      })),
      period: `${days} days`,
    });
  } catch (err) {
    console.error('Trending error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 10: Record recommendation engine ──────────────────────────────
app.get('/api/recommendations', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 30);
    // Get user's top artists and genres
    const userRecords = await pool.query('SELECT artist, tags FROM records WHERE user_id = $1', [req.user.username]);
    if (userRecords.rows.length === 0) return res.json({ recommendations: [], reason: 'Add records to your collection to get recommendations' });

    const artistCounts = {};
    for (const r of userRecords.rows) {
      artistCounts[r.artist.toLowerCase()] = (artistCounts[r.artist.toLowerCase()] || 0) + 1;
    }
    const topArtists = Object.entries(artistCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([a]) => a);

    // Find records from those artists that user doesn't own
    const result = await pool.query(`
      SELECT DISTINCT r.* FROM records r
      WHERE r.user_id != $1
        AND r.for_sale = true
        AND LOWER(r.artist) = ANY($2)
        AND r.id NOT IN (SELECT record_id FROM record_saves WHERE user_id = $1)
      ORDER BY r.created_at DESC
      LIMIT $3
    `, [req.user.username, topArtists, limit]);

    res.json({
      recommendations: result.rows,
      basedOn: topArtists,
    });
  } catch (err) {
    console.error('Recommendations error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 11: Duplicate record detection ───────────────────────────────
app.get('/api/records/duplicates/check', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(`
      SELECT LOWER(album) AS album, LOWER(artist) AS artist, COUNT(*) AS count,
             array_agg(id) AS record_ids
      FROM records
      WHERE user_id = $1
      GROUP BY LOWER(album), LOWER(artist)
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `, [req.user.username]);
    res.json({ duplicates: result.rows });
  } catch (err) {
    console.error('Duplicate check error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 12: Bulk record import (CSV) ─────────────────────────────────
app.post('/api/records/import', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { records: importRecords } = req.body;
  if (!Array.isArray(importRecords) || importRecords.length === 0) return res.status(400).json({ error: 'records array is required', code: 'MISSING_FIELDS' });
  if (importRecords.length > 100) return res.status(400).json({ error: 'Maximum 100 records per import', code: 'TOO_MANY' });

  const results = [];
  let imported = 0;
  let failed = 0;
  for (const rec of importRecords) {
    try {
      if (!rec.album || !rec.artist) { failed++; results.push({ album: rec.album, error: 'album and artist required' }); continue; }
      const r = await pool.query(
        'INSERT INTO records (user_id, album, artist, year, format, label, condition, for_sale, price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, album, artist',
        [req.user.username, rec.album, rec.artist, rec.year || '', rec.format || 'LP', rec.label || '', rec.condition || 'VG+', rec.forSale || false, rec.price || '0']
      );
      imported++;
      results.push({ id: r.rows[0].id, album: r.rows[0].album, artist: r.rows[0].artist, success: true });
    } catch (err) {
      failed++;
      results.push({ album: rec.album, error: err.message });
    }
  }
  await logActivity(req.user.username, 'bulk_import', { imported, failed });
  res.json({ imported, failed, total: importRecords.length, results });
});

// ── Improvement 13: User blocking/muting system ──────────────────────────────
app.post('/api/blocks', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  if (username === req.user.username) return res.status(400).json({ error: 'Cannot block yourself' });
  try {
    await pool.query(
      'INSERT INTO user_blocks (blocker, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.username, username]
    );
    res.json({ ok: true, blocked: username });
  } catch (err) {
    console.error('Block error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/blocks/:username', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    await pool.query('DELETE FROM user_blocks WHERE blocker = $1 AND blocked = $2', [req.user.username, req.params.username]);
    res.json({ ok: true, unblocked: req.params.username });
  } catch (err) {
    console.error('Unblock error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/blocks', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query('SELECT blocked, created_at FROM user_blocks WHERE blocker = $1 ORDER BY created_at DESC', [req.user.username]);
    res.json({ blocked: result.rows });
  } catch (err) {
    console.error('List blocks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 14: Content moderation queue ──────────────────────────────────
app.post('/api/moderation/report', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { targetType, targetId, reason } = req.body;
  if (!targetType || !targetId) return res.status(400).json({ error: 'targetType and targetId are required' });
  if (!['record', 'post', 'comment', 'user'].includes(targetType)) return res.status(400).json({ error: 'Invalid target type' });
  try {
    const result = await pool.query(
      'INSERT INTO moderation_queue (reported_by, target_type, target_id, reason) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.username, targetType, targetId, reason || '']
    );
    res.json({ ok: true, report: result.rows[0] });
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/moderation/queue', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const status = req.query.status || 'pending';
    const result = await pool.query(
      'SELECT * FROM moderation_queue WHERE status = $1 ORDER BY created_at DESC LIMIT 50',
      [status]
    );
    res.json({ reports: result.rows });
  } catch (err) {
    console.error('Moderation queue error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 15: Record condition verification log ─────────────────────────
app.post('/api/records/:id/verify-condition', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID' });
  const { grade, notes } = req.body;
  if (!grade) return res.status(400).json({ error: 'Grade is required' });
  try {
    const record = await pool.query('SELECT id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });

    const result = await pool.query(
      'INSERT INTO condition_verification_log (record_id, verified_by, grade, notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [recordId, req.user.username, grade, notes || '']
    );
    res.json({ verification: result.rows[0] });
  } catch (err) {
    console.error('Condition verify error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/records/:id/condition-log', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID' });
  try {
    const result = await pool.query(
      'SELECT * FROM condition_verification_log WHERE record_id = $1 ORDER BY created_at DESC',
      [recordId]
    );
    res.json({ log: result.rows });
  } catch (err) {
    console.error('Condition log error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 16: Offer negotiation history ────────────────────────────────
app.post('/api/offers/:id/counter', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const offerId = parseInt(req.params.id);
  if (!Number.isFinite(offerId) || offerId <= 0) return res.status(400).json({ error: 'Invalid offer ID' });
  const { counterPrice, message } = req.body;
  if (!counterPrice) return res.status(400).json({ error: 'counterPrice is required' });
  try {
    const offer = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
    if (offer.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    const o = offer.rows[0];
    if (o.from_user !== req.user.username && o.to_user !== req.user.username) return res.status(403).json({ error: 'Not your offer' });
    if (o.status !== 'pending') return res.status(400).json({ error: 'Offer is no longer pending' });

    const result = await pool.query(
      'INSERT INTO offer_negotiations (offer_id, user_id, counter_price, message) VALUES ($1,$2,$3,$4) RETURNING *',
      [offerId, req.user.username, counterPrice, message || '']
    );
    await pool.query('UPDATE offers SET price = $1 WHERE id = $2', [counterPrice, offerId]);
    res.json({ negotiation: result.rows[0] });
  } catch (err) {
    console.error('Counter offer error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/offers/:id/history', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const offerId = parseInt(req.params.id);
  if (!Number.isFinite(offerId) || offerId <= 0) return res.status(400).json({ error: 'Invalid offer ID' });
  try {
    const offer = await pool.query('SELECT * FROM offers WHERE id = $1', [offerId]);
    if (offer.rows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    const o = offer.rows[0];
    if (o.from_user !== req.user.username && o.to_user !== req.user.username) return res.status(403).json({ error: 'Not your offer' });

    const result = await pool.query(
      'SELECT * FROM offer_negotiations WHERE offer_id = $1 ORDER BY created_at ASC',
      [offerId]
    );
    res.json({ offer: o, negotiations: result.rows });
  } catch (err) {
    console.error('Offer history error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 17: Shipping address validation ──────────────────────────────
app.post('/api/shipping/validate', authMiddleware, (req, res) => {
  const { name, street, city, state, zip } = req.body;
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters');
  if (!street || street.trim().length < 5) errors.push('Street address must be at least 5 characters');
  if (!city || city.trim().length < 2) errors.push('City is required');
  if (!state || !/^[A-Za-z]{2}$/.test(state.trim())) errors.push('State must be a 2-letter code');
  if (!zip || !/^\d{5}(-\d{4})?$/.test(zip.trim())) errors.push('ZIP must be 5 digits (or 5+4 format)');

  if (errors.length > 0) return res.json({ valid: false, errors });
  res.json({
    valid: true,
    normalized: {
      name: name.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip: zip.trim(),
    },
  });
});

// ── Improvement 18: Tax calculation endpoint ─────────────────────────────────
app.get('/api/tax/calculate', (req, res) => {
  const price = parseFloat(req.query.price) || 0;
  const state = String(req.query.state || '').toUpperCase();

  // Simplified state sales tax rates
  const stateTaxRates = {
    CA: 0.0725, NY: 0.08, TX: 0.0625, FL: 0.06, IL: 0.0625,
    PA: 0.06, OH: 0.0575, GA: 0.04, NC: 0.0475, MI: 0.06,
    NJ: 0.06625, VA: 0.053, WA: 0.065, AZ: 0.056, MA: 0.0625,
    TN: 0.07, IN: 0.07, MO: 0.04225, MD: 0.06, WI: 0.05,
    CO: 0.029, MN: 0.06875, SC: 0.06, AL: 0.04, LA: 0.0445,
    KY: 0.06, OR: 0, NH: 0, MT: 0, DE: 0, AK: 0,
  };

  const rate = stateTaxRates[state] || 0;
  const tax = Math.round(price * rate * 100) / 100;

  res.json({
    price,
    state: state || 'unknown',
    taxRate: rate,
    taxAmount: tax,
    total: Math.round((price + tax) * 100) / 100,
  });
});

// ── Improvement 19: Coupon/promo code system ─────────────────────────────────
app.post('/api/promo/validate', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { code, price } = req.body;
  if (!code) return res.status(400).json({ error: 'Promo code is required' });
  try {
    const result = await pool.query('SELECT * FROM promo_codes WHERE code = $1', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.json({ valid: false, error: 'Invalid promo code' });

    const promo = result.rows[0];
    if (promo.max_uses > 0 && promo.current_uses >= promo.max_uses) return res.json({ valid: false, error: 'Promo code has reached maximum uses' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.json({ valid: false, error: 'Promo code has expired' });

    const originalPrice = parseFloat(price) || 0;
    let discount = 0;
    if (promo.discount_percent > 0) {
      discount = Math.round(originalPrice * (promo.discount_percent / 100) * 100) / 100;
    } else if (parseFloat(promo.discount_amount) > 0) {
      discount = Math.min(parseFloat(promo.discount_amount), originalPrice);
    }

    res.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discount_percent,
      discountAmount: discount,
      finalPrice: Math.round((originalPrice - discount) * 100) / 100,
    });
  } catch (err) {
    console.error('Promo validate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/promo/create', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { code, discountPercent, discountAmount, maxUses, expiresAt } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  try {
    const result = await pool.query(
      'INSERT INTO promo_codes (code, discount_percent, discount_amount, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [code.toUpperCase(), discountPercent || 0, discountAmount || '0', maxUses || 0, expiresAt || null]
    );
    res.json({ promo: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Promo code already exists' });
    console.error('Promo create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 20: Referral tracking ─────────────────────────────────────────
app.post('/api/referrals', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { referredUsername } = req.body;
  if (!referredUsername) return res.status(400).json({ error: 'referredUsername is required' });
  if (referredUsername === req.user.username) return res.status(400).json({ error: 'Cannot refer yourself' });
  try {
    const result = await pool.query(
      'INSERT INTO referrals (referrer, referred) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING *',
      [req.user.username, referredUsername]
    );
    if (result.rows.length === 0) return res.json({ ok: false, message: 'Referral already exists' });
    res.json({ ok: true, referral: result.rows[0] });
  } catch (err) {
    console.error('Referral error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/referrals', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM referrals WHERE referrer = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ referrals: result.rows, totalReferred: result.rows.length });
  } catch (err) {
    console.error('List referrals error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 21: User session management ──────────────────────────────────
const activeSessions = new Map(); // username -> [{ token, ip, userAgent, loginAt }]

app.get('/api/auth/sessions', authMiddleware, (req, res) => {
  const sessions = activeSessions.get(req.user.username) || [];
  res.json({
    sessions: sessions.map(s => ({
      ip: s.ip,
      userAgent: s.userAgent,
      loginAt: s.loginAt,
      current: s.token === req.headers.authorization?.slice(7),
    })),
  });
});

app.delete('/api/auth/sessions', authMiddleware, (req, res) => {
  const currentToken = req.headers.authorization?.slice(7);
  const sessions = activeSessions.get(req.user.username) || [];
  // Keep only the current session
  activeSessions.set(req.user.username, sessions.filter(s => s.token === currentToken));
  res.json({ ok: true, message: 'All other sessions revoked' });
});

// ── Improvement 22: API key generation for developers ─────────────────────────
const crypto = require('crypto');

app.post('/api/developer/keys', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { name } = req.body;
  try {
    const rawKey = `gs_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const result = await pool.query(
      'INSERT INTO api_keys (user_id, key_hash, name) VALUES ($1,$2,$3) RETURNING id, name, created_at',
      [req.user.username, keyHash, name || 'Unnamed Key']
    );
    res.json({ key: rawKey, id: result.rows[0].id, name: result.rows[0].name, createdAt: result.rows[0].created_at, warning: 'Store this key securely. It will not be shown again.' });
  } catch (err) {
    console.error('API key creation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/developer/keys', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT id, name, last_used_at, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ keys: result.rows });
  } catch (err) {
    console.error('List API keys error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/developer/keys/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'API key not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete API key error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 23: Webhook system for notifications ──────────────────────────
app.post('/api/webhooks', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { url, events } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const secret = crypto.randomBytes(24).toString('hex');
    const result = await pool.query(
      'INSERT INTO webhooks (user_id, url, events, secret) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.username, url, events || ['record.created', 'offer.received'], secret]
    );
    res.json({ webhook: result.rows[0] });
  } catch (err) {
    console.error('Create webhook error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/webhooks', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT id, url, events, active, created_at FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ webhooks: result.rows });
  } catch (err) {
    console.error('List webhooks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/webhooks/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete webhook error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 24: Data backup endpoint ──────────────────────────────────────
app.get('/api/account/export', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const [profile, records, posts, offers, purchases, wishlist] = await Promise.all([
      pool.query('SELECT id, username, display_name, bio, location, fav_genre, avatar_url, created_at FROM profiles WHERE id = $1', [req.user.id]),
      pool.query('SELECT * FROM records WHERE user_id = $1', [req.user.username]),
      pool.query('SELECT * FROM posts WHERE user_id = $1', [req.user.username]),
      pool.query('SELECT * FROM offers WHERE from_user = $1 OR to_user = $1', [req.user.username]),
      pool.query('SELECT * FROM purchases WHERE buyer = $1 OR seller = $1', [req.user.username]),
      pool.query('SELECT * FROM wishlist WHERE user_id = $1', [req.user.username]),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      profile: profile.rows[0] || null,
      records: records.rows,
      posts: posts.rows,
      offers: offers.rows,
      purchases: purchases.rows,
      wishlist: wishlist.rows,
    });
  } catch (err) {
    console.error('Data export error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 25: Search suggestions/autocomplete ──────────────────────────
app.get('/api/search/suggestions', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  try {
    const pattern = `${q.toLowerCase()}%`;
    const [artists, albums, users] = await Promise.all([
      pool.query('SELECT DISTINCT artist FROM records WHERE LOWER(artist) LIKE $1 LIMIT 5', [pattern]),
      pool.query('SELECT DISTINCT album FROM records WHERE LOWER(album) LIKE $1 LIMIT 5', [pattern]),
      pool.query('SELECT username FROM profiles WHERE LOWER(username) LIKE $1 LIMIT 5', [pattern]),
    ]);
    res.json({
      suggestions: [
        ...artists.rows.map(r => ({ type: 'artist', value: r.artist })),
        ...albums.rows.map(r => ({ type: 'album', value: r.album })),
        ...users.rows.map(r => ({ type: 'user', value: r.username })),
      ],
    });
  } catch (err) {
    console.error('Suggestions error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 26: Price alert system ────────────────────────────────────────
app.post('/api/price-alerts', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { artist, album, maxPrice } = req.body;
  if (!artist || !maxPrice) return res.status(400).json({ error: 'artist and maxPrice are required' });
  try {
    const result = await pool.query(
      'INSERT INTO price_alerts (user_id, artist, album, max_price) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.username, artist, album || '', maxPrice]
    );
    res.json({ alert: result.rows[0] });
  } catch (err) {
    console.error('Price alert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/price-alerts', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM price_alerts WHERE user_id = $1 AND active = true ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    console.error('List price alerts error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/price-alerts/:id', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'UPDATE price_alerts SET active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete price alert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/price-alerts/check', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const alerts = await pool.query(
      'SELECT * FROM price_alerts WHERE user_id = $1 AND active = true',
      [req.user.username]
    );
    const matches = [];
    for (const alert of alerts.rows) {
      const conditions = ['for_sale = true', 'user_id != $1', 'LOWER(artist) LIKE $2'];
      const params = [req.user.username, `%${alert.artist.toLowerCase()}%`];
      let idx = 3;
      if (alert.album) {
        conditions.push(`LOWER(album) LIKE $${idx++}`);
        params.push(`%${alert.album.toLowerCase()}%`);
      }
      conditions.push(`CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC) <= $${idx++}`);
      params.push(parseFloat(alert.max_price));

      const result = await pool.query(
        `SELECT id, album, artist, price, condition FROM records WHERE ${conditions.join(' AND ')} LIMIT 5`,
        params
      );
      if (result.rows.length > 0) {
        matches.push({ alert: { id: alert.id, artist: alert.artist, album: alert.album, maxPrice: alert.max_price }, records: result.rows });
      }
    }
    res.json({ matches });
  } catch (err) {
    console.error('Price alert check error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 27: Collection sharing (public links) ────────────────────────
app.post('/api/collection/share', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const shareToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = req.body.expiresInDays
      ? new Date(Date.now() + parseInt(req.body.expiresInDays) * 86400000).toISOString()
      : null;
    const result = await pool.query(
      'INSERT INTO collection_shares (user_id, share_token, expires_at) VALUES ($1,$2,$3) RETURNING *',
      [req.user.username, shareToken, expiresAt]
    );
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({ shareUrl: `${frontendUrl}/collection/${shareToken}`, share: result.rows[0] });
  } catch (err) {
    console.error('Collection share error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/collection/shared/:token', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const share = await pool.query(
      'SELECT * FROM collection_shares WHERE share_token = $1',
      [req.params.token]
    );
    if (share.rows.length === 0) return res.status(404).json({ error: 'Share link not found' });
    const s = share.rows[0];
    if (s.expires_at && new Date(s.expires_at) < new Date()) return res.status(410).json({ error: 'Share link has expired' });

    const records = await pool.query(
      'SELECT id, album, artist, year, format, condition, accent, verified FROM records WHERE user_id = $1 ORDER BY created_at DESC',
      [s.user_id]
    );
    res.json({ username: s.user_id, records: records.rows, sharedAt: s.created_at });
  } catch (err) {
    console.error('Shared collection error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Improvement 28: Import from Discogs endpoint ──────────────────────────────
app.post('/api/records/import-discogs', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { discogsUsername } = req.body;
  if (!discogsUsername) return res.status(400).json({ error: 'discogsUsername is required' });

  const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;
  const userAgent = 'GrooveStack/1.0 +https://groovestack.vercel.app';

  try {
    const collectionUrl = `https://api.discogs.com/users/${encodeURIComponent(discogsUsername)}/collection/folders/0/releases?per_page=50${DISCOGS_TOKEN ? `&token=${DISCOGS_TOKEN}` : ''}`;
    const resp = await fetch(collectionUrl, { headers: { 'User-Agent': userAgent } });
    if (!resp.ok) return res.status(resp.status === 404 ? 404 : 502).json({ error: resp.status === 404 ? 'Discogs user not found' : 'Discogs API error' });

    const data = await resp.json();
    if (!data.releases || data.releases.length === 0) return res.json({ imported: 0, message: 'No releases found in Discogs collection' });

    let imported = 0;
    const results = [];
    for (const release of data.releases.slice(0, 50)) {
      const info = release.basic_information || {};
      const album = info.title || '';
      const artist = (info.artists || []).map(a => a.name).join(', ') || 'Unknown';
      const year = String(info.year || '');
      const label = (info.labels || []).map(l => l.name).join(', ') || '';
      const formats = (info.formats || []).map(f => f.name).join(', ') || 'Vinyl';

      if (!album) continue;
      try {
        const r = await pool.query(
          'INSERT INTO records (user_id, album, artist, year, format, label, condition) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, album, artist',
          [req.user.username, album, artist, year, formats, label, 'VG+']
        );
        imported++;
        results.push({ id: r.rows[0].id, album, artist, success: true });
      } catch (err) {
        results.push({ album, artist, error: err.message });
      }
    }
    await logActivity(req.user.username, 'discogs_import', { discogsUsername, imported });
    res.json({ imported, total: data.releases.length, results });
  } catch (err) {
    console.error('Discogs import error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

// ── Improvement 29: Record grading AI endpoint (placeholder) ──────────────────
app.post('/api/records/ai-grade', authMiddleware, async (req, res) => {
  const { imageBase64, mediaType = 'image/jpeg' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image data provided' });

  try {
    const gradePrompt = `You are a vinyl record grading expert. Examine this image of a vinyl record and assess its condition using the Goldmine grading standard. Respond with ONLY valid JSON — no markdown, no code fences:
{"grade": "M/NM/VG+/VG/G+/G/F/P", "confidence": 0-100, "notes": "Brief explanation of visible condition issues or lack thereof"}`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: gradePrompt },
        ],
      }],
    });

    const raw = response.content[0].text.trim();
    const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(cleaned);
    res.json({ grading: result });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.json({ grading: { grade: 'Unknown', confidence: 0, notes: 'Could not analyze the image. Try again with better lighting.' } });
    }
    console.error('AI grading error:', err.message);
    res.status(500).json({ error: 'Grading service unavailable' });
  }
});

// ── Improvement 30: Enhanced health check with dependency status ──────────────
app.get('/api/health/detailed', async (_req, res) => {
  const checks = {};

  // Database check
  if (pool) {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      checks.database = { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      checks.database = { status: 'unhealthy', error: err.message };
    }
  } else {
    checks.database = { status: 'not_configured' };
  }

  // Stripe check
  checks.stripe = { status: stripe ? 'configured' : 'not_configured' };

  // Anthropic AI check
  checks.anthropic = { status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured' };

  // AudD check
  checks.audd = { status: AUDD_API_TOKEN ? 'configured' : 'not_configured' };

  // Discogs check
  checks.discogs = { status: process.env.DISCOGS_TOKEN ? 'configured' : 'not_configured' };

  // Memory usage
  const mem = process.memoryUsage();
  checks.memory = {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
    unit: 'MB',
  };

  // In-memory state
  checks.inMemory = {
    vinylSessions: vinylSessions.length,
    devices: devicesById.size,
    pairedDevices: pairedDevices.size,
    rateLimitBuckets: rateLimitBuckets.size,
    activeSessions: activeSessions.size,
  };

  const uptimeSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const allHealthy = Object.values(checks).every(c => c.status !== 'unhealthy');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    uptime: uptimeSec,
    uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// ── In-memory stores for new features ─────────────────────────────────────────
const recordViewCounts = new Map(); // recordId -> count
const apiResponseTimes = []; // [{ endpoint, method, durationMs, timestamp }]
const MAX_RESPONSE_TIME_ENTRIES = 5000;
const endpointRateLimits = new Map(); // endpoint-specific rate limit overrides

// ── Feature 1: Record view tracking ──────────────────────────────────────────

// POST /api/records/:id/view — track a view on a record
app.post('/api/records/:id/view', async (req, res) => {
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });

  // Increment in-memory counter
  recordViewCounts.set(recordId, (recordViewCounts.get(recordId) || 0) + 1);

  if (pool) {
    try {
      const record = await pool.query('SELECT id FROM records WHERE id = $1', [recordId]);
      if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });

      const viewerIp = req.ip || req.connection.remoteAddress || '';
      const viewerUser = req.headers.authorization ? '' : ''; // anonymous by default
      // Try to extract username from token if present
      let viewerUsername = '';
      try {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) {
          const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
          viewerUsername = decoded.username || '';
        }
      } catch { /* anonymous view */ }

      await pool.query(
        'INSERT INTO record_views (record_id, viewer_ip, viewer_user) VALUES ($1, $2, $3)',
        [recordId, viewerIp, viewerUsername]
      );
    } catch (err) {
      console.error('Record view tracking error:', err.message);
    }
  }

  res.json({ ok: true, views: recordViewCounts.get(recordId) || 1 });
});

// GET /api/records/:id/views — get view count for a record
app.get('/api/records/:id/views', async (req, res) => {
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });

  let totalViews = recordViewCounts.get(recordId) || 0;

  if (pool) {
    try {
      const result = await pool.query('SELECT COUNT(*) AS count FROM record_views WHERE record_id = $1', [recordId]);
      totalViews = Math.max(totalViews, parseInt(result.rows[0].count));
    } catch (err) {
      console.error('Record views fetch error:', err.message);
    }
  }

  res.json({ recordId, views: totalViews });
});

// ── Feature 2: User reputation system ────────────────────────────────────────

// GET /api/users/:username/reputation — calculate reputation score
app.get('/api/users/:username/reputation', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const username = req.params.username.toLowerCase();
  try {
    const [salesResult, reviewsResult, disputesResult, purchasesResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM purchases WHERE seller = $1 AND status = \'paid\'', [username]),
      pool.query('SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg_rating FROM records WHERE user_id = $1 AND rating > 0', [username]),
      pool.query('SELECT COUNT(*) AS count FROM disputes WHERE against = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM purchases WHERE buyer = $1 AND status = \'paid\'', [username]),
    ]);

    const completedSales = parseInt(salesResult.rows[0].count);
    const completedPurchases = parseInt(purchasesResult.rows[0].count);
    const avgRating = parseFloat(reviewsResult.rows[0].avg_rating) || 0;
    const disputeCount = parseInt(disputesResult.rows[0].count);

    // Score: base 50 + sales*2 + purchases*1 + avgRating*5 - disputes*15, clamped 0-100
    const rawScore = 50 + (completedSales * 2) + (completedPurchases * 1) + (avgRating * 5) - (disputeCount * 15);
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let level = 'newcomer';
    if (score >= 90) level = 'trusted';
    else if (score >= 70) level = 'established';
    else if (score >= 50) level = 'active';

    res.json({
      username,
      reputationScore: score,
      level,
      breakdown: { completedSales, completedPurchases, avgRating: Math.round(avgRating * 100) / 100, disputeCount },
    });
  } catch (err) {
    console.error('Reputation error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 3: Record authenticity verification queue ────────────────────────

// POST /api/records/:id/authenticity — submit record for authenticity verification
app.post('/api/records/:id/authenticity', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const record = await pool.query('SELECT id, user_id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });

    // Check if already in queue
    const existing = await pool.query(
      'SELECT id, status FROM authenticity_queue WHERE record_id = $1 AND status = \'pending\'',
      [recordId]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Record is already in the verification queue', queueId: existing.rows[0].id });

    const result = await pool.query(
      'INSERT INTO authenticity_queue (record_id, submitted_by) VALUES ($1, $2) RETURNING *',
      [recordId, req.user.username]
    );
    res.json({ ok: true, submission: result.rows[0] });
  } catch (err) {
    console.error('Authenticity submit error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/authenticity/queue — list pending authenticity verifications
app.get('/api/authenticity/queue', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT aq.*, r.album, r.artist, r.label, r.year FROM authenticity_queue aq
       LEFT JOIN records r ON r.id = aq.record_id
       WHERE aq.status = $1 ORDER BY aq.created_at ASC LIMIT $2`,
      [status, limit]
    );
    res.json({ queue: result.rows });
  } catch (err) {
    console.error('Authenticity queue error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/authenticity/:id/review — review an authenticity submission
app.put('/api/authenticity/:id/review', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { status, notes } = req.body;
  if (!status || !['verified', 'rejected', 'needs_info'].includes(status)) {
    return res.status(400).json({ error: 'Status must be verified, rejected, or needs_info' });
  }
  try {
    const result = await pool.query(
      'UPDATE authenticity_queue SET status = $1, reviewer = $2, notes = $3, reviewed_at = now() WHERE id = $4 RETURNING *',
      [status, req.user.username, notes || '', req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Submission not found' });

    // If verified, update the record's verified flag
    if (status === 'verified') {
      await pool.query('UPDATE records SET verified = true WHERE id = $1', [result.rows[0].record_id]);
    }
    res.json({ ok: true, submission: result.rows[0] });
  } catch (err) {
    console.error('Authenticity review error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 4: Shipping rate calculator ──────────────────────────────────────

// GET /api/shipping/rate — calculate shipping rate by weight and distance
app.get('/api/shipping/rate', (req, res) => {
  const weightOz = parseFloat(req.query.weight) || 8; // default 8oz for a single LP
  const distanceMiles = parseFloat(req.query.distance) || 500;
  const method = String(req.query.method || 'standard').toLowerCase();

  // Base rates per method
  const rates = {
    standard: { base: 4.00, perOz: 0.15, perMile: 0.002, estimatedDays: '5-7' },
    priority: { base: 7.50, perOz: 0.20, perMile: 0.003, estimatedDays: '2-3' },
    express: { base: 15.00, perOz: 0.30, perMile: 0.005, estimatedDays: '1-2' },
  };

  const rate = rates[method] || rates.standard;
  const cost = rate.base + (weightOz * rate.perOz) + (distanceMiles * rate.perMile);
  const roundedCost = Math.round(cost * 100) / 100;

  res.json({
    weightOz,
    distanceMiles,
    method: method in rates ? method : 'standard',
    cost: roundedCost,
    estimatedDays: rate.estimatedDays,
    breakdown: {
      baseFee: rate.base,
      weightFee: Math.round(weightOz * rate.perOz * 100) / 100,
      distanceFee: Math.round(distanceMiles * rate.perMile * 100) / 100,
    },
  });
});

// ── Feature 5: Order cancellation with reason ────────────────────────────────

// POST /api/orders/:id/cancel — cancel an order with a reason
app.post('/api/orders/:id/cancel', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const purchaseId = parseInt(req.params.id);
  if (!Number.isFinite(purchaseId) || purchaseId <= 0) return res.status(400).json({ error: 'Invalid order ID', code: 'INVALID_ID' });
  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A cancellation reason of at least 5 characters is required', code: 'MISSING_REASON' });
  }
  try {
    const purchase = await pool.query('SELECT * FROM purchases WHERE id = $1', [purchaseId]);
    if (purchase.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const p = purchase.rows[0];
    if (p.buyer !== req.user.username && p.seller !== req.user.username) {
      return res.status(403).json({ error: 'Not your order' });
    }
    if (p.cancelled) return res.status(400).json({ error: 'Order is already cancelled' });
    if (p.status === 'shipped' || p.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot cancel an order that has been shipped or delivered' });
    }

    await pool.query('UPDATE purchases SET cancelled = true, status = \'cancelled\' WHERE id = $1', [purchaseId]);
    await pool.query(
      'INSERT INTO order_cancellations (purchase_id, cancelled_by, reason) VALUES ($1, $2, $3)',
      [purchaseId, req.user.username, reason.trim()]
    );

    // Re-list the record if it was taken off sale
    if (p.record_id) {
      await pool.query('UPDATE records SET for_sale = true WHERE id = $1', [p.record_id]);
    }

    console.log(`[EMAIL_TRIGGER] Order #${purchaseId} cancelled by ${req.user.username}. Notify: ${p.buyer}, ${p.seller}`);
    res.json({ ok: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('Cancel order error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 6: Automated email notification triggers (console placeholder) ───

// POST /api/notifications/email-trigger — trigger an email notification (logs to console)
app.post('/api/notifications/email-trigger', authMiddleware, async (req, res) => {
  const { recipientUsername, eventType, subject, body } = req.body;
  if (!recipientUsername || !eventType) {
    return res.status(400).json({ error: 'recipientUsername and eventType are required', code: 'MISSING_FIELDS' });
  }

  const validEvents = ['order_confirmed', 'order_shipped', 'order_cancelled', 'offer_received', 'offer_accepted', 'new_follower', 'price_drop', 'wishlist_match'];
  if (!validEvents.includes(eventType)) {
    return res.status(400).json({ error: `Invalid eventType. Must be one of: ${validEvents.join(', ')}`, code: 'INVALID_EVENT' });
  }

  // Placeholder: log to console instead of sending actual email
  console.log(`[EMAIL_TRIGGER] Event: ${eventType} | To: ${recipientUsername} | Subject: ${subject || eventType} | Body: ${(body || '').slice(0, 100)}`);

  // Also create an in-app notification if DB is available
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO notifications (user_id, type, title, body) VALUES ($1, $2, $3, $4)',
        [recipientUsername, eventType, subject || eventType, body || '']
      );
    } catch (err) {
      console.error('Email trigger notification error:', err.message);
    }
  }

  res.json({ ok: true, message: 'Email notification triggered (logged to console)', eventType, recipient: recipientUsername });
});

// ── Feature 7: Record condition change history ───────────────────────────────

// POST /api/records/:id/condition-change — log a condition change
app.post('/api/records/:id/condition-change', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  const { newCondition, reason } = req.body;
  if (!newCondition) return res.status(400).json({ error: 'newCondition is required', code: 'MISSING_FIELDS' });

  const validConditions = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'F', 'P'];
  if (!validConditions.includes(newCondition)) {
    return res.status(400).json({ error: `Condition must be one of: ${validConditions.join(', ')}`, code: 'INVALID_CONDITION' });
  }

  try {
    const record = await pool.query('SELECT id, user_id, condition FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (record.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    const oldCondition = record.rows[0].condition;
    if (oldCondition === newCondition) return res.status(400).json({ error: 'Condition is unchanged' });

    await pool.query(
      'INSERT INTO condition_change_history (record_id, old_condition, new_condition, changed_by, reason) VALUES ($1, $2, $3, $4, $5)',
      [recordId, oldCondition, newCondition, req.user.username, reason || '']
    );
    await pool.query('UPDATE records SET condition = $1, updated_at = now() WHERE id = $2', [newCondition, recordId]);

    res.json({ ok: true, oldCondition, newCondition });
  } catch (err) {
    console.error('Condition change error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/records/:id/condition-history — get condition change history
app.get('/api/records/:id/condition-history', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const result = await pool.query(
      'SELECT * FROM condition_change_history WHERE record_id = $1 ORDER BY created_at DESC',
      [recordId]
    );
    res.json({ history: result.rows });
  } catch (err) {
    console.error('Condition history error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 8: User preferences storage ──────────────────────────────────────

// GET /api/preferences — get user preferences
app.get('/api/preferences', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [req.user.username]);
    res.json({ preferences: result.rows.length > 0 ? result.rows[0].preferences : {} });
  } catch (err) {
    console.error('Get preferences error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/preferences — update user preferences
app.put('/api/preferences', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { preferences } = req.body;
  if (!preferences || typeof preferences !== 'object') return res.status(400).json({ error: 'preferences object is required', code: 'MISSING_FIELDS' });
  try {
    await pool.query(
      `INSERT INTO user_preferences (user_id, preferences, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET preferences = $2, updated_at = now()`,
      [req.user.username, JSON.stringify(preferences)]
    );
    res.json({ ok: true, preferences });
  } catch (err) {
    console.error('Update preferences error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 9: Marketplace fee calculator ────────────────────────────────────

// GET /api/marketplace/fee-calculator — calculate marketplace fees for a sale
app.get('/api/marketplace/fee-calculator', (req, res) => {
  const price = parseFloat(req.query.price) || 0;
  if (price <= 0) return res.status(400).json({ error: 'Price must be positive', code: 'INVALID_PRICE' });

  const platformFeePercent = 0.05; // 5%
  const platformFeeMin = 1.00;
  const platformFee = Math.max(Math.round(price * platformFeePercent * 100) / 100, platformFeeMin);
  const paymentProcessingPercent = 0.029; // 2.9% Stripe
  const paymentProcessingFixed = 0.30;
  const paymentFee = Math.round((price * paymentProcessingPercent + paymentProcessingFixed) * 100) / 100;
  const shippingFee = SHIPPING_FEE_CENTS / 100;
  const totalFees = Math.round((platformFee + paymentFee) * 100) / 100;
  const sellerPayout = Math.round((price - totalFees) * 100) / 100;
  const buyerTotal = Math.round((price + shippingFee + platformFee) * 100) / 100;

  res.json({
    listingPrice: price,
    platformFee,
    platformFeePercent: platformFeePercent * 100,
    paymentProcessingFee: paymentFee,
    shippingFee,
    totalFees,
    sellerPayout,
    buyerTotal,
  });
});

// ── Feature 10: Record availability checker ──────────────────────────────────

// GET /api/records/:id/availability — check if a record is still for sale
app.get('/api/records/:id/availability', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const record = await pool.query('SELECT id, for_sale, price, condition, user_id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });

    const r = record.rows[0];
    // Check if there's a pending/paid purchase for this record
    const pendingPurchase = await pool.query(
      'SELECT id FROM purchases WHERE record_id = $1 AND status IN (\'pending\', \'paid\') AND cancelled = false',
      [recordId]
    );
    const hasPendingPurchase = pendingPurchase.rows.length > 0;

    res.json({
      recordId,
      available: r.for_sale && !hasPendingPurchase,
      forSale: r.for_sale,
      hasPendingPurchase,
      price: r.price,
      condition: r.condition,
      seller: r.user_id,
    });
  } catch (err) {
    console.error('Availability check error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 11: Bulk price update ────────────────────────────────────────────

// PUT /api/records/bulk-price — update prices for multiple records at once
app.put('/api/records/bulk-price', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates array is required', code: 'MISSING_FIELDS' });
  if (updates.length > 50) return res.status(400).json({ error: 'Maximum 50 price updates per request', code: 'TOO_MANY' });

  const results = [];
  let updated = 0;
  let failed = 0;
  for (const { id, price } of updates) {
    try {
      if (!id || !price || parseFloat(price) < 0) {
        failed++;
        results.push({ id, success: false, error: 'Invalid id or price' });
        continue;
      }
      const record = await pool.query('SELECT id, user_id, price FROM records WHERE id = $1', [id]);
      if (record.rows.length === 0 || record.rows[0].user_id !== req.user.username) {
        failed++;
        results.push({ id, success: false, error: 'Record not found or not owned' });
        continue;
      }

      // Log old price to price history
      await pool.query(
        'INSERT INTO price_history (record_id, price, changed_by) VALUES ($1, $2, $3)',
        [id, record.rows[0].price, req.user.username]
      );
      await pool.query('UPDATE records SET price = $1, updated_at = now() WHERE id = $2', [price, id]);
      updated++;
      results.push({ id, success: true, oldPrice: record.rows[0].price, newPrice: price });
    } catch (err) {
      failed++;
      results.push({ id, success: false, error: err.message });
    }
  }
  res.json({ updated, failed, total: updates.length, results });
});

// ── Feature 12: User dashboard stats ─────────────────────────────────────────

// GET /api/dashboard/stats — comprehensive dashboard stats for current user
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const username = req.user.username;
    const [
      recordsResult, forSaleResult, salesResult, purchasesResult,
      offersReceivedResult, offersSentResult, followersResult, followingResult,
      unreadNotifResult, wishlistResult, likesReceivedResult,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM records WHERE user_id = $1', [username]),
      pool.query('SELECT COUNT(*) AS count, COALESCE(SUM(CAST(COALESCE(NULLIF(price,\'\'), \'0\') AS NUMERIC)), 0) AS total_value FROM records WHERE user_id = $1 AND for_sale = true', [username]),
      pool.query('SELECT COUNT(*) AS count, COALESCE(SUM(CAST(COALESCE(NULLIF(price,\'\'), \'0\') AS NUMERIC)), 0) AS total_revenue FROM purchases WHERE seller = $1 AND status = \'paid\'', [username]),
      pool.query('SELECT COUNT(*) AS count, COALESCE(SUM(CAST(COALESCE(NULLIF(price,\'\'), \'0\') AS NUMERIC)), 0) AS total_spent FROM purchases WHERE buyer = $1 AND status = \'paid\'', [username]),
      pool.query('SELECT COUNT(*) AS count FROM offers WHERE to_user = $1 AND status = \'pending\'', [username]),
      pool.query('SELECT COUNT(*) AS count FROM offers WHERE from_user = $1 AND status = \'pending\'', [username]),
      pool.query('SELECT COUNT(*) AS count FROM follows WHERE following = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM follows WHERE follower = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = false', [username]),
      pool.query('SELECT COUNT(*) AS count FROM wishlist WHERE user_id = $1', [username]),
      pool.query('SELECT COUNT(*) AS count FROM record_likes rl JOIN records r ON r.id = rl.record_id WHERE r.user_id = $1', [username]),
    ]);

    res.json({
      username,
      collection: {
        totalRecords: parseInt(recordsResult.rows[0].count),
        forSale: parseInt(forSaleResult.rows[0].count),
        totalListingValue: parseFloat(forSaleResult.rows[0].total_value),
      },
      trading: {
        completedSales: parseInt(salesResult.rows[0].count),
        totalRevenue: parseFloat(salesResult.rows[0].total_revenue),
        completedPurchases: parseInt(purchasesResult.rows[0].count),
        totalSpent: parseFloat(purchasesResult.rows[0].total_spent),
        pendingOffersReceived: parseInt(offersReceivedResult.rows[0].count),
        pendingOffersSent: parseInt(offersSentResult.rows[0].count),
      },
      social: {
        followers: parseInt(followersResult.rows[0].count),
        following: parseInt(followingResult.rows[0].count),
        likesReceived: parseInt(likesReceivedResult.rows[0].count),
      },
      unreadNotifications: parseInt(unreadNotifResult.rows[0].count),
      wishlistItems: parseInt(wishlistResult.rows[0].count),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 13: Record comparison ────────────────────────────────────────────

// GET /api/records/compare?ids=1,2 — compare two records side by side
app.get('/api/records/compare', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const ids = String(req.query.ids || '').split(',').map(id => parseInt(id.trim())).filter(id => Number.isFinite(id) && id > 0);
  if (ids.length !== 2) return res.status(400).json({ error: 'Exactly 2 record IDs required (comma-separated)', code: 'INVALID_IDS' });

  try {
    const [r1Result, r2Result] = await Promise.all([
      pool.query('SELECT * FROM records WHERE id = $1', [ids[0]]),
      pool.query('SELECT * FROM records WHERE id = $1', [ids[1]]),
    ]);
    if (r1Result.rows.length === 0) return res.status(404).json({ error: `Record ${ids[0]} not found` });
    if (r2Result.rows.length === 0) return res.status(404).json({ error: `Record ${ids[1]} not found` });

    const r1 = r1Result.rows[0];
    const r2 = r2Result.rows[0];

    // Get like counts
    const [l1, l2] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM record_likes WHERE record_id = $1', [ids[0]]),
      pool.query('SELECT COUNT(*) AS count FROM record_likes WHERE record_id = $1', [ids[1]]),
    ]);

    const conditionRanking = { M: 8, NM: 7, 'VG+': 6, VG: 5, 'G+': 4, G: 3, F: 2, P: 1 };

    res.json({
      records: [
        { ...r1, likes: parseInt(l1.rows[0].count) },
        { ...r2, likes: parseInt(l2.rows[0].count) },
      ],
      comparison: {
        sameArtist: r1.artist.toLowerCase() === r2.artist.toLowerCase(),
        sameAlbum: r1.album.toLowerCase() === r2.album.toLowerCase(),
        priceDifference: Math.round((parseFloat(r1.price || 0) - parseFloat(r2.price || 0)) * 100) / 100,
        betterCondition: (conditionRanking[r1.condition] || 0) > (conditionRanking[r2.condition] || 0) ? ids[0] : (conditionRanking[r1.condition] || 0) < (conditionRanking[r2.condition] || 0) ? ids[1] : 'equal',
        betterValue: (parseFloat(r1.price || 0) / (conditionRanking[r1.condition] || 1)) < (parseFloat(r2.price || 0) / (conditionRanking[r2.condition] || 1)) ? ids[0] : ids[1],
      },
    });
  } catch (err) {
    console.error('Record compare error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 14: Collection merge view ────────────────────────────────────────

// GET /api/collections/merge?users=user1,user2 — view merged collection of two users
app.get('/api/collections/merge', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const users = String(req.query.users || '').split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
  if (users.length < 2 || users.length > 5) return res.status(400).json({ error: '2-5 usernames required (comma-separated)', code: 'INVALID_USERS' });
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    const result = await pool.query(
      `SELECT r.*, COUNT(rl.id) AS like_count FROM records r
       LEFT JOIN record_likes rl ON rl.record_id = r.id
       WHERE r.user_id = ANY($1)
       GROUP BY r.id
       ORDER BY r.artist ASC, r.album ASC
       LIMIT $2`,
      [users, limit]
    );

    // Group by owner
    const byUser = {};
    for (const r of result.rows) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }

    // Find shared artists
    const artistsByUser = {};
    for (const u of users) {
      artistsByUser[u] = new Set((byUser[u] || []).map(r => r.artist.toLowerCase()));
    }
    const sharedArtists = [...(artistsByUser[users[0]] || [])].filter(a =>
      users.every(u => (artistsByUser[u] || new Set()).has(a))
    );

    res.json({
      users,
      totalRecords: result.rows.length,
      records: result.rows,
      sharedArtists,
      byUser: Object.fromEntries(users.map(u => [u, (byUser[u] || []).length])),
    });
  } catch (err) {
    console.error('Collection merge error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 15: Seller analytics ─────────────────────────────────────────────

// GET /api/analytics/seller — seller analytics (sales by month, avg price, top buyers)
app.get('/api/analytics/seller', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const username = req.user.username;

    const [salesByMonth, topBuyers, avgPriceResult, totalResult] = await Promise.all([
      pool.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count,
               COALESCE(SUM(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 0) AS revenue
        FROM purchases WHERE seller = $1 AND status = 'paid'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12
      `, [username]),
      pool.query(`
        SELECT buyer, COUNT(*) AS purchase_count,
               COALESCE(SUM(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 0) AS total_spent
        FROM purchases WHERE seller = $1 AND status = 'paid'
        GROUP BY buyer ORDER BY purchase_count DESC LIMIT 10
      `, [username]),
      pool.query(`
        SELECT ROUND(AVG(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 2) AS avg_price
        FROM purchases WHERE seller = $1 AND status = 'paid'
      `, [username]),
      pool.query('SELECT COUNT(*) AS count FROM purchases WHERE seller = $1 AND status = \'paid\'', [username]),
    ]);

    res.json({
      username,
      totalSales: parseInt(totalResult.rows[0].count),
      averagePrice: parseFloat(avgPriceResult.rows[0].avg_price) || 0,
      salesByMonth: salesByMonth.rows.map(r => ({ month: r.month, count: parseInt(r.count), revenue: parseFloat(r.revenue) })),
      topBuyers: topBuyers.rows.map(r => ({ buyer: r.buyer, purchaseCount: parseInt(r.purchase_count), totalSpent: parseFloat(r.total_spent) })),
    });
  } catch (err) {
    console.error('Seller analytics error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 16: Buyer analytics ──────────────────────────────────────────────

// GET /api/analytics/buyer — buyer analytics (purchases by month, avg spend, top sellers)
app.get('/api/analytics/buyer', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const username = req.user.username;

    const [purchasesByMonth, topSellers, avgSpendResult, totalResult] = await Promise.all([
      pool.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count,
               COALESCE(SUM(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 0) AS spent
        FROM purchases WHERE buyer = $1 AND status = 'paid'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12
      `, [username]),
      pool.query(`
        SELECT seller, COUNT(*) AS purchase_count,
               COALESCE(SUM(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 0) AS total_spent
        FROM purchases WHERE buyer = $1 AND status = 'paid'
        GROUP BY seller ORDER BY purchase_count DESC LIMIT 10
      `, [username]),
      pool.query(`
        SELECT ROUND(AVG(CAST(COALESCE(NULLIF(price,''), '0') AS NUMERIC)), 2) AS avg_spend
        FROM purchases WHERE buyer = $1 AND status = 'paid'
      `, [username]),
      pool.query('SELECT COUNT(*) AS count FROM purchases WHERE buyer = $1 AND status = \'paid\'', [username]),
    ]);

    res.json({
      username,
      totalPurchases: parseInt(totalResult.rows[0].count),
      averageSpend: parseFloat(avgSpendResult.rows[0].avg_spend) || 0,
      purchasesByMonth: purchasesByMonth.rows.map(r => ({ month: r.month, count: parseInt(r.count), spent: parseFloat(r.spent) })),
      topSellers: topSellers.rows.map(r => ({ seller: r.seller, purchaseCount: parseInt(r.purchase_count), totalSpent: parseFloat(r.total_spent) })),
    });
  } catch (err) {
    console.error('Buyer analytics error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 17: Record provenance/ownership chain ────────────────────────────

// POST /api/records/:id/provenance — add provenance entry
app.post('/api/records/:id/provenance', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  const { acquiredFrom, pricePaid, notes } = req.body;
  try {
    const record = await pool.query('SELECT id, user_id FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (record.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    const result = await pool.query(
      'INSERT INTO record_provenance (record_id, owner, acquired_from, price_paid, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [recordId, req.user.username, acquiredFrom || '', pricePaid || '', notes || '']
    );
    res.json({ ok: true, provenance: result.rows[0] });
  } catch (err) {
    console.error('Provenance add error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/records/:id/provenance — get ownership chain
app.get('/api/records/:id/provenance', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const result = await pool.query(
      'SELECT * FROM record_provenance WHERE record_id = $1 ORDER BY acquired_at ASC',
      [recordId]
    );
    res.json({ recordId, chain: result.rows });
  } catch (err) {
    console.error('Provenance fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 18: Escrow system for high-value trades ──────────────────────────

// POST /api/escrow — create an escrow hold
app.post('/api/escrow', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { seller, recordId, amount } = req.body;
  if (!seller || !amount) return res.status(400).json({ error: 'seller and amount are required', code: 'MISSING_FIELDS' });
  if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'Amount must be positive', code: 'INVALID_AMOUNT' });
  if (seller === req.user.username) return res.status(400).json({ error: 'Cannot create escrow with yourself' });
  try {
    const result = await pool.query(
      'INSERT INTO escrow_holds (buyer, seller, record_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.username, seller, recordId || null, amount]
    );
    console.log(`[EMAIL_TRIGGER] Escrow created: $${amount} from ${req.user.username} to ${seller} for record #${recordId || 'N/A'}`);
    res.json({ ok: true, escrow: result.rows[0] });
  } catch (err) {
    console.error('Create escrow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/escrow/:id/release — release escrow funds to seller
app.put('/api/escrow/:id/release', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const escrow = await pool.query('SELECT * FROM escrow_holds WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });
    const e = escrow.rows[0];
    if (e.buyer !== req.user.username) return res.status(403).json({ error: 'Only the buyer can release escrow' });
    if (e.status !== 'held') return res.status(400).json({ error: `Escrow is already ${e.status}` });

    const result = await pool.query(
      'UPDATE escrow_holds SET status = \'released\', released_at = now() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    console.log(`[EMAIL_TRIGGER] Escrow #${req.params.id} released: $${e.amount} to ${e.seller}`);
    res.json({ ok: true, escrow: result.rows[0] });
  } catch (err) {
    console.error('Release escrow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/escrow/:id/refund — refund escrow to buyer
app.put('/api/escrow/:id/refund', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const escrow = await pool.query('SELECT * FROM escrow_holds WHERE id = $1', [req.params.id]);
    if (escrow.rows.length === 0) return res.status(404).json({ error: 'Escrow not found' });
    const e = escrow.rows[0];
    if (e.seller !== req.user.username && e.buyer !== req.user.username) return res.status(403).json({ error: 'Not a party to this escrow' });
    if (e.status !== 'held') return res.status(400).json({ error: `Escrow is already ${e.status}` });

    const result = await pool.query(
      'UPDATE escrow_holds SET status = \'refunded\', released_at = now() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    console.log(`[EMAIL_TRIGGER] Escrow #${req.params.id} refunded: $${e.amount} to ${e.buyer}`);
    res.json({ ok: true, escrow: result.rows[0] });
  } catch (err) {
    console.error('Refund escrow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/escrow — list user's escrow holds
app.get('/api/escrow', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM escrow_holds WHERE buyer = $1 OR seller = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ escrows: result.rows });
  } catch (err) {
    console.error('List escrow error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 19: Dispute resolution workflow ──────────────────────────────────

// POST /api/disputes — file a dispute
app.post('/api/disputes', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { purchaseId, against, reason } = req.body;
  if (!against || !reason) return res.status(400).json({ error: 'against and reason are required', code: 'MISSING_FIELDS' });
  if (against === req.user.username) return res.status(400).json({ error: 'Cannot file a dispute against yourself' });
  if (typeof reason !== 'string' || reason.trim().length < 10) return res.status(400).json({ error: 'Reason must be at least 10 characters' });
  try {
    const result = await pool.query(
      'INSERT INTO disputes (purchase_id, filed_by, against, reason) VALUES ($1, $2, $3, $4) RETURNING *',
      [purchaseId || null, req.user.username, against, reason.trim()]
    );
    console.log(`[EMAIL_TRIGGER] Dispute filed by ${req.user.username} against ${against}: ${reason.slice(0, 50)}`);
    res.json({ ok: true, dispute: result.rows[0] });
  } catch (err) {
    console.error('File dispute error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/disputes — list user's disputes
app.get('/api/disputes', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const result = await pool.query(
      'SELECT * FROM disputes WHERE filed_by = $1 OR against = $1 ORDER BY created_at DESC',
      [req.user.username]
    );
    res.json({ disputes: result.rows });
  } catch (err) {
    console.error('List disputes error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/disputes/:id/resolve — resolve a dispute
app.put('/api/disputes/:id/resolve', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { resolution, status } = req.body;
  if (!resolution) return res.status(400).json({ error: 'resolution is required' });
  const resolvedStatus = status || 'resolved';
  if (!['resolved', 'dismissed', 'escalated'].includes(resolvedStatus)) {
    return res.status(400).json({ error: 'Status must be resolved, dismissed, or escalated' });
  }
  try {
    const dispute = await pool.query('SELECT * FROM disputes WHERE id = $1', [req.params.id]);
    if (dispute.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });
    if (dispute.rows[0].status !== 'open') return res.status(400).json({ error: 'Dispute is not open' });

    const result = await pool.query(
      'UPDATE disputes SET status = $1, resolution = $2, mediator = $3, resolved_at = now() WHERE id = $4 RETURNING *',
      [resolvedStatus, resolution, req.user.username, req.params.id]
    );
    console.log(`[EMAIL_TRIGGER] Dispute #${req.params.id} resolved: ${resolvedStatus}. Notify: ${dispute.rows[0].filed_by}, ${dispute.rows[0].against}`);
    res.json({ ok: true, dispute: result.rows[0] });
  } catch (err) {
    console.error('Resolve dispute error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 20: User verification levels ─────────────────────────────────────

// GET /api/users/:username/verification — get user verification level
app.get('/api/users/:username/verification', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const username = req.params.username.toLowerCase();
  try {
    const result = await pool.query('SELECT * FROM user_verification WHERE user_id = $1', [username]);
    if (result.rows.length === 0) {
      return res.json({ username, level: 'unverified', emailVerified: false, idVerified: false, sellerVerified: false });
    }
    const v = result.rows[0];
    res.json({ username, level: v.level, emailVerified: v.email_verified, idVerified: v.id_verified, sellerVerified: v.seller_verified, updatedAt: v.updated_at });
  } catch (err) {
    console.error('Verification level error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/verification — update own verification level
app.put('/api/users/verification', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { emailVerified, idVerified, sellerVerified } = req.body;
  try {
    // Determine level based on verification flags
    const email = emailVerified || false;
    const idV = idVerified || false;
    const seller = sellerVerified || false;
    let level = 'unverified';
    if (seller) level = 'seller';
    else if (idV) level = 'id_verified';
    else if (email) level = 'email_verified';

    await pool.query(
      `INSERT INTO user_verification (user_id, level, email_verified, id_verified, seller_verified, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET level = $2, email_verified = $3, id_verified = $4, seller_verified = $5, updated_at = now()`,
      [req.user.username, level, email, idV, seller]
    );
    res.json({ ok: true, level, emailVerified: email, idVerified: idV, sellerVerified: seller });
  } catch (err) {
    console.error('Update verification error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 21: Per-endpoint rate limiting ───────────────────────────────────

// POST /api/admin/rate-limits — configure rate limit for specific endpoint
app.post('/api/admin/rate-limits', authMiddleware, (req, res) => {
  const { endpoint, maxRequests, windowMs } = req.body;
  if (!endpoint || !maxRequests || !windowMs) return res.status(400).json({ error: 'endpoint, maxRequests, and windowMs are required' });
  if (maxRequests < 1 || maxRequests > 10000) return res.status(400).json({ error: 'maxRequests must be between 1 and 10000' });
  if (windowMs < 1000 || windowMs > 3600000) return res.status(400).json({ error: 'windowMs must be between 1000 and 3600000' });

  endpointRateLimits.set(endpoint, { maxRequests, windowMs, updatedBy: req.user.username, updatedAt: new Date().toISOString() });
  res.json({ ok: true, endpoint, maxRequests, windowMs });
});

// GET /api/admin/rate-limits — list configured per-endpoint rate limits
app.get('/api/admin/rate-limits', authMiddleware, (req, res) => {
  const limits = {};
  for (const [endpoint, config] of endpointRateLimits) {
    limits[endpoint] = config;
  }
  res.json({ defaultLimit: { maxRequests: 100, windowMs: 60000 }, endpointOverrides: limits, activeBuckets: rateLimitBuckets.size });
});

// ── Feature 22: API response time tracking ───────────────────────────────────

// Middleware to track response times (adds to in-memory array)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    apiResponseTimes.push({
      endpoint: req.path,
      method: req.method,
      status: res.statusCode,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
    if (apiResponseTimes.length > MAX_RESPONSE_TIME_ENTRIES) {
      apiResponseTimes.splice(0, apiResponseTimes.length - MAX_RESPONSE_TIME_ENTRIES);
    }
  });
  next();
});

// GET /api/admin/response-times — get API response time stats
app.get('/api/admin/response-times', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const recentEntries = apiResponseTimes.slice(-limit);

  if (recentEntries.length === 0) return res.json({ totalTracked: 0, entries: [], stats: {} });

  // Aggregate by endpoint
  const byEndpoint = {};
  for (const entry of recentEntries) {
    const key = `${entry.method} ${entry.endpoint}`;
    if (!byEndpoint[key]) byEndpoint[key] = { count: 0, totalMs: 0, maxMs: 0, minMs: Infinity };
    byEndpoint[key].count++;
    byEndpoint[key].totalMs += entry.durationMs;
    byEndpoint[key].maxMs = Math.max(byEndpoint[key].maxMs, entry.durationMs);
    byEndpoint[key].minMs = Math.min(byEndpoint[key].minMs, entry.durationMs);
  }

  const stats = Object.fromEntries(
    Object.entries(byEndpoint).map(([key, val]) => [key, {
      count: val.count,
      avgMs: Math.round(val.totalMs / val.count),
      maxMs: val.maxMs,
      minMs: val.minMs === Infinity ? 0 : val.minMs,
    }])
  );

  const allDurations = recentEntries.map(e => e.durationMs);
  res.json({
    totalTracked: apiResponseTimes.length,
    recentCount: recentEntries.length,
    globalAvgMs: Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length),
    globalMaxMs: Math.max(...allDurations),
    stats,
    recent: recentEntries.slice(-20),
  });
});

// ── Feature 23: Database connection pool stats ───────────────────────────────

// GET /api/admin/db-pool-stats — get database connection pool statistics
app.get('/api/admin/db-pool-stats', authMiddleware, (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });

  res.json({
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: pool.options?.max || 10,
    connectionString: pool.options?.connectionString ? '***configured***' : 'not_set',
    ssl: pool.options?.ssl ? true : false,
  });
});

// ── Feature 24: Automated price suggestions ──────────────────────────────────

// GET /api/records/:id/price-suggestion — suggest price based on condition + market data
app.get('/api/records/:id/price-suggestion', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const record = await pool.query('SELECT * FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });

    const r = record.rows[0];
    // Condition multipliers (relative to NM base)
    const conditionMultipliers = { M: 1.2, NM: 1.0, 'VG+': 0.8, VG: 0.6, 'G+': 0.4, G: 0.3, F: 0.15, P: 0.05 };
    const condMultiplier = conditionMultipliers[r.condition] || 0.5;

    // Find similar records on the marketplace
    const similar = await pool.query(
      `SELECT price, condition FROM records
       WHERE LOWER(artist) = LOWER($1) AND for_sale = true AND id != $2
         AND price IS NOT NULL AND price != '' AND price != '0'
       LIMIT 20`,
      [r.artist, recordId]
    );

    let marketAvg = null;
    let suggestion = null;
    const dataPoints = [];

    if (similar.rows.length > 0) {
      const prices = similar.rows.map(s => {
        const p = parseFloat(s.price) || 0;
        const mult = conditionMultipliers[s.condition] || 0.5;
        // Normalize price to NM equivalent
        return mult > 0 ? p / mult : p;
      }).filter(p => p > 0);

      if (prices.length > 0) {
        marketAvg = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
        suggestion = Math.round(marketAvg * condMultiplier * 100) / 100;
        suggestion = Math.max(suggestion, 5); // minimum $5
      }

      for (const s of similar.rows) {
        dataPoints.push({ price: parseFloat(s.price), condition: s.condition });
      }
    }

    // Fallback: use condition-based default if no market data
    if (!suggestion) {
      const defaultPrices = { M: 40, NM: 30, 'VG+': 22, VG: 15, 'G+': 10, G: 7, F: 3, P: 1 };
      suggestion = defaultPrices[r.condition] || 15;
    }

    res.json({
      recordId,
      artist: r.artist,
      album: r.album,
      condition: r.condition,
      currentPrice: r.price,
      suggestedPrice: suggestion,
      marketAvgNormalized: marketAvg,
      conditionMultiplier: condMultiplier,
      dataPointCount: dataPoints.length,
      dataPoints,
      method: similar.rows.length > 0 ? 'market_comparison' : 'condition_default',
    });
  } catch (err) {
    console.error('Price suggestion error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Feature 25: Record catalog number generation ─────────────────────────────

// POST /api/records/:id/catalog-number — generate a unique catalog number for a record
app.post('/api/records/:id/catalog-number', authMiddleware, async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const recordId = parseInt(req.params.id);
  if (!Number.isFinite(recordId) || recordId <= 0) return res.status(400).json({ error: 'Invalid record ID', code: 'INVALID_ID' });
  try {
    const record = await pool.query('SELECT * FROM records WHERE id = $1', [recordId]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    if (record.rows[0].user_id !== req.user.username) return res.status(403).json({ error: 'Not your record' });

    // Check if already has a catalog number
    if (record.rows[0].catalog_number && record.rows[0].catalog_number.trim() !== '') {
      return res.json({ recordId, catalogNumber: record.rows[0].catalog_number, alreadyExists: true });
    }

    // Generate catalog number: GS-{ARTIST_INITIALS}-{YEAR}-{ID_PADDED}
    const r = record.rows[0];
    const artistInitials = r.artist
      .split(/\s+/)
      .map(w => (w[0] || '').toUpperCase())
      .join('')
      .slice(0, 4) || 'XX';
    const year = String(r.year || '0000').slice(0, 4).padStart(4, '0');
    const paddedId = String(recordId).padStart(6, '0');
    const catalogNumber = `GS-${artistInitials}-${year}-${paddedId}`;

    await pool.query('UPDATE records SET catalog_number = $1 WHERE id = $2', [catalogNumber, recordId]);
    res.json({ recordId, catalogNumber, alreadyExists: false });
  } catch (err) {
    console.error('Catalog number error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/records/by-catalog/:catalogNumber — look up record by catalog number
app.get('/api/records/by-catalog/:catalogNumber', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const catalogNumber = String(req.params.catalogNumber || '').trim();
  if (!catalogNumber) return res.status(400).json({ error: 'Catalog number is required' });
  try {
    const result = await pool.query('SELECT * FROM records WHERE catalog_number = $1', [catalogNumber]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found for this catalog number' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Catalog lookup error:', err.message);
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
