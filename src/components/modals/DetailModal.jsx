// Expanded view of a single record — opens when clicking a record's body in a Card.
// Shows full details (label, full review, all tags) and all action buttons.
// Clicking "Comments" closes this and opens CommentsModal; clicking "Buy" closes this and opens BuyModal.
// Clicking the poster row closes this and opens UserProfileModal.
import { useMemo, useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import Stars from '../ui/Stars';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import { condColor } from '../../utils/helpers';
import { USER_WISHLISTS, CONDITIONS_DETAIL } from '../../constants';
import { recordToJsonLd, injectJsonLd } from '../../utils/structuredData';

// [Improvement 1] Condition grade explanation tooltip component
function ConditionTooltip({ condition }) {
  const [show, setShow] = useState(false);
  const detail = CONDITIONS_DETAIL[condition];
  if (!detail) return null;
  return (
    <span className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(s => !s)}
        className="bg-transparent border-none cursor-pointer text-gs-dim text-[10px] p-0 ml-1 hover:text-gs-muted"
        aria-label={`Condition info: ${detail.label}`}
      >
        &#9432;
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl pointer-events-none">
          <div className="text-[11px] font-bold mb-1" style={{ color: detail.color }}>{detail.label} ({condition})</div>
          <div className="text-[10px] text-gs-muted leading-relaxed">{detail.description}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1a1a] border-r border-b border-[#333] rotate-45 -mt-1" />
        </div>
      )}
    </span>
  );
}

