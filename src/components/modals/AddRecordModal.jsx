// Modal for adding a new record to the current user's collection.
// Requires AI verification via VinylCamera before the submit button becomes active.
// On submit, calls onAdd in App.js which pushes the new record into the shared records array.
// Contains two sub-components: VinylCamera (camera + Claude AI verification) and SpinnerDots (loading animation).
import { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import FormTextarea from '../ui/FormTextarea';
import Toggle from '../ui/Toggle';
import Stars from '../ui/Stars';
import { GENRES, GENRE_MAP, CONDITIONS, FORMATS, ACCENT_COLORS } from '../../constants';
import { verifyVinyl } from '../../utils/verifyVinyl';

// State machine for the camera/verification flow:
// idle → capturing → captured → verifying → verified
//                  ↑_______retake_________|         |
//                                                failed → retake → capturing

const STATUS = { IDLE: 'idle', CAPTURING: 'capturing', CAPTURED: 'captured', VERIFYING: 'verifying', VERIFIED: 'verified', FAILED: 'failed' };

// Camera panel that steps the user through: open camera → capture photo → send to Claude AI → verified/failed.
// onVerified is called when Claude confirms vinyl; onRetake resets the parent's verified flag.
function VinylCamera({ onVerified, onRetake }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [message, setMessage] = useState('');
  const [camError, setCamError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stops all active camera tracks and clears the stream reference
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Stop camera when component unmounts
  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus(STATUS.CAPTURING);
    } catch {
      setCamError('Camera access denied. Please allow camera access and try again.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    stopStream();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    setCapturedSrc(dataUrl);
    setCapturedBase64(base64);
    setStatus(STATUS.CAPTURED);
  };

  const retake = () => {
    setCapturedSrc(null);
    setCapturedBase64(null);
    setMessage('');
    onRetake();
    startCamera();
  };

  const verify = async () => {
    setStatus(STATUS.VERIFYING);
    try {
      const result = await verifyVinyl(capturedBase64, 'image/jpeg');
      setMessage(result.message);
      if (result.verified) {
        setStatus(STATUS.VERIFIED);
        onVerified();
      } else {
        setStatus(STATUS.FAILED);
      }
    } catch (err) {
      setMessage(err.message || 'Verification service unavailable. Make sure the API server is running.');
      setStatus(STATUS.FAILED);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const panelStyle = {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid',
    borderColor: status === STATUS.VERIFIED ? '#22c55e44' : status === STATUS.FAILED ? '#ef444444' : '#1e1e1e',
    background: '#0a0a0a',
  };

  const headerStyle = {
    padding: '11px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
    background: status === STATUS.VERIFIED ? '#14532d22' : status === STATUS.FAILED ? '#7f1d1d22' : 'transparent',
  };

  return (
    <div style={panelStyle}>
      {/* ── Header ── */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>
            {status === STATUS.VERIFIED ? '✅' : status === STATUS.FAILED ? '❌' : status === STATUS.VERIFYING ? '⏳' : '📷'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ccc', fontFamily: "'DM Mono',monospace", letterSpacing: '0.06em' }}>
            {status === STATUS.VERIFIED ? 'VINYL VERIFIED' : status === STATUS.FAILED ? 'VERIFICATION FAILED' : status === STATUS.VERIFYING ? 'ANALYZING...' : 'VINYL VERIFICATION'}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#444', fontFamily: "'DM Mono',monospace" }}>powered by Claude</span>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: 16 }}>

        {/* IDLE: prompt to open camera */}
        {status === STATUS.IDLE && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Show us your vinyl! Take a quick photo to confirm you own the record before adding it to your collection.
            </p>
            {camError && (
              <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12 }}>{camError}</p>
            )}
            <button
              onClick={startCamera}
              style={{ padding: '10px 22px', background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <span>📷</span> Open Camera
            </button>
          </div>
        )}

        {/* CAPTURING: live video feed */}
        {status === STATUS.CAPTURING && (
          <div>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', borderRadius: 8, display: 'block', maxHeight: 260, objectFit: 'cover', background: '#111' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { stopStream(); setStatus(STATUS.IDLE); }}
                style={{ flex: 1, padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                style={{ flex: 2, padding: 9, background: 'linear-gradient(135deg,#6366f1,#0ea5e9)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                📸 Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas used for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* CAPTURED: show photo, invite verification */}
        {(status === STATUS.CAPTURED) && (
          <div>
            <img src={capturedSrc} alt="Captured vinyl" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={retake}
                style={{ flex: 1, padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Retake
              </button>
              <button
                onClick={verify}
                style={{ flex: 2, padding: 9, background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
              >
                <span>✨</span> Verify with Claude AI
              </button>
            </div>
          </div>
        )}

        {/* VERIFYING: spinner */}
        {status === STATUS.VERIFYING && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <img src={capturedSrc} alt="Captured vinyl" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', opacity: 0.5, marginBottom: 14 }} />
            <SpinnerDots />
            <p style={{ fontSize: 12, color: '#555', marginTop: 10 }}>Claude is examining your vinyl…</p>
          </div>
        )}

        {/* VERIFIED: success */}
        {status === STATUS.VERIFIED && (
          <div>
            <img src={capturedSrc} alt="Verified vinyl" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', border: '2px solid #22c55e55' }} />
            <p style={{ fontSize: 13, color: '#4ade80', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>{message}</p>
          </div>
        )}

        {/* FAILED: rejection */}
        {status === STATUS.FAILED && (
          <div>
            {capturedSrc && <img src={capturedSrc} alt="Rejected capture" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover', opacity: 0.6, border: '2px solid #ef444455' }} />}
            <p style={{ fontSize: 13, color: '#f87171', marginTop: 10, lineHeight: 1.5, textAlign: 'center' }}>{message}</p>
            <button
              onClick={retake}
              style={{ marginTop: 10, width: '100%', padding: 9, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              📷 Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Three pulsing dots shown while Claude AI is analyzing the captured photo
function SpinnerDots() {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', height: 28 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)',
          animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Main form modal — collects all record metadata, then gates submission on AI vinyl verification
export default function AddRecordModal({ open, onClose, onAdd, currentUser }) {
  const [album, setAlbum] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [format, setFormat] = useState('LP');
  const [label, setLabel] = useState('');
  const [condition, setCondition] = useState('VG+');
  const [rating, setRating] = useState(4);
  const [review, setReview] = useState('');
  const [forSale, setForSale] = useState(false);
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState([]);
  const [err, setErr] = useState('');
  const [verified, setVerified] = useState(false);

  // Resets all fields back to defaults — called on cancel and after a successful add
  const reset = () => {
    setAlbum(''); setArtist(''); setYear(''); setFormat('LP');
    setLabel(''); setCondition('VG+'); setRating(4); setReview('');
    setForSale(false); setPrice(''); setTags([]); setErr('');
    setVerified(false);
  };

  // Toggles a genre tag on/off in the selected tags array
  const toggleTag = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Validates, builds the new record object, calls onAdd, and closes the modal
  const submit = () => {
    if (!album.trim() || !artist.trim()) { setErr('Album and artist are required.'); return; }
    if (!verified) { setErr('Please verify your vinyl before adding it.'); return; }
    const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    onAdd({
      id: Date.now(), user: currentUser, album: album.trim(), artist: artist.trim(),
      year: parseInt(year) || new Date().getFullYear(), format, label: label.trim(),
      condition, forSale, price: forSale ? parseFloat(price) || null : null,
      rating, review: review.trim(), likes: 0, comments: [], accent, tags,
      timeAgo: 'just now', liked: false, saved: false,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Add Record to Collection" width="520px">
      {err && (
        <div style={{ background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* ── Record details form ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <div style={{ gridColumn: '1/-1' }}><FormInput label="ALBUM TITLE *" value={album} onChange={setAlbum} placeholder="e.g. Kind of Blue" /></div>
        <div style={{ gridColumn: '1/-1' }}><FormInput label="ARTIST *" value={artist} onChange={setArtist} placeholder="e.g. Miles Davis" /></div>
        <FormInput label="YEAR" value={year} onChange={setYear} placeholder="1959" type="number" />
        <FormSelect label="FORMAT" value={format} onChange={setFormat} options={FORMATS} />
        <FormInput label="LABEL" value={label} onChange={setLabel} placeholder="e.g. Columbia" />
        <FormSelect label="CONDITION" value={condition} onChange={setCondition} options={CONDITIONS} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#666', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>YOUR RATING</label>
        <Stars rating={rating} onRate={setRating} size={22} />
      </div>
      <FormTextarea label="REVIEW / NOTES" value={review} onChange={setReview} placeholder="What makes this pressing special?" />
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#666', letterSpacing: '0.08em', marginBottom: 8, fontFamily: "'DM Mono',monospace" }}>GENRES</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GENRES.map(t => (
              <button key={t} onClick={() => toggleTag(t)} style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid', background: tags.includes(t) ? '#0ea5e9' : '#1a1a1a', borderColor: tags.includes(t) ? '#0ea5e9' : '#2a2a2a', color: tags.includes(t) ? '#000' : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
          {/* Subgenre pills for selected genres */}
          {GENRES.filter(g => tags.includes(g) && GENRE_MAP[g]?.length > 0).map(g => (
            <div key={g + "-sub"} style={{ paddingLeft: 8, borderLeft: '2px solid #1e1e1e' }}>
              <span style={{ fontSize: 10, color: '#555', fontFamily: "'DM Mono',monospace", marginBottom: 4, display: 'block' }}>{g} subgenres:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {GENRE_MAP[g].map(sg => (
                  <button key={sg} onClick={() => toggleTag(sg)} style={{ padding: '3px 9px', borderRadius: 16, border: '1px solid', background: tags.includes(sg) ? '#6366f1' : '#111', borderColor: tags.includes(sg) ? '#6366f1' : '#1e1e1e', color: tags.includes(sg) ? '#fff' : '#555', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                    {sg}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20, padding: 14, background: '#111', borderRadius: 10, border: '1px solid #1a1a1a' }}>
        <Toggle on={forSale} onToggle={() => setForSale(!forSale)} label="List for sale" />
        {forSale && <div style={{ marginTop: 12 }}><FormInput label="ASKING PRICE (USD)" value={price} onChange={setPrice} placeholder="0.00" type="number" /></div>}
      </div>

      {/* ── Claude AI vinyl verification ── */}
      <VinylCamera
        onVerified={() => setVerified(true)}
        onRetake={() => setVerified(false)}
      />

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => { reset(); onClose(); }}
          style={{ flex: 1, padding: 11, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!verified}
          title={!verified ? 'Verify your vinyl first' : ''}
          style={{
            flex: 2, padding: 11, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: verified ? 'pointer' : 'not-allowed',
            background: verified ? 'linear-gradient(135deg,#22c55e,#0ea5e9)' : '#1a1a1a',
            color: verified ? '#fff' : '#444',
            transition: 'all 0.3s ease',
          }}
        >
          {verified ? '✅ Add to Collection' : '🔒 Verify Vinyl First'}
        </button>
      </div>
    </Modal>
  );
}
