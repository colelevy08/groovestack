// Modal for adding a new record to the current user's collection.
// AI verification via VinylCamera is optional — users can skip and verify later.
// Verified records display a blue checkmark badge across the app.
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
import { getDiscogsPrice } from '../../utils/discogs';

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
  const panelBorderClass =
    status === STATUS.VERIFIED ? 'border-green-500/25' :
    status === STATUS.FAILED ? 'border-red-500/25' :
    'border-gs-border';

  const headerBgClass =
    status === STATUS.VERIFIED ? 'bg-green-950/15' :
    status === STATUS.FAILED ? 'bg-red-950/15' :
    'bg-transparent';

  return (
    <div className={`mb-5 rounded-xl overflow-hidden border bg-gs-sidebar ${panelBorderClass}`}>
      {/* ── Header ── */}
      <div className={`px-4 py-[11px] flex items-center justify-between border-b border-[#1a1a1a] ${headerBgClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">
            {status === STATUS.VERIFIED ? '✅' : status === STATUS.FAILED ? '❌' : status === STATUS.VERIFYING ? '⏳' : '📷'}
          </span>
          <span className="text-xs font-bold text-[#ccc] font-mono tracking-wide">
            {status === STATUS.VERIFIED ? 'VINYL VERIFIED' : status === STATUS.FAILED ? 'VERIFICATION FAILED' : status === STATUS.VERIFYING ? 'ANALYZING...' : 'VINYL VERIFICATION'}
          </span>
        </div>
        <span className="text-[10px] text-gs-faint font-mono">powered by Claude</span>
      </div>

      {/* ── Body ── */}
      <div className="p-4">

        {/* IDLE: prompt to open camera */}
        {status === STATUS.IDLE && (
          <div className="text-center pt-2 pb-1">
            <p className="text-[13px] text-[#666] mb-3.5 leading-normal">
              Show us your vinyl! Take a quick photo to confirm you own the record before adding it to your collection.
            </p>
            {camError && (
              <p className="text-xs text-red-400 mb-3">{camError}</p>
            )}
            <button
              onClick={startCamera}
              className="gs-btn-gradient px-[22px] py-2.5 rounded-[10px] text-[13px] font-bold inline-flex items-center gap-[7px]"
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
              className="w-full rounded-lg block max-h-[260px] object-cover bg-[#111]"
            />
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => { stopStream(); setStatus(STATUS.IDLE); }}
                className="flex-1 p-[9px] bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-gs-muted text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                className="flex-[2] p-[9px] gs-btn-gradient rounded-lg text-[13px] font-bold cursor-pointer"
              >
                📸 Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* Hidden canvas used for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* CAPTURED: show photo, invite verification */}
        {(status === STATUS.CAPTURED) && (
          <div>
            <img src={capturedSrc} alt="Captured vinyl" className="w-full rounded-lg max-h-[260px] object-cover" />
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={retake}
                className="flex-1 p-[9px] bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-gs-muted text-xs font-semibold cursor-pointer"
              >
                Retake
              </button>
              <button
                onClick={verify}
                className="flex-[2] p-[9px] bg-gradient-to-br from-purple-600 to-gs-accent border-none rounded-lg text-white text-[13px] font-bold cursor-pointer flex items-center justify-center gap-[7px]"
              >
                <span>✨</span> Verify with Claude AI
              </button>
            </div>
          </div>
        )}

        {/* VERIFYING: spinner */}
        {status === STATUS.VERIFYING && (
          <div className="text-center py-2.5">
            <img src={capturedSrc} alt="Captured vinyl" className="w-full rounded-lg max-h-[200px] object-cover opacity-50 mb-3.5" />
            <SpinnerDots />
            <p className="text-xs text-gs-dim mt-2.5">Claude is examining your vinyl…</p>
          </div>
        )}

        {/* VERIFIED: success */}
        {status === STATUS.VERIFIED && (
          <div>
            <img src={capturedSrc} alt="Verified vinyl" className="w-full rounded-lg max-h-[200px] object-cover border-2 border-green-500/35" />
            <p className="text-[13px] text-green-400 mt-2.5 leading-normal text-center">{message}</p>
          </div>
        )}

        {/* FAILED: rejection */}
        {status === STATUS.FAILED && (
          <div>
            {capturedSrc && <img src={capturedSrc} alt="Rejected capture" className="w-full rounded-lg max-h-[200px] object-cover opacity-60 border-2 border-red-500/35" />}
            <p className="text-[13px] text-red-400 mt-2.5 leading-normal text-center">{message}</p>
            <button
              onClick={retake}
              className="mt-2.5 w-full p-[9px] bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-[#aaa] text-[13px] font-semibold cursor-pointer"
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
    <div className="flex gap-1.5 justify-center items-center h-7">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-600 to-gs-accent" style={{
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
  const [showVerify, setShowVerify] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Resets all fields back to defaults — called on cancel and after a successful add
  const reset = () => {
    setAlbum(''); setArtist(''); setYear(''); setFormat('LP');
    setLabel(''); setCondition('VG+'); setRating(4); setReview('');
    setForSale(false); setPrice(''); setTags([]); setErr('');
    setVerified(false); setShowVerify(false);
    setPriceSuggestion(null); setLoadingPrice(false);
  };

  // Fetch Discogs market price suggestion
  const fetchPriceSuggestion = async () => {
    if (!album.trim() && !artist.trim()) return;
    setLoadingPrice(true);
    setPriceSuggestion(null);
    try {
      const data = await getDiscogsPrice(album.trim(), artist.trim());
      setPriceSuggestion(data);
    } catch {
      setPriceSuggestion(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  // Toggles a genre tag on/off in the selected tags array
  const toggleTag = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Validates, builds the new record object, calls onAdd, and closes the modal
  const submit = () => {
    if (!album.trim() || !artist.trim()) { setErr('Album and artist are required.'); return; }
    const accent = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    onAdd({
      id: Date.now(), user: currentUser, album: album.trim(), artist: artist.trim(),
      year: parseInt(year) || new Date().getFullYear(), format, label: label.trim(),
      condition, forSale, price: forSale ? parseFloat(price) || null : null,
      rating, review: review.trim(), likes: 0, comments: [], accent, tags,
      timeAgo: 'just now', liked: false, saved: false, verified,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={() => { if ((album.trim() || artist.trim()) && !window.confirm('Discard this record? Your entries will be lost.')) return; reset(); onClose(); }} title="Add Record to Collection" width="520px">
      {err && (
        <div className="bg-red-500/15 border border-red-500/25 rounded-lg px-3.5 py-2.5 text-red-400 text-[13px] mb-4">
          {err}
        </div>
      )}

      {/* ── Record details form ── */}
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-0">
        <div className="col-span-2"><FormInput label="ALBUM TITLE *" value={album} onChange={setAlbum} placeholder="e.g. Kind of Blue" /></div>
        <div className="col-span-2"><FormInput label="ARTIST *" value={artist} onChange={setArtist} placeholder="e.g. Miles Davis" /></div>
        <FormInput label="YEAR" value={year} onChange={setYear} placeholder="1959" type="number" />
        <FormSelect label="FORMAT" value={format} onChange={setFormat} options={FORMATS} />
        <FormInput label="LABEL" value={label} onChange={setLabel} placeholder="e.g. Columbia" />
        <FormSelect label="CONDITION" value={condition} onChange={setCondition} options={CONDITIONS} />
      </div>
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-2 font-mono">YOUR RATING</label>
        <Stars rating={rating} onRate={setRating} size={22} />
      </div>
      <FormTextarea label="REVIEW / NOTES" value={review} onChange={setReview} placeholder="What makes this pressing special?" />
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-2 font-mono">GENRES</label>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map(t => (
              <button key={t} onClick={() => toggleTag(t)} className={`px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer ${tags.includes(t) ? 'bg-gs-accent border-gs-accent text-black' : 'bg-[#1a1a1a] border-gs-border-hover text-[#666]'}`}>
                {t}
              </button>
            ))}
          </div>
          {/* Subgenre pills for selected genres */}
          {GENRES.filter(g => tags.includes(g) && GENRE_MAP[g]?.length > 0).map(g => (
            <div key={g + "-sub"} className="pl-2 border-l-2 border-gs-border">
              <span className="text-[10px] text-gs-dim font-mono mb-1 block">{g} subgenres:</span>
              <div className="flex flex-wrap gap-[5px]">
                {GENRE_MAP[g].map(sg => (
                  <button key={sg} onClick={() => toggleTag(sg)} className={`px-[9px] py-[3px] rounded-2xl border text-[10px] font-semibold cursor-pointer ${tags.includes(sg) ? 'bg-gs-indigo border-gs-indigo text-white' : 'bg-[#111] border-gs-border text-gs-dim'}`}>
                    {sg}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-5 p-3.5 bg-[#111] rounded-[10px] border border-[#1a1a1a]">
        <Toggle on={forSale} onToggle={() => { setForSale(!forSale); setPriceSuggestion(null); }} label="List for sale" />
        {forSale && (
          <div className="mt-3">
            <FormInput label="ASKING PRICE (USD)" value={price} onChange={setPrice} placeholder="0.00" type="number" />
            <button
              onClick={fetchPriceSuggestion}
              disabled={loadingPrice || (!album.trim() && !artist.trim())}
              className="mt-2 w-full p-[9px] bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-[12px] font-semibold cursor-pointer hover:border-gs-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-[#aaa]"
            >
              {loadingPrice ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-gs-accent/40 border-t-gs-accent rounded-full animate-spin" />
                  Looking up prices...
                </>
              ) : (
                <>💰 Get Market Price</>
              )}
            </button>
            {priceSuggestion && priceSuggestion.found && (
              <div className="mt-2.5 p-3 bg-[#0a0a0a] rounded-lg border border-gs-border">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-gs-accent font-mono tracking-wide">DISCOGS MARKET DATA</span>
                  <span className="text-[10px] text-gs-dim">({priceSuggestion.numListings} listing{priceSuggestion.numListings !== 1 ? 's' : ''})</span>
                </div>
                <div className="flex gap-3 text-[11px] mb-2.5">
                  {priceSuggestion.lowestFound != null && (
                    <div>
                      <span className="text-gs-dim">Low </span>
                      <span className="text-green-400 font-semibold">${priceSuggestion.lowestFound.toFixed(2)}</span>
                    </div>
                  )}
                  {priceSuggestion.medianFound != null && (
                    <div>
                      <span className="text-gs-dim">Median </span>
                      <span className="text-yellow-400 font-semibold">${priceSuggestion.medianFound.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {priceSuggestion.suggestedPrice != null && (
                  <button
                    onClick={() => setPrice(String(priceSuggestion.suggestedPrice))}
                    className="w-full p-[7px] bg-gs-accent/15 border border-gs-accent/30 rounded-lg text-gs-accent text-[12px] font-bold cursor-pointer hover:bg-gs-accent/25 transition-colors"
                  >
                    Use suggested: ${priceSuggestion.suggestedPrice.toFixed(2)}
                  </button>
                )}
              </div>
            )}
            {priceSuggestion && !priceSuggestion.found && (
              <div className="mt-2 text-[11px] text-gs-dim text-center py-1.5">
                No Discogs listings found for this release.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Optional Claude AI vinyl verification ── */}
      {!verified && (
        <div className="mb-4 p-3.5 bg-[#111] rounded-xl border border-[#1a1a1a]">
          <div className={`flex items-center justify-between ${showVerify ? 'mb-3.5' : ''}`}>
            <div>
              <div className="text-xs font-bold text-[#ccc] mb-0.5">Verify your vinyl?</div>
              <div className="text-[11px] text-gs-dim">Get a <span className="text-blue-500">✓ verified</span> badge on this record</div>
            </div>
            <button
              onClick={() => setShowVerify(v => !v)}
              className={`px-3.5 py-[7px] rounded-lg text-[11px] font-bold cursor-pointer ${showVerify ? 'bg-[#1a1a1a] border border-gs-border-hover text-[#666]' : 'bg-gradient-to-br from-blue-500 to-gs-indigo border-none text-white'}`}
            >
              {showVerify ? 'Skip' : '📷 Verify'}
            </button>
          </div>
          {showVerify && (
            <VinylCamera
              onVerified={() => setVerified(true)}
              onRetake={() => setVerified(false)}
            />
          )}
        </div>
      )}
      {verified && (
        <div className="mb-4 px-3.5 py-2.5 bg-blue-900/15 rounded-[10px] border border-blue-500/20 flex items-center gap-2">
          <span className="text-blue-500 text-base">✓</span>
          <span className="text-xs font-semibold text-blue-500">Vinyl verified by Claude AI</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex gap-2.5">
        <button
          onClick={() => { if ((album.trim() || artist.trim()) && !window.confirm('Discard this record? Your entries will be lost.')) return; reset(); onClose(); }}
          className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className={`flex-[2] p-[11px] border-none rounded-[10px] text-[13px] font-bold cursor-pointer text-white transition-all duration-300 ${verified ? 'bg-gradient-to-br from-green-500 to-gs-accent' : 'bg-gradient-to-br from-gs-accent to-gs-indigo'}`}
        >
          {verified ? '✓ Add Verified Record' : 'Add to Collection'}
        </button>
      </div>
    </Modal>
  );
}