// [Improvement 9] Mini price history chart (sparkline) using generated mock data
function PriceHistoryChart({ record }) {
  const [show, setShow] = useState(false);
  const data = useMemo(() => {
    if (!record) return [];
    // Generate deterministic "historical" prices from the record name
    const seed = record.album.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const base = record.price || 25;
    return Array.from({ length: 12 }, (_, i) => {
      const variance = Math.sin(seed + i * 0.8) * 8 + Math.cos(seed * 0.3 + i) * 5;
      return Math.max(5, base + variance);
    });
  }, [record]);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        Show price history
      </button>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 50;
  const w = 200;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gs-dim font-mono">12-MONTH TREND</span>
        <button onClick={() => setShow(false)} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted">Hide</button>
      </div>
      <svg viewBox={`-5 -5 ${w + 10} ${h + 20}`} className="w-full" style={{ maxHeight: 80 }}>
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {data.map((v, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - ((v - min) / range) * h} r="2" fill="#10b981" opacity="0.6" />
        ))}
        {[0, 5, 11].map(i => (
          <text key={i} x={(i / 11) * w} y={h + 14} fill="#555" fontSize="7" textAnchor="middle">{months[i]}</text>
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-gs-dim mt-0.5">
        <span>Low: ${min.toFixed(2)}</span>
        <span>High: ${max.toFixed(2)}</span>
      </div>
    </div>
  );
}

// [Improvement 6] Full-screen image lightbox
function ImageLightbox({ album, artist, accent, onClose }) {
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      <div className="relative" onClick={e => e.stopPropagation()}>
        <AlbumArt album={album} artist={artist} accent={accent} size={400} />
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#222] border border-[#444] text-white text-sm font-bold cursor-pointer flex items-center justify-center hover:bg-[#333]"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// Country flags for common release countries
const COUNTRY_FLAGS = {
  US: "\uD83C\uDDFA\uD83C\uDDF8", USA: "\uD83C\uDDFA\uD83C\uDDF8",
  UK: "\uD83C\uDDEC\uD83C\uDDE7", GB: "\uD83C\uDDEC\uD83C\uDDE7",
  JP: "\uD83C\uDDEF\uD83C\uDDF5", Japan: "\uD83C\uDDEF\uD83C\uDDF5",
  DE: "\uD83C\uDDE9\uD83C\uDDEA", Germany: "\uD83C\uDDE9\uD83C\uDDEA",
  FR: "\uD83C\uDDEB\uD83C\uDDF7", France: "\uD83C\uDDEB\uD83C\uDDF7",
  CA: "\uD83C\uDDE8\uD83C\uDDE6", Canada: "\uD83C\uDDE8\uD83C\uDDE6",
  AU: "\uD83C\uDDE6\uD83C\uDDFA", Australia: "\uD83C\uDDE6\uD83C\uDDFA",
  IT: "\uD83C\uDDEE\uD83C\uDDF9", Italy: "\uD83C\uDDEE\uD83C\uDDF9",
};

export default function DetailModal({ open, onClose, record, onLike, onSave, onComment, onBuy, onViewUser, onViewArtist, onAddWishlistItem, currentUser, records, onOfferFromDetail, onVerifyRecord, onViewRecord }) {
  const [copied, setCopied] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [collectorNote, setCollectorNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Inject structured data (JSON-LD) when viewing a record (#24)
  useEffect(() => {
    if (open && record) {
      injectJsonLd(recordToJsonLd(record));
      // Load saved collector note from localStorage
      const savedNote = localStorage.getItem(`gs_note_${record.id}`);
      if (savedNote) {
        setCollectorNote(savedNote);
        setNoteSaved(true);
      } else {
        setCollectorNote('');
        setNoteSaved(false);
      }
    }
  }, [open, record]);

  // When viewing your own record, find users who have it on their wishlist
  const isOwn = record?.user === currentUser;
  const wantedBy = useMemo(() => isOwn && record
    ? Object.entries(USER_WISHLISTS)
        .filter(([, items]) => items.some(
          w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase()
        ))
        .map(([username, items]) => ({
          username,
          wishlistItem: items.find(w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase()),
        }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    : [], [isOwn, record?.album, record?.artist]);

  // Similar records — same artist or genre, excluding current record, up to 4
  const similarRecords = useMemo(() => {
    if (!record || !records) return [];
    return records
      .filter(r => r.id !== record.id && (r.artist === record.artist || r.tags?.some(t => record.tags?.includes(t))))
      .sort((a, b) => (a.artist === record.artist ? 0 : 1) - (b.artist === record.artist ? 0 : 1))
      .slice(0, 4);
  }, [record, records]);

  // Estimate market value based on condition
  const marketValue = useMemo(() => {
    if (!record) return null;
    const base = { M: 45, NM: 35, "VG+": 28, VG: 22, "G+": 15, G: 10, F: 6, P: 3 };
    const val = base[record.condition] || 20;
    // Add a bit of variance based on the record name hash
    const hash = record.album.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return (val + (hash % 15)).toFixed(2);
  }, [record]);

  // [Improvement 3] Derive catalog number and release country from record
  const catalogNumber = useMemo(() => {
    if (!record) return null;
    const hash = (record.album + record.label).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const prefix = (record.label || 'CAT').slice(0, 3).toUpperCase();
    return `${prefix}-${(hash % 9000 + 1000)}`;
  }, [record]);

  // [Improvement 4] Derive pressing info from record
  const pressingInfo = useMemo(() => {
    if (!record) return null;
    const weights = ['120g', '140g', '150g', '180g', '200g'];
    const pressings = ['Standard', 'First Pressing', 'Reissue', 'Limited Edition', 'Audiophile'];
    const hash = record.album.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      weight: weights[hash % weights.length],
      pressing: pressings[(hash + 3) % pressings.length],
    };
  }, [record]);

  const handleShare = () => {
    const url = `${window.location.origin}/record/${record.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // [Improvement 7] Save collector note to localStorage
  const handleSaveNote = useCallback(() => {
    if (!record) return;
    if (collectorNote.trim()) {
      localStorage.setItem(`gs_note_${record.id}`, collectorNote.trim());
    } else {
      localStorage.removeItem(`gs_note_${record.id}`);
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }, [record, collectorNote]);

  // [Improvement 5] Audio preview placeholder
  const handleAudioPreview = useCallback(() => {
    setAudioPlaying(prev => !prev);
    if (!audioPlaying) {
      // Simulate playback stopping after 30s
      setTimeout(() => setAudioPlaying(false), 30000);
    }
  }, [audioPlaying]);

  if (!record) return null;

  // [Improvement 3] Release country flag
  const countryFlag = record.country ? (COUNTRY_FLAGS[record.country] || null) : null;

  return (
    <Modal open={open} onClose={onClose} title="Record Detail" width="520px">
      {/* [Improvement 6] Full-screen image lightbox */}
      {showLightbox && (
        <ImageLightbox
          album={record.album}
          artist={record.artist}
          accent={record.accent}
          onClose={() => setShowLightbox(false)}
        />
      )}

      {/* Record info — more spacious layout */}
      <div className="flex gap-6 mb-6">
        <div
          className="cursor-pointer relative group"
          onClick={() => setShowLightbox(true)}
          title="Click to view full size"
        >
          <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={110} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg flex items-center justify-center">
            <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity">&#x26F6;</span>
          </div>
        </div>
        <div className="flex-1 py-1">
          <h2 className="text-[22px] font-extrabold text-gs-text tracking-tight mb-1.5 flex items-center gap-1.5">
            {record.album}
            {record.verified && <span title="Verified vinyl" className="text-blue-500 text-base">&check;</span>}
          </h2>
          <p className="text-sm text-gs-muted mb-3">
            <button
              onClick={() => { onClose(); onViewArtist?.(record.artist); }}
              className="bg-transparent border-none text-gs-muted text-sm p-0 cursor-pointer hover:text-gray-300"
            >
              {record.artist}
            </button>
          </p>
          <div className="flex gap-2 flex-wrap items-center mb-3">
            <Stars rating={record.rating} size={14} />
            {/* [Improvement 1] Condition badge with tooltip */}
            <Badge label={record.condition} color={condColor(record.condition)} />
            <ConditionTooltip condition={record.condition} />
          </div>
          {/* [Improvement 3] Catalog number and release country */}
          <span className="text-[11px] text-gs-dim font-mono">
            {record.format} &middot; {record.year} &middot; {record.label}
            {countryFlag && <span className="ml-1" title={record.country}>{countryFlag}</span>}
          </span>
          {/* [Improvement 3] Catalog number */}
          {catalogNumber && (
            <div className="text-[10px] text-gs-faint font-mono mt-1">Cat# {catalogNumber}</div>
          )}
          {/* [Improvement 4] Pressing/weight info */}
          {pressingInfo && (
            <div className="text-[10px] text-gs-faint font-mono mt-0.5">
              {pressingInfo.weight} &middot; {pressingInfo.pressing}
            </div>
          )}
        </div>
      </div>

      {/* Market value estimate with price history */}
      <div className="px-3.5 py-2.5 bg-[#111] rounded-[10px] mb-4 border border-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gs-dim font-mono tracking-wider">MARKET VALUE</span>
          <span className="text-sm font-bold text-emerald-400">~${marketValue}</span>
        </div>
        {/* [Improvement 9] Price history sparkline */}
        <PriceHistoryChart record={record} />
      </div>

      {/* [Improvement 5] Audio preview placeholder */}
      <div className="flex items-center gap-2 px-3.5 py-2 bg-[#111] rounded-[10px] mb-4 border border-[#1a1a1a]">
        <button
          onClick={handleAudioPreview}
          className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer text-sm shrink-0"
          style={{ background: audioPlaying ? `${record.accent}33` : '#1a1a1a', color: audioPlaying ? record.accent : '#888' }}
          title={audioPlaying ? 'Stop preview' : 'Play 30s preview'}
        >
          {audioPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <div className="flex-1">
          <div className="text-[11px] text-gs-dim font-mono">AUDIO PREVIEW</div>
          {audioPlaying ? (
            <div className="flex gap-[2px] items-end h-3 mt-1">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-sm"
                  style={{
                    height: `${Math.random() * 12 + 2}px`,
                    background: record.accent,
                    opacity: 0.7,
                    animation: `bounce 0.${3 + (i % 5)}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-gs-faint mt-0.5">30-second sample clip</div>
          )}
        </div>
        {audioPlaying && <span className="text-[10px] text-gs-dim font-mono">0:30</span>}
      </div>

      {/* Divider */}
      <div className="border-t border-[#1a1a1a] mb-4" />

      {/* Posted by */}
      <div
        className="flex items-center gap-2 px-3.5 py-3 bg-[#111] rounded-[10px] mb-4 cursor-pointer hover:bg-[#151515] transition-colors"
        onClick={() => { onClose(); onViewUser(record.user); }}
      >
        <Avatar username={record.user} size={28} />
        <div className="flex-1">
          <span className="text-xs text-gs-muted">Posted by </span>
          <span className="text-xs font-semibold text-gs-accent">@{record.user}</span>
        </div>
        <span className="text-[11px] text-gs-faint">&rarr; view profile</span>
      </div>

      {record.review && (
        <blockquote
          className="pl-3.5 text-[#aaa] text-[13px] leading-[1.7] italic mb-5"
          style={{ borderLeft: `2px solid ${record.accent}55` }}
        >
          &ldquo;{record.review}&rdquo;
        </blockquote>
      )}

      <div className="flex gap-1.5 flex-wrap mb-5">
        {record.tags.map(t => (
          <span key={t} className="text-[11px] px-2.5 py-[3px] rounded-full bg-[#1a1a1a] text-[#666] border border-gs-border-hover">#{t}</span>
        ))}
      </div>

      {/* [Improvement 7] Collector notes section */}
      <div className="mb-5 p-3.5 bg-[#111] rounded-[10px] border border-[#1a1a1a]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gs-dim font-mono tracking-wider">MY NOTES</span>
          {noteSaved && <span className="text-[10px] text-green-400 font-mono">Saved!</span>}
        </div>
        <textarea
          value={collectorNote}
          onChange={e => setCollectorNote(e.target.value)}
          placeholder="Add personal notes about this record (storage location, memories, etc.)"
          rows={2}
          className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none font-sans resize-y placeholder:text-gs-faint focus:border-gs-accent/40 transition-all duration-150"
        />
        <button
          onClick={handleSaveNote}
          className="mt-2 w-full py-1.5 bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-gs-muted text-[11px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors"
        >
          Save Note
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1a1a1a] mb-5" />

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onLike(record.id)}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer border"
          style={{
            background: record.liked ? record.accent + "22" : "#1a1a1a",
            borderColor: record.liked ? record.accent + "44" : "#2a2a2a",
            color: record.liked ? record.accent : "#888",
          }}
        >
          &#10084; {record.likes}
        </button>
        <button
          onClick={() => { onClose(); onComment(record); }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
        >
          &#x1F4AC; {record.comments.length}
        </button>
        <button
          onClick={() => onSave(record.id)}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer border"
          style={{
            background: record.saved ? "#f59e0b22" : "#1a1a1a",
            borderColor: record.saved ? "#f59e0b44" : "#2a2a2a",
            color: record.saved ? "#f59e0b" : "#888",
          }}
        >
          {record.saved ? "\u2605 Saved" : "\u2606 Save"}
        </button>
        {/* Add to Wishlist — only shown when viewing someone else's record */}
        {!isOwn && (
          <button
            onClick={() => onAddWishlistItem(record.album, record.artist)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
          >
            &#x2728; Wishlist
          </button>
        )}
        {/* Share — copy link to clipboard */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
        >
          {copied ? "\u2713 Copied!" : "\uD83D\uDD17 Share"}
        </button>
        {isOwn && !record.verified && onVerifyRecord && (
          <button
            onClick={() => { onClose(); onVerifyRecord(record); }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-blue-500/[0.13] border border-blue-500/[0.27] text-blue-500 text-xs font-semibold cursor-pointer"
          >
            &#x1F4F7; Verify
          </button>
        )}
        {record.forSale && (
          <button
            onClick={() => { onClose(); onBuy(record); }}
            className="ml-auto px-[18px] py-2.5 rounded-lg border-none text-black font-extrabold text-[13px] cursor-pointer"
            style={{ background: `linear-gradient(135deg,${record.accent},#6366f1)` }}
          >
            Buy &middot; ${record.price}
          </button>
        )}
      </div>

      {/* [Improvement 8] Price negotiation quick button */}
      {record.forSale && !isOwn && (
        <div className="mt-3">
          {!showNegotiate ? (
            <button
              onClick={() => { setShowNegotiate(true); setOfferAmount(String(Math.floor((record.price || 20) * 0.85))); }}
              className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-gs-dim text-[11px] font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors font-mono"
            >
              &#x1F4B0; Make an Offer
            </button>
          ) : (
            <div className="p-3 bg-[#111] border border-[#1a1a1a] rounded-lg">
              <div className="text-[11px] text-gs-dim font-mono mb-2">YOUR OFFER</div>
              <div className="flex gap-2 items-center">
                <span className="text-gs-muted text-sm font-bold">$</span>
                <input
                  type="number"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-sm outline-none font-mono focus:border-gs-accent/40 transition-colors"
                  placeholder="0.00"
                  min="1"
                />
                <button
                  onClick={() => { onOfferFromDetail?.(record, record.user, { amount: parseFloat(offerAmount) }); setShowNegotiate(false); }}
                  disabled={!offerAmount || parseFloat(offerAmount) <= 0}
                  className="px-4 py-2 rounded-lg border-none text-white text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(135deg,${record.accent},#6366f1)` }}
                >
                  Send
                </button>
                <button
                  onClick={() => setShowNegotiate(false)}
                  className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              {record.price && (
                <div className="flex gap-2 mt-2">
                  {[0.8, 0.85, 0.9, 0.95].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setOfferAmount(String(Math.floor(record.price * pct)))}
                      className="flex-1 py-1 bg-[#1a1a1a] border border-gs-border-hover rounded text-[10px] text-gs-dim font-mono cursor-pointer hover:border-gs-accent/40 transition-colors"
                    >
                      {Math.round(pct * 100)}% (${Math.floor(record.price * pct)})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {wantedBy.length > 0 && (
        <div className="mt-5 border-t border-[#1a1a1a] pt-4">
          <div className="text-[11px] text-gs-dim font-mono mb-2.5 tracking-widest">WANTED BY</div>
          <div className="flex flex-col gap-2">
            {wantedBy.map(({ username, wishlistItem }) => (
              <div key={username} className="flex items-center gap-2.5 px-3 py-2 bg-[#111] rounded-[10px]">
                <Avatar username={username} size={28} />
                <span className="flex-1 text-xs font-semibold text-gs-accent">@{username}</span>
                <button
                  onClick={() => onOfferFromDetail(record, username, wishlistItem)}
                  className="px-3 py-[5px] rounded-[7px] border-none text-white font-bold text-[11px] cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)" }}
                >
                  Offer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Records */}
      {similarRecords.length > 0 && (
        <div className="mt-5 border-t border-[#1a1a1a] pt-4">
          <div className="text-[11px] text-gs-dim font-mono mb-3 tracking-widest">SIMILAR RECORDS</div>
          <div className="grid grid-cols-4 gap-2.5">
            {similarRecords.map(r => (
              <button
                key={r.id}
                onClick={() => onViewRecord?.(r)}
                className="bg-[#111] rounded-[10px] p-2 border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors flex flex-col items-center gap-1.5 text-center"
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={56} />
                <div className="text-[10px] font-bold text-gs-text truncate w-full">{r.album}</div>
                <div className="text-[9px] text-gs-dim truncate w-full">{r.artist}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
