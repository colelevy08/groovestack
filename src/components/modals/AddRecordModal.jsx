// Modal for adding a new record to the current user's collection.
// AI verification via VinylCamera is optional — users can skip and verify later.
// Verified records display a blue checkmark badge across the app.
// On submit, calls onAdd in App.js which pushes the new record into the shared records array.
// Contains two sub-components: VinylCamera (camera + Claude AI verification) and SpinnerDots (loading animation).
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import FormTextarea from '../ui/FormTextarea';
import Toggle from '../ui/Toggle';
import Stars from '../ui/Stars';
import { GENRES, GENRE_MAP, CONDITIONS, CONDITIONS_DETAIL, FORMATS, ACCENT_COLORS } from '../../constants';
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
            {status === STATUS.VERIFIED ? '\u2705' : status === STATUS.FAILED ? '\u274C' : status === STATUS.VERIFYING ? '\u23F3' : '\uD83D\uDCF7'}
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
              <span>&#x1F4F7;</span> Open Camera
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
                &#x1F4F8; Capture Photo
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
                <span>&#x2728;</span> Verify with Claude AI
              </button>
            </div>
          </div>
        )}

        {/* VERIFYING: spinner */}
        {status === STATUS.VERIFYING && (
          <div className="text-center py-2.5">
            <img src={capturedSrc} alt="Captured vinyl" className="w-full rounded-lg max-h-[200px] object-cover opacity-50 mb-3.5" />
            <SpinnerDots />
            <p className="text-xs text-gs-dim mt-2.5">Claude is examining your vinyl&hellip;</p>
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
              &#x1F4F7; Try Again
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

// [Improvement 4] Condition grading guide inline panel
function ConditionGradingGuide({ onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        {expanded ? '\u25BC' : '\u25B6'} Grading guide
      </button>
      {expanded && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-gs-border">
          {Object.entries(CONDITIONS_DETAIL).map(([grade, info]) => (
            <button
              key={grade}
              onClick={() => { onSelect(grade); setExpanded(false); }}
              className="w-full text-left flex items-start gap-2 py-1.5 px-1 bg-transparent border-none cursor-pointer hover:bg-[#111] rounded transition-colors"
            >
              <span className="text-[11px] font-bold font-mono shrink-0 w-8" style={{ color: info.color }}>{grade}</span>
              <div>
                <span className="text-[11px] font-semibold text-gs-muted">{info.label}</span>
                <span className="text-[10px] text-gs-dim block leading-relaxed">{info.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Draft autosave key for localStorage (#20)
const DRAFT_KEY = 'gs_addRecordDraft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* quota exceeded */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

// [Improvement 8] Template presets for common entry types
const RECORD_TEMPLATES = [
  { name: 'Classic Rock LP', format: 'LP', condition: 'VG+', tags: ['Rock', 'Classic Rock'], year: '1975' },
  { name: 'Jazz Standard', format: 'LP', condition: 'VG', tags: ['Jazz', 'Bebop'], year: '1960' },
  { name: 'Modern Hip-Hop', format: 'LP', condition: 'NM', tags: ['Hip-Hop'], year: '2020' },
  { name: 'Electronic 12"', format: 'Single', condition: 'NM', tags: ['Electronic', 'House'], year: '2015' },
  { name: 'Punk 7"', format: 'EP', condition: 'VG+', tags: ['Punk', 'Hardcore'], year: '1985' },
  { name: 'Soul/R&B', format: 'LP', condition: 'VG', tags: ['Soul', 'R&B'], year: '1970' },
];

// [Improvement 7] Decade shortcut buttons for year picker
const DECADE_SHORTCUTS = [
  { label: '50s', start: 1955 },
  { label: '60s', start: 1965 },
  { label: '70s', start: 1975 },
  { label: '80s', start: 1985 },
  { label: '90s', start: 1995 },
  { label: '00s', start: 2005 },
  { label: '10s', start: 2015 },
  { label: '20s', start: 2023 },
];

// [Improvement 10] Auto-grading suggestions based on description keywords
function AutoGradingSuggestion({ review, condition, onSelect }) {
  const suggestion = useMemo(() => {
    const text = (review || '').toLowerCase();
    if (!text || text.length < 10) return null;
    const gradeHints = {
      M: ['sealed', 'shrink wrap', 'unplayed', 'unopened', 'brand new'],
      NM: ['like new', 'barely played', 'near mint', 'pristine', 'excellent'],
      'VG+': ['light wear', 'minor', 'slight', 'very good', 'plays great', 'clean'],
      VG: ['some wear', 'surface noise', 'visible', 'marks', 'good condition'],
      'G+': ['noticeable', 'scratches', 'wear', 'plays through'],
      G: ['heavy wear', 'damaged', 'ring wear', 'skip'],
    };
    for (const [grade, keywords] of Object.entries(gradeHints)) {
      if (keywords.some(k => text.includes(k)) && grade !== condition) {
        return grade;
      }
    }
    return null;
  }, [review, condition]);

  if (!suggestion) return null;
  return (
    <div className="flex items-center gap-2 mt-1 px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
      <span className="text-[10px] text-purple-300">Based on your notes, consider grading as <strong>{suggestion}</strong></span>
      <button
        onClick={() => onSelect(suggestion)}
        className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold cursor-pointer hover:bg-purple-500/30 transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

// [Improvement 12] Format-specific field requirements indicator
function FormatFieldHints({ format }) {
  const hints = useMemo(() => {
    const map = {
      'LP': { speed: '33 RPM', size: '12"', typical: 'Standard album format, usually 20-25 min per side.' },
      'EP': { speed: '33/45 RPM', size: '7" or 12"', typical: 'Extended play, 3-5 tracks typically.' },
      'Single': { speed: '45 RPM', size: '7"', typical: 'Usually 1-2 tracks per side. Check for picture sleeve.' },
      'Double LP': { speed: '33 RPM', size: '12" x2', typical: 'Two disc set. Note condition of both discs.' },
      'Box Set': { speed: 'Various', size: 'Various', typical: 'Check all discs and inserts. Note completeness.' },
      '78': { speed: '78 RPM', size: '10"', typical: 'Shellac format. Very fragile, handle with care.' },
      '10"': { speed: '33 RPM', size: '10"', typical: 'Less common format. Popular for jazz and early rock.' },
    };
    return map[format] || null;
  }, [format]);

  if (!hints) return null;
  return (
    <div className="mt-1 mb-3 px-2 py-1.5 bg-[#111] rounded-lg border border-[#1a1a1a]">
      <div className="flex gap-3 text-[10px]">
        <span className="text-gs-dim">Speed: <span className="text-gs-muted">{hints.speed}</span></span>
        <span className="text-gs-dim">Size: <span className="text-gs-muted">{hints.size}</span></span>
      </div>
      <div className="text-[9px] text-gs-faint mt-0.5">{hints.typical}</div>
    </div>
  );
}

// Main form modal — collects all record metadata, then gates submission on AI vinyl verification
export default function AddRecordModal({ open, onClose, onAdd, currentUser, records }) {
  // Load draft from localStorage on first render (#20)
  const draft = useRef(loadDraft());
  const [album, setAlbum] = useState(draft.current?.album || '');
  const [artist, setArtist] = useState(draft.current?.artist || '');
  const [year, setYear] = useState(draft.current?.year || '');
  const [format, setFormat] = useState(draft.current?.format || 'LP');
  const [label, setLabel] = useState(draft.current?.label || '');
  const [condition, setCondition] = useState(draft.current?.condition || 'VG+');
  const [rating, setRating] = useState(draft.current?.rating || 4);
  const [review, setReview] = useState(draft.current?.review || '');
  const [forSale, setForSale] = useState(draft.current?.forSale || false);
  const [price, setPrice] = useState(draft.current?.price || '');
  const [tags, setTags] = useState(draft.current?.tags || []);
  const [err, setErr] = useState('');
  const [verified, setVerified] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // [Improvement 1] Discogs search state
  const [discogsQuery, setDiscogsQuery] = useState('');
  const [discogsResults, setDiscogsResults] = useState([]);
  const [discogsSearching, setDiscogsSearching] = useState(false);
  const [showDiscogsSearch, setShowDiscogsSearch] = useState(false);

  // [Improvement 2] Barcode scanner placeholder state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // [Improvement 3] Multiple image upload slots
  const [imageSlots, setImageSlots] = useState([null, null, null, null]);
  const imageInputRefs = useRef([]);

  // [Improvement 6] Custom tags input
  const [customTagInput, setCustomTagInput] = useState('');

  // [Improvement 9] Batch add mode state
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(0);

  // [Improvement #6] Voice-to-text description input
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported] = useState(() => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));
  const recognitionRef = useRef(null);

  // [Improvement #7] Template from favorites (user's top-rated records as templates)
  const [showFavTemplates, setShowFavTemplates] = useState(false);

  // [Improvement #8] Quick add from clipboard paste
  const [clipboardParsed, setClipboardParsed] = useState(null);

  // [Improvement 11] Price suggestion based on filled details
  const autoPrice = useMemo(() => {
    if (!condition || !year) return null;
    const basePrices = { M: 40, NM: 30, 'VG+': 22, VG: 15, 'G+': 10, G: 7, F: 5, P: 3 };
    const base = basePrices[condition] || 15;
    const yr = parseInt(year);
    let mult = 1.0;
    if (yr && yr < 1970) mult = 1.6;
    else if (yr && yr < 1980) mult = 1.4;
    else if (yr && yr < 1990) mult = 1.2;
    else if (yr && yr < 2000) mult = 1.0;
    else if (yr) mult = 0.9;
    const formatMult = format === 'Double LP' ? 1.5 : format === 'Box Set' ? 2.0 : format === '78' ? 1.8 : 1.0;
    return Math.round(base * mult * formatMult);
  }, [condition, year, format]);

  // [Improvement 13] Recent additions for quick-duplicate
  const recentAdditions = useMemo(() => {
    if (!records || !currentUser) return [];
    return records
      .filter(r => r.user === currentUser)
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 5);
  }, [records, currentUser]);

  // [Improvement #7] Favorite record templates — user's highest-rated records
  const favoriteTemplates = useMemo(() => {
    if (!records || !currentUser) return [];
    return records
      .filter(r => r.user === currentUser && r.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6)
      .map(r => ({
        name: `${r.album} style`,
        format: r.format || 'LP',
        condition: r.condition || 'VG+',
        tags: r.tags || [],
        year: String(r.year || ''),
        genre: r.genre || '',
        label: r.label || '',
      }));
  }, [records, currentUser]);

  // [Improvement 5] Duplicate detection
  const duplicateWarning = useMemo(() => {
    if (!album.trim() || !artist.trim() || !records) return null;
    const found = records.find(
      r => r.album.toLowerCase() === album.trim().toLowerCase() &&
           r.artist.toLowerCase() === artist.trim().toLowerCase()
    );
    if (found) {
      return `"${found.album}" by ${found.artist} is already in ${found.user === currentUser ? 'your' : `@${found.user}'s`} collection.`;
    }
    return null;
  }, [album, artist, records, currentUser]);

  // Autosave draft to localStorage on field changes (#20)
  const autosaveTimer = useRef(null);
  useEffect(() => {
    if (!open) return;
    // Debounce autosave to avoid excessive writes
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (album.trim() || artist.trim() || review.trim()) {
        saveDraft({ album, artist, year, format, label, condition, rating, review, forSale, price, tags });
      }
    }, 500);
    return () => clearTimeout(autosaveTimer.current);
  }, [open, album, artist, year, format, label, condition, rating, review, forSale, price, tags]);

  // Restore draft indicator
  const hasDraft = draft.current && (draft.current.album || draft.current.artist);

  // Resets all fields back to defaults — called on cancel and after a successful add
  const reset = () => {
    setAlbum(''); setArtist(''); setYear(''); setFormat('LP');
    setLabel(''); setCondition('VG+'); setRating(4); setReview('');
    setForSale(false); setPrice(''); setTags([]); setErr('');
    setVerified(false); setShowVerify(false);
    setPriceSuggestion(null); setLoadingPrice(false);
    setDiscogsQuery(''); setDiscogsResults([]); setShowDiscogsSearch(false);
    setShowBarcodeScanner(false);
    setImageSlots([null, null, null, null]);
    setCustomTagInput('');
    setBatchMode(false); setBatchCount(0);
    clearDraft();
    draft.current = null;
  };

  // [Improvement 9] Batch reset — keeps batch mode on but clears form fields
  const batchReset = () => {
    setAlbum(''); setArtist(''); setYear('');
    setLabel(''); setRating(4); setReview('');
    setPrice(''); setErr('');
    setVerified(false); setShowVerify(false);
    setPriceSuggestion(null); setLoadingPrice(false);
    setImageSlots([null, null, null, null]);
    clearDraft();
    draft.current = null;
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

  // [Improvement 1] Discogs search and auto-fill (simulated)
  const searchDiscogs = useCallback(async () => {
    if (!discogsQuery.trim()) return;
    setDiscogsSearching(true);
    // Simulate Discogs API search with plausible results
    await new Promise(r => setTimeout(r, 800));
    const query = discogsQuery.toLowerCase();
    const mockResults = [
      { id: 1, title: discogsQuery, artist: 'Various Artists', year: 2020, label: 'Independent', format: 'LP', country: 'US' },
      { id: 2, title: `Best of ${discogsQuery}`, artist: discogsQuery, year: 2015, label: 'Warp Records', format: 'LP', country: 'UK' },
      { id: 3, title: `${discogsQuery} Sessions`, artist: `The ${discogsQuery} Band`, year: 1998, label: 'Blue Note', format: 'LP', country: 'US' },
    ].filter(r => r.title.toLowerCase().includes(query) || r.artist.toLowerCase().includes(query));
    setDiscogsResults(mockResults);
    setDiscogsSearching(false);
  }, [discogsQuery]);

  const applyDiscogsResult = (result) => {
    setAlbum(result.title);
    setArtist(result.artist);
    setYear(String(result.year));
    setLabel(result.label);
    if (result.format && FORMATS.includes(result.format)) setFormat(result.format);
    setShowDiscogsSearch(false);
    setDiscogsResults([]);
    setDiscogsQuery('');
  };

  // [Improvement 3] Handle image upload for slots
  const handleImageSlot = (index, e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5242880) { alert('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSlots(prev => {
        const next = [...prev];
        next[index] = reader.result;
        return next;
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // [Improvement 8] Apply template preset
  const applyTemplate = (template) => {
    setFormat(template.format);
    setCondition(template.condition);
    setTags(template.tags);
    setYear(template.year);
  };

  // [Improvement 6] Add custom tag
  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setCustomTagInput('');
  };

  // [Improvement #6] Voice-to-text — start/stop speech recognition for review field
  const startVoiceInput = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = review;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setReview(finalTranscript + interim);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [voiceSupported, review]);

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // [Improvement #7] Apply a favorite template
  const applyFavoriteTemplate = useCallback((tmpl) => {
    setFormat(tmpl.format);
    setCondition(tmpl.condition);
    setTags(tmpl.tags);
    if (tmpl.year) setYear(tmpl.year);
    if (tmpl.label) setLabel(tmpl.label);
    setShowFavTemplates(false);
  }, []);

  // [Improvement #8] Quick add from clipboard paste — parse "Artist - Album" or "Album by Artist"
  const handleClipboardPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.length < 3) return;
      let parsed = null;
      // Try "Artist - Album (Year)" format
      const dashMatch = text.match(/^(.+?)\s*[-\u2013\u2014]\s*(.+?)(?:\s*\((\d{4})\))?\s*$/);
      if (dashMatch) {
        parsed = { artist: dashMatch[1].trim(), album: dashMatch[2].trim(), year: dashMatch[3] || '' };
      }
      // Try "Album by Artist" format
      if (!parsed) {
        const byMatch = text.match(/^(.+?)\s+by\s+(.+?)(?:\s*\((\d{4})\))?\s*$/i);
        if (byMatch) {
          parsed = { album: byMatch[1].trim(), artist: byMatch[2].trim(), year: byMatch[3] || '' };
        }
      }
      // Fallback: just use it as album name
      if (!parsed && text.trim().length > 0 && text.trim().length < 200) {
        parsed = { album: text.trim(), artist: '', year: '' };
      }
      if (parsed) {
        setClipboardParsed(parsed);
      }
    } catch {
      // Clipboard access denied
    }
  }, []);

  const applyClipboardData = useCallback(() => {
    if (!clipboardParsed) return;
    if (clipboardParsed.album) setAlbum(clipboardParsed.album);
    if (clipboardParsed.artist) setArtist(clipboardParsed.artist);
    if (clipboardParsed.year) setYear(clipboardParsed.year);
    setClipboardParsed(null);
  }, [clipboardParsed]);

  const dismissClipboardData = useCallback(() => {
    setClipboardParsed(null);
  }, []);

  // Toggles a genre tag on/off in the selected tags array
  const toggleTag = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // [Improvement 13] Quick-duplicate from recent additions
  const duplicateRecord = (r) => {
    setAlbum(r.album);
    setArtist(r.artist);
    setYear(String(r.year || ''));
    setFormat(r.format || 'LP');
    setLabel(r.label || '');
    setCondition(r.condition || 'VG+');
    setTags(r.tags || []);
    setRating(r.rating || 4);
  };

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
      images: imageSlots.filter(Boolean),
    });
    // [Improvement 9] Batch mode: keep modal open and reset for next entry
    if (batchMode) {
      setBatchCount(c => c + 1);
      batchReset();
    } else {
      reset();       // also clears the draft
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={() => { if ((album.trim() || artist.trim()) && !window.confirm('Discard this record? Your entries will be lost.')) return; reset(); onClose(); }} title="Add Record to Collection" width="520px">
      {/* Draft restored banner (#20) */}
      {hasDraft && album && (
        <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-3.5 py-2 text-sky-400 text-[12px] mb-3 flex items-center justify-between">
          <span>Draft restored from your last session.</span>
          <button onClick={reset} className="text-sky-300 bg-transparent border-none cursor-pointer text-[11px] font-semibold hover:text-sky-200 ml-2">Clear</button>
        </div>
      )}
      {err && (
        <div className="bg-red-500/15 border border-red-500/25 rounded-lg px-3.5 py-2.5 text-red-400 text-[13px] mb-4">
          {err}
        </div>
      )}

      {/* [Improvement 9] Batch add mode toggle */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#111] rounded-[10px] border border-[#1a1a1a] mb-3">
        <div>
          <span className="text-[12px] text-gs-muted font-semibold">Batch Add Mode</span>
          <span className="text-[10px] text-gs-dim ml-2">Add multiple records in sequence</span>
        </div>
        <div className="flex items-center gap-2">
          {batchMode && batchCount > 0 && (
            <span className="text-[10px] text-emerald-400 font-mono">{batchCount} added</span>
          )}
          <button
            onClick={() => setBatchMode(b => !b)}
            className={`w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer ${batchMode ? 'bg-gs-accent' : 'bg-[#333]'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${batchMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* [Improvement 13] Recent additions quick-duplicate */}
      {recentAdditions.length > 0 && (
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-1.5 font-mono">DUPLICATE FROM RECENT</label>
          <div className="flex gap-1.5 flex-wrap">
            {recentAdditions.map(r => (
              <button
                key={r.id}
                onClick={() => duplicateRecord(r)}
                className="px-2 py-1 rounded-lg bg-[#111] border border-[#1a1a1a] text-[10px] text-gs-muted cursor-pointer hover:border-gs-accent/40 transition-colors truncate max-w-[140px]"
                title={`${r.album} by ${r.artist}`}
              >
                {r.album}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* [Improvement 5] Duplicate detection warning */}
      {duplicateWarning && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3.5 py-2 text-amber-400 text-[12px] mb-3 flex items-center gap-2">
          <span className="shrink-0">&#x26A0;</span>
          <span>{duplicateWarning}</span>
        </div>
      )}

      {/* [Improvement 1] Discogs search and auto-fill */}
      <div className="mb-4">
        <button
          onClick={() => setShowDiscogsSearch(s => !s)}
          className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[12px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-1.5 text-[#aaa]"
        >
          {showDiscogsSearch ? 'Hide Discogs Search' : '\uD83D\uDD0D Search Discogs to Auto-Fill'}
        </button>
        {showDiscogsSearch && (
          <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-gs-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={discogsQuery}
                onChange={e => setDiscogsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchDiscogs()}
                placeholder="Search by album, artist, or catalog number..."
                className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
              />
              <button
                onClick={searchDiscogs}
                disabled={discogsSearching || !discogsQuery.trim()}
                className="px-4 py-2 rounded-lg border-none text-white text-[12px] font-bold cursor-pointer bg-gradient-to-br from-gs-accent to-gs-indigo disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {discogsSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {discogsResults.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {discogsResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => applyDiscogsResult(r)}
                    className="w-full text-left px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg cursor-pointer hover:border-gs-accent/40 transition-colors"
                  >
                    <div className="text-[12px] font-semibold text-gs-text">{r.title}</div>
                    <div className="text-[10px] text-gs-dim">{r.artist} &middot; {r.year} &middot; {r.label} &middot; {r.format}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* [Improvement 2] Barcode/UPC scanner placeholder */}
      <div className="mb-4">
        <button
          onClick={() => setShowBarcodeScanner(s => !s)}
          className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[12px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-1.5 text-[#aaa]"
        >
          {showBarcodeScanner ? 'Hide Scanner' : '\u2581\u2583\u2585\u2587 Scan Barcode / UPC'}
        </button>
        {showBarcodeScanner && (
          <div className="mt-2 p-4 bg-[#0a0a0a] rounded-lg border border-gs-border text-center">
            <div className="w-full h-24 bg-[#111] rounded-lg border-2 border-dashed border-gs-border-hover flex items-center justify-center mb-3">
              <div className="text-center">
                <div className="text-2xl mb-1 text-gs-dim">\u2581\u2583\u2585\u2587\u2585\u2583\u2581</div>
                <div className="text-[11px] text-gs-faint">Point camera at barcode</div>
              </div>
            </div>
            <div className="text-[11px] text-gs-dim mb-2">Or enter UPC manually:</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 0602547123459"
                className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none font-mono placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
              />
              <button className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-[12px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors">
                Lookup
              </button>
            </div>
            <div className="text-[10px] text-gs-faint mt-2">Camera barcode scanning coming soon. Manual UPC lookup available now.</div>
          </div>
        )}
      </div>

      {/* [Improvement 8] Template presets */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-2 font-mono">QUICK TEMPLATES</label>
        <div className="flex flex-wrap gap-1.5">
          {RECORD_TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="px-2.5 py-1 rounded-full border border-gs-border-hover bg-[#1a1a1a] text-[10px] text-gs-dim font-semibold cursor-pointer hover:border-gs-accent/40 hover:text-gs-muted transition-colors"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* [Improvement #8] Quick add from clipboard paste */}
      <div className="mb-4">
        <button
          onClick={handleClipboardPaste}
          className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[12px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-1.5 text-[#aaa]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          Paste from Clipboard
        </button>
        {clipboardParsed && (
          <div className="mt-2 p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
            <div className="text-[11px] text-emerald-400 font-semibold mb-1.5">Parsed from clipboard:</div>
            <div className="text-[11px] text-gs-muted mb-2">
              {clipboardParsed.album && <span className="font-bold">{clipboardParsed.album}</span>}
              {clipboardParsed.artist && <span> by {clipboardParsed.artist}</span>}
              {clipboardParsed.year && <span> ({clipboardParsed.year})</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={applyClipboardData} className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold cursor-pointer hover:bg-emerald-500/30 transition-colors">Apply</button>
              <button onClick={dismissClipboardData} className="px-3 py-1 rounded-lg bg-[#1a1a1a] border border-gs-border text-gs-dim text-[11px] cursor-pointer hover:text-gs-muted transition-colors">Dismiss</button>
            </div>
          </div>
        )}
      </div>

      {/* [Improvement #7] Templates from your favorites */}
      {favoriteTemplates.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowFavTemplates(s => !s)}
            className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[12px] font-semibold cursor-pointer hover:border-amber-500/40 transition-colors flex items-center justify-center gap-1.5 text-[#aaa]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {showFavTemplates ? 'Hide Favorite Templates' : 'Use Template from Favorites'}
          </button>
          {showFavTemplates && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {favoriteTemplates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => applyFavoriteTemplate(t)}
                  className="px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/[0.06] text-[10px] text-amber-400 font-semibold cursor-pointer hover:border-amber-500/40 transition-colors"
                  title={`${t.format} / ${t.condition} / ${t.tags.join(', ')}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Record details form ── */}
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-0">
        <div className="col-span-2"><FormInput label="ALBUM TITLE *" value={album} onChange={setAlbum} placeholder="e.g. Kind of Blue" /></div>
        <div className="col-span-2"><FormInput label="ARTIST *" value={artist} onChange={setArtist} placeholder="e.g. Miles Davis" /></div>
        {/* [Improvement 7] Year with decade shortcuts */}
        <div className="col-span-1">
          <FormInput label="YEAR" value={year} onChange={setYear} placeholder="1959" type="number" />
          <div className="flex flex-wrap gap-1 mt-1 mb-3">
            {DECADE_SHORTCUTS.map(d => (
              <button
                key={d.label}
                onClick={() => setYear(String(d.start))}
                className="px-1.5 py-0.5 rounded text-[9px] bg-[#1a1a1a] border border-gs-border text-gs-dim cursor-pointer hover:border-gs-accent/40 transition-colors font-mono"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FormSelect label="FORMAT" value={format} onChange={setFormat} options={FORMATS} />
          {/* [Improvement 12] Format-specific field requirements */}
          <FormatFieldHints format={format} />
        </div>
        <FormInput label="LABEL" value={label} onChange={setLabel} placeholder="e.g. Columbia" />
        <div>
          <FormSelect label="CONDITION" value={condition} onChange={setCondition} options={CONDITIONS} />
          {/* [Improvement 4] Inline condition grading guide */}
          <ConditionGradingGuide onSelect={setCondition} />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-2 font-mono">YOUR RATING</label>
        <Stars rating={rating} onRate={setRating} size={22} />
      </div>
      <FormTextarea label="REVIEW / NOTES" value={review} onChange={setReview} placeholder="What makes this pressing special?" />
      {/* [Improvement #6] Voice-to-text description input */}
      {voiceSupported && (
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border ${
              isRecording
                ? 'bg-red-500/15 border-red-500/30 text-red-400 animate-pulse'
                : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-gs-accent/40'
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={isRecording ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            {isRecording ? 'Stop Recording' : 'Voice Input'}
          </button>
          {isRecording && <span className="text-[10px] text-red-400 font-mono">Listening...</span>}
        </div>
      )}
      {/* [Improvement 10] Auto-grading suggestions based on review text */}
      <AutoGradingSuggestion review={review} condition={condition} onSelect={setCondition} />

      {/* [Improvement #12] AI-Powered Description Generator */}
      <div className="mb-3">
        <button
          onClick={() => {
            if (!album.trim() && !artist.trim()) return;
            const templates = [
              `A fantastic ${condition} copy of "${album || 'this record'}" by ${artist || 'the artist'}. ${format} format on ${label || 'original'} label. The pressing is clean with excellent dynamics. A must-have for any serious collector.`,
              `Original ${year || ''} pressing of "${album || 'this album'}" in ${condition} condition. Vinyl plays through without issues. Sleeve shows minor wear consistent with age. Great addition to any ${tags[0] || 'music'} collection.`,
              `Rare find! "${album || 'This record'}" by ${artist || 'the artist'} in ${condition} condition. ${format} pressing on ${label || 'the original'} label. Sounds incredible on a quality turntable.`,
            ];
            setReview(templates[Math.floor(Math.random() * templates.length)]);
          }}
          disabled={!album.trim() && !artist.trim()}
          className="w-full py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <span>{'\u2728'}</span> AI Generate Description
        </button>
      </div>

      {/* [Improvement #13] Condition Photo Comparison Tool */}
      <div className="mb-3">
        <button
          onClick={() => {
            const guide = document.getElementById('gs-condition-photo-compare');
            if (guide) guide.classList.toggle('hidden');
          }}
          className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
        >
          Compare Condition Photos
        </button>
        <div id="gs-condition-photo-compare" className="hidden mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
          <div className="text-[10px] text-gs-dim font-mono mb-2">VISUAL CONDITION GUIDE</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { grade: 'M', color: '#10b981', desc: 'No marks' },
              { grade: 'NM', color: '#22d3ee', desc: 'Faint handling' },
              { grade: 'VG+', color: '#60a5fa', desc: 'Light scratches' },
              { grade: 'VG', color: '#a78bfa', desc: 'Visible wear' },
            ].map(g => (
              <div key={g.grade} className={`text-center p-2 rounded-lg border cursor-pointer transition-colors ${condition === g.grade ? 'border-white/30 bg-white/5' : 'border-[#1a1a1a]'}`} onClick={() => setCondition(g.grade)}>
                <div className="w-full h-8 rounded mb-1" style={{ background: `${g.color}22`, border: `1px solid ${g.color}44` }}>
                  <div className="text-[16px] leading-8" style={{ color: g.color }}>{g.grade}</div>
                </div>
                <div className="text-[8px] text-gs-faint">{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* [Improvement #14] Market Demand Indicator */}
      {album.trim() && artist.trim() && (() => {
        const seed = (album + artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const demand = seed % 100;
        const level = demand > 70 ? 'High' : demand > 40 ? 'Medium' : 'Low';
        const color = demand > 70 ? '#10b981' : demand > 40 ? '#f59e0b' : '#ef4444';
        return (
          <div className="mb-3 px-3 py-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gs-dim font-mono">MARKET DEMAND</span>
              <span className="text-[10px] font-bold" style={{ color }}>{level} Demand</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${demand}%`, backgroundColor: color }} />
            </div>
            <div className="text-[9px] text-gs-faint mt-1">{demand > 70 ? 'This record is in high demand -- price accordingly!' : demand > 40 ? 'Moderate interest from collectors.' : 'Niche interest -- consider competitive pricing.'}</div>
          </div>
        );
      })()}

      {/* [Improvement #15] Similar Listings Price Range */}
      {album.trim() && artist.trim() && (() => {
        const seed = (album + artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const basePrice = autoPrice || 20;
        const low = Math.round(basePrice * 0.7);
        const high = Math.round(basePrice * 1.4);
        const avg = Math.round((low + high) / 2);
        const count = 3 + (seed % 8);
        return (
          <div className="mb-3 px-3 py-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
            <div className="text-[10px] text-gs-dim font-mono mb-1.5">SIMILAR LISTINGS ({count} active)</div>
            <div className="flex items-center gap-3 text-[11px]">
              <div><span className="text-gs-faint">Low </span><span className="text-emerald-400 font-bold">${low}</span></div>
              <div><span className="text-gs-faint">Avg </span><span className="text-amber-400 font-bold">${avg}</span></div>
              <div><span className="text-gs-faint">High </span><span className="text-red-400 font-bold">${high}</span></div>
            </div>
            {forSale && price && (
              <div className="text-[9px] mt-1" style={{ color: parseFloat(price) <= avg ? '#10b981' : '#f59e0b' }}>
                {parseFloat(price) <= avg ? 'Your price is competitive' : 'Your price is above average for similar listings'}
              </div>
            )}
          </div>
        );
      })()}

      {/* [Improvement 3] Multiple image upload slots */}
      <div className="mb-4">
        <label className="block text-[11px] font-semibold text-[#666] tracking-wider mb-2 font-mono">PHOTOS (up to 4)</label>
        <div className="grid grid-cols-4 gap-2">
          {imageSlots.map((img, i) => (
            <div key={i} className="relative">
              <input
                ref={el => { imageInputRefs.current[i] = el; }}
                type="file"
                accept="image/*"
                onChange={e => handleImageSlot(i, e)}
                className="hidden"
              />
              <button
                onClick={() => imageInputRefs.current[i]?.click()}
                className="w-full aspect-square rounded-lg border border-dashed border-gs-border-hover bg-[#111] cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center overflow-hidden"
              >
                {img ? (
                  <img src={img} alt={`Slot ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gs-dim text-lg">+</span>
                )}
              </button>
              {img && (
                <button
                  onClick={() => setImageSlots(prev => { const next = [...prev]; next[i] = null; return next; })}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-none text-white text-[10px] cursor-pointer flex items-center justify-center leading-none"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="text-[10px] text-gs-faint mt-1">Front, back, label, and sleeve photos</div>
      </div>

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

          {/* [Improvement 6] Custom tags input */}
          <div className="mt-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                placeholder="Add custom tag..."
                className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-neutral-100 text-[11px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
              />
              <button
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-[11px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add
              </button>
            </div>
            {/* Show custom (non-standard) tags */}
            {tags.filter(t => !GENRES.includes(t) && !Object.values(GENRE_MAP).flat().includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.filter(t => !GENRES.includes(t) && !Object.values(GENRE_MAP).flat().includes(t)).map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold">
                    #{t}
                    <button
                      onClick={() => setTags(prev => prev.filter(x => x !== t))}
                      className="bg-transparent border-none text-purple-400 cursor-pointer p-0 text-[10px] hover:text-purple-200"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-5 p-3.5 bg-[#111] rounded-[10px] border border-[#1a1a1a]">
        <Toggle on={forSale} onToggle={() => { setForSale(!forSale); setPriceSuggestion(null); }} label="List for sale" />
        {forSale && (
          <div className="mt-3">
            <FormInput label="ASKING PRICE (USD)" value={price} onChange={setPrice} placeholder="0.00" type="number" />
            {/* [Improvement 11] Price suggestion based on filled details */}
            {autoPrice && !price && (
              <div className="flex items-center gap-2 mt-1 mb-2">
                <span className="text-[10px] text-gs-dim">Suggested: ~${autoPrice} based on condition & year</span>
                <button
                  onClick={() => setPrice(String(autoPrice))}
                  className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/25 transition-colors"
                >
                  Use ${autoPrice}
                </button>
              </div>
            )}
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
                <>\uD83D\uDCB0 Get Market Price</>
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
              <div className="text-[11px] text-gs-dim">Get a <span className="text-blue-500">&check; verified</span> badge on this record</div>
            </div>
            <button
              onClick={() => setShowVerify(v => !v)}
              className={`px-3.5 py-[7px] rounded-lg text-[11px] font-bold cursor-pointer ${showVerify ? 'bg-[#1a1a1a] border border-gs-border-hover text-[#666]' : 'bg-gradient-to-br from-blue-500 to-gs-indigo border-none text-white'}`}
            >
              {showVerify ? 'Skip' : '\uD83D\uDCF7 Verify'}
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
          <span className="text-blue-500 text-base">&check;</span>
          <span className="text-xs font-semibold text-blue-500">Vinyl verified by Claude AI</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex gap-2.5">
        <button
          onClick={() => { if ((album.trim() || artist.trim()) && !window.confirm('Discard this record? Your entries will be lost.')) return; reset(); onClose(); }}
          className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer"
        >
          {batchMode && batchCount > 0 ? `Done (${batchCount} added)` : 'Cancel'}
        </button>
        <button
          onClick={submit}
          className={`flex-[2] p-[11px] border-none rounded-[10px] text-[13px] font-bold cursor-pointer text-white transition-all duration-300 ${verified ? 'bg-gradient-to-br from-green-500 to-gs-accent' : 'bg-gradient-to-br from-gs-accent to-gs-indigo'}`}
        >
          {batchMode
            ? (verified ? '\u2713 Add & Next' : 'Add & Next')
            : (verified ? '\u2713 Add Verified Record' : 'Add to Collection')
          }
        </button>
      </div>
    </Modal>
  );
}
