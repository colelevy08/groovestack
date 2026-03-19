require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

// CORS — allow localhost in dev and the production frontend URL
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Username, X-Sample-Rate, X-Bit-Depth, X-Channels');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '10mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AUDD_API_TOKEN = process.env.AUDD_API_TOKEN || '';

// In-memory Vinyl Buddy state (simple local-dev backend).
const MAX_VB_SESSIONS = 1000;
const vinylSessions = [];
const devicesById = new Map();
let lastIdentifyDebug = null;
const DEFAULT_TRACK_LENGTH_SEC = 240;
const CAPTURE_COUNT_MIN_GAP_MS = 120000;

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
app.get('/api/vinyl-buddy/history/:username', (req, res) => {
  const username = String(req.params.username || '').trim();
  const limit = Math.min(_parsePositiveInt(req.query.limit, 50), 200);

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
app.get('/api/vinyl-buddy/devices/:username', (req, res) => {
  const username = String(req.params.username || '').trim();

  const devices = Array.from(devicesById.values())
    .filter((d) => d.username === username)
    .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return res.json({ devices });
});

// Health check
app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  vinylBuddy: {
    sessions: vinylSessions.length,
    devices: devicesById.size,
    identifyProvider: AUDD_API_TOKEN ? 'audd' : 'none',
  },
}));

const PORT = process.env.PORT || process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🎵 Groovestack API server running on :${PORT}`);
  console.log(`   Claude vinyl verification: ready`);
  console.log(`   Vinyl Buddy API: /api/vinyl-buddy/* (${AUDD_API_TOKEN ? 'AudD enabled' : 'set AUDD_API_TOKEN to enable identification'})\n`);
});
