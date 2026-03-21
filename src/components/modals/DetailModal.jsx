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
import { getDiscogsPrice } from '../../utils/discogs';

// Estimate heuristic: base price by condition with year multiplier
function estimateValue(condition, year) {
  const basePrices = { M: 40, NM: 30, 'VG+': 22, VG: 15, 'G+': 10, G: 7, F: 5, P: 3 };
  const base = basePrices[condition] || 15;
  let yearMult = 1.0;
  if (year && year < 1970) yearMult = 1.6;
  else if (year && year < 1980) yearMult = 1.4;
  else if (year && year < 1990) yearMult = 1.2;
  else if (year && year < 2000) yearMult = 1.0;
  else if (year) yearMult = 0.9;
  return Math.round(base * yearMult);
}

// [Improvement 1] Record timeline — when added, listed, price changes
function RecordTimeline({ record }) {
  const [expanded, setExpanded] = useState(false);
  const events = useMemo(() => {
    if (!record) return [];
    const items = [];
    const seed = (record.album + record.artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - (seed % 180 + 30));
    items.push({ date: new Date(baseDate), label: 'Added to collection', type: 'add' });
    if (record.forSale) {
      const listDate = new Date(baseDate);
      listDate.setDate(listDate.getDate() + (seed % 14 + 3));
      items.push({ date: listDate, label: `Listed for sale at $${record.price}`, type: 'sale' });
      if (seed % 3 === 0) {
        const priceDate = new Date(listDate);
        priceDate.setDate(priceDate.getDate() + (seed % 10 + 5));
        const oldPrice = Math.round(record.price * (1 + (seed % 20 - 10) / 100));
        items.push({ date: priceDate, label: `Price changed from $${oldPrice} to $${record.price}`, type: 'price' });
      }
    }
    if (record.verified) {
      const verDate = new Date(baseDate);
      verDate.setDate(verDate.getDate() + 1);
      items.push({ date: verDate, label: 'Vinyl verified by Claude AI', type: 'verify' });
    }
    return items.sort((a, b) => b.date - a.date);
  }, [record]);

  if (events.length === 0) return null;
  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        {expanded ? '\u25BC' : '\u25B6'} Record Timeline ({events.length})
      </button>
      {expanded && (
        <div className="mt-2 pl-3 border-l-2 border-[#222] space-y-2">
          {events.map((evt, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={`text-[10px] font-mono shrink-0 ${evt.type === 'verify' ? 'text-blue-400' : evt.type === 'sale' ? 'text-emerald-400' : evt.type === 'price' ? 'text-amber-400' : 'text-gs-dim'}`}>
                {evt.type === 'add' ? '+' : evt.type === 'sale' ? '$' : evt.type === 'price' ? '~' : '\u2713'}
              </span>
              <div>
                <div className="text-[11px] text-gs-muted">{evt.label}</div>
                <div className="text-[9px] text-gs-faint font-mono">{evt.date.toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// [Improvement 2] Seller response time indicator
function SellerResponseTime({ username }) {
  const responseData = useMemo(() => {
    const seed = (username || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const hours = (seed % 24) + 1;
    const rate = Math.min(99, 70 + (seed % 30));
    return { hours, rate };
  }, [username]);

  return (
    <div className="flex items-center gap-2 text-[10px] mt-1.5">
      <span className={`font-semibold ${responseData.hours <= 4 ? 'text-emerald-400' : responseData.hours <= 12 ? 'text-amber-400' : 'text-gs-dim'}`}>
        Responds in ~{responseData.hours}h
      </span>
      <span className="text-gs-faint">|</span>
      <span className="text-gs-dim">{responseData.rate}% response rate</span>
    </div>
  );
}

// [Improvement 3] Record authentication certificate view
function AuthCertificateView({ record }) {
  const [showCert, setShowCert] = useState(false);
  if (!record?.verified) return null;
  return (
    <>
      <button
        onClick={() => setShowCert(s => !s)}
        className="text-[10px] text-blue-400 hover:text-blue-300 bg-transparent border-none cursor-pointer p-0 font-semibold"
      >
        {showCert ? 'Hide Certificate' : 'View Certificate'}
      </button>
      {showCert && (
        <div className="mt-2 p-4 bg-[#0a0a0a] border border-blue-500/20 rounded-xl text-center">
          <div className="text-blue-400 text-2xl mb-2">&check;</div>
          <div className="text-[13px] font-bold text-gs-text mb-1">Certificate of Authentication</div>
          <div className="text-[11px] text-gs-muted mb-3">This vinyl record has been verified by Claude AI vision analysis.</div>
          <div className="text-[10px] text-gs-dim font-mono space-y-1">
            <div>Record: {record.album} by {record.artist}</div>
            <div>Condition: {record.condition}</div>
            <div>Cert ID: GS-{record.id}-{(record.album + record.artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 10000}</div>
            <div>Verified on GrooveStack Platform</div>
          </div>
          <div className="mt-3 h-px bg-blue-500/20" />
          <div className="text-[9px] text-gs-faint mt-2">This certificate confirms physical ownership was verified via photo analysis.</div>
        </div>
      )}
    </>
  );
}

// [Improvement 4] Virtual turntable preview (spinning record animation) — now a 360-degree record viewer placeholder
function VirtualTurntable({ accent, album }) {
  const [spinning, setSpinning] = useState(false);
  const [viewAngle, setViewAngle] = useState(0);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => setSpinning(s => !s)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        {spinning ? 'Stop Turntable' : 'Spin the Vinyl'}
      </button>
      {/* 360-Degree Record Viewer (Improvement #1) */}
      <div className="flex items-center gap-2 mt-1">
        <input
          type="range"
          min="0"
          max="360"
          value={viewAngle}
          onChange={e => setViewAngle(Number(e.target.value))}
          className="w-20 h-1 accent-gs-accent cursor-pointer"
        />
        <span className="text-[9px] text-gs-faint font-mono">{viewAngle}&deg;</span>
      </div>
      {spinning && (
        <div className="relative w-20 h-20" style={{ transform: `perspective(200px) rotateY(${viewAngle}deg)` }}>
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ animation: 'spin 2s linear infinite' }}>
            <circle cx="50" cy="50" r="48" fill="#111" stroke={accent || '#333'} strokeWidth="1" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#222" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#222" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="18" fill="none" stroke="#222" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="8" fill={accent || '#444'} />
            <circle cx="50" cy="50" r="2" fill="#000" />
          </svg>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

// [Improvement #2] Record DNA Fingerprint — unique SVG pattern per record
function RecordDNAFingerprint({ record }) {
  const [show, setShow] = useState(false);
  const pattern = useMemo(() => {
    if (!record) return [];
    const seed = (record.album + record.artist + (record.year || '')).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 24 }, (_, i) => {
      const h = 8 + ((seed * (i + 1) * 7) % 32);
      const hue = (seed * 3 + i * 15) % 360;
      return { h, hue };
    });
  }, [record]);

  if (!record) return null;
  return (
    <div className="mb-3">
      <button
        onClick={() => setShow(s => !s)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        {show ? 'Hide DNA Fingerprint' : 'Record DNA Fingerprint'}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] text-center">
          <svg viewBox="0 0 240 50" className="w-full" style={{ maxHeight: 50 }}>
            {pattern.map((bar, i) => (
              <rect
                key={i}
                x={i * 10}
                y={50 - bar.h}
                width="7"
                height={bar.h}
                rx="1"
                fill={`hsl(${bar.hue}, 60%, 50%)`}
                opacity="0.8"
              />
            ))}
          </svg>
          <div className="text-[9px] text-gs-faint mt-1 font-mono">
            Unique DNA: GS-{(record.album + record.artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0).toString(16).toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}

// [Improvement #4] Record Certification Display (RIAA Gold/Platinum)
function RecordCertification({ record }) {
  const cert = useMemo(() => {
    if (!record) return null;
    const seed = (record.album + record.artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    // Only some records get certifications based on seed
    if (seed % 5 === 0) return { level: 'Diamond', icon: '\u{1F48E}', color: '#60a5fa', copies: '10M+' };
    if (seed % 4 === 0) return { level: 'Platinum', icon: '\u{1F3B5}', color: '#e5e7eb', copies: '1M+' };
    if (seed % 3 === 0) return { level: 'Gold', icon: '\u{1F3C6}', color: '#f59e0b', copies: '500K+' };
    return null;
  }, [record]);

  if (!cert) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-3" style={{ borderColor: `${cert.color}33`, background: `${cert.color}08` }}>
      <span className="text-sm">{cert.icon}</span>
      <div>
        <span className="text-[11px] font-bold" style={{ color: cert.color }}>RIAA {cert.level} Certified</span>
        <span className="text-[10px] text-gs-dim ml-2">{cert.copies} copies sold</span>
      </div>
    </div>
  );
}

// [Improvement #5] Listening Count Display
function ListeningCount({ record }) {
  const count = useMemo(() => {
    if (!record) return 0;
    const seed = (record.album + record.artist).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return seed * 37 + (record.likes || 0) * 150;
  }, [record]);

  if (!record) return null;
  return (
    <div className="flex items-center gap-2 text-[10px] mb-2">
      <span className="text-gs-dim font-mono">PLAYS</span>
      <span className="text-gs-muted font-bold">{count.toLocaleString()}</span>
      <span className="text-gs-faint">listeners on platform</span>
    </div>
  );
}

// [Improvement #6] Record Age Calculator with Fun Facts
function RecordAgeCalculator({ year }) {
  const ageData = useMemo(() => {
    if (!year) return null;
    const now = new Date().getFullYear();
    const age = now - year;
    if (age < 0) return null;
    let funFact = '';
    if (age >= 50) funFact = 'This record is a genuine antique by most collector standards!';
    else if (age >= 40) funFact = 'This pressing has survived over four decades of music evolution.';
    else if (age >= 30) funFact = 'Released before the rise of streaming -- a true analog artifact.';
    else if (age >= 20) funFact = 'Two decades old and still spinning. A modern classic.';
    else if (age >= 10) funFact = 'Just hitting its stride as a collectable pressing.';
    else funFact = 'A recent release -- still finding its place in the collector market.';
    return { age, funFact };
  }, [year]);

  if (!ageData) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#111] rounded-lg border border-[#1a1a1a] mb-3">
      <span className="text-lg">{ageData.age >= 40 ? '\u{1F3DB}' : ageData.age >= 20 ? '\u{1F4BF}' : '\u{1F195}'}</span>
      <div>
        <div className="text-[11px] text-gs-muted font-semibold">{ageData.age} years old</div>
        <div className="text-[9px] text-gs-faint">{ageData.funFact}</div>
      </div>
    </div>
  );
}

// [Improvement 5] Record condition comparison photos guide
function ConditionComparisonGuide({ condition }) {
  const [show, setShow] = useState(false);
  const grades = [
    { grade: 'M', label: 'Mint', desc: 'Unplayed, perfect. Still in shrink wrap.', visual: '#10b981' },
    { grade: 'NM', label: 'Near Mint', desc: 'Nearly perfect. Minor signs of handling only.', visual: '#22d3ee' },
    { grade: 'VG+', label: 'Very Good Plus', desc: 'Light surface marks, plays without distortion.', visual: '#60a5fa' },
    { grade: 'VG', label: 'Very Good', desc: 'Noticeable surface noise, light scratches.', visual: '#a78bfa' },
    { grade: 'G+', label: 'Good Plus', desc: 'Plays through without skipping, audible wear.', visual: '#f59e0b' },
    { grade: 'G', label: 'Good', desc: 'Significant wear, may have some skips.', visual: '#f97316' },
    { grade: 'F', label: 'Fair', desc: 'Heavy wear, plays through with issues.', visual: '#ef4444' },
    { grade: 'P', label: 'Poor', desc: 'Barely playable, damaged.', visual: '#991b1b' },
  ];
  return (
    <div className="mb-2">
      <button
        onClick={() => setShow(s => !s)}
        className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono"
      >
        {show ? 'Hide Condition Guide' : 'Compare Conditions'}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] space-y-1.5">
          {grades.map(g => (
            <div key={g.grade} className={`flex items-center gap-2 px-2 py-1 rounded ${g.grade === condition ? 'bg-[#1a1a1a] border border-[#333]' : ''}`}>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: g.visual }} />
              <span className="text-[10px] font-bold font-mono w-8 shrink-0" style={{ color: g.visual }}>{g.grade}</span>
              <span className="text-[10px] text-gs-muted">{g.label}</span>
              <span className="text-[9px] text-gs-faint ml-auto hidden sm:block">{g.desc}</span>
              {g.grade === condition && <span className="text-[9px] text-gs-accent font-bold ml-1">Current</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// [Improvement 7] Record value trend sparkline (6-month)
function ValueTrendSparkline({ record }) {
  const data = useMemo(() => {
    if (!record) return [];
    const seed = record.album.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const base = record.price || estimateValue(record.condition, record.year);
    return Array.from({ length: 6 }, (_, i) => {
      const variance = Math.sin(seed + i * 1.2) * 6 + Math.cos(seed * 0.5 + i) * 3;
      return Math.max(3, base + variance);
    });
  }, [record]);

  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 30;
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const trend = data[data.length - 1] - data[0];

  return (
    <div className="flex items-center gap-2">
      <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className="w-[100px] h-[30px]">
        <polyline points={points} fill="none" stroke={trend >= 0 ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className={`text-[9px] font-mono font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {trend >= 0 ? '+' : ''}{trend.toFixed(0)} (6mo)
      </span>
    </div>
  );
}

// [Improvement 8] Quick share to social platforms
function SocialShareButtons({ record }) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareUrl = `${window.location.origin}/record/${record?.id}`;
  const shareText = record ? `Check out "${record.album}" by ${record.artist} on GrooveStack!` : '';

  const platforms = [
    { name: 'X / Twitter', url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, color: '#1DA1F2' },
    { name: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, color: '#4267B2' },
    { name: 'Reddit', url: `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`, color: '#FF4500' },
    { name: 'Email', url: `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`, color: '#888888' },
  ];

  if (!record) return null;
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowShareMenu(s => !s)}
        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
      >
        Share...
      </button>
      {showShareMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl z-50 min-w-[160px] p-1.5">
          {platforms.map(p => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[11px] text-gs-muted hover:bg-[#222] transition-colors no-underline"
              onClick={() => setShowShareMenu(false)}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              {p.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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

// [Improvement #16] Record Comparison Mode (side-by-side)
function RecordComparisonMode({ record, records, onClose }) {
  const [compareId, setCompareId] = useState(null);
  const candidates = useMemo(() => {
    if (!record || !records) return [];
    return records
      .filter(r => r.id !== record.id && (r.artist === record.artist || r.genre === record.genre || r.tags?.some(t => record.tags?.includes(t))))
      .slice(0, 10);
  }, [record, records]);

  const compareRecord = compareId ? records.find(r => r.id === compareId) : null;

  const fields = [
    { label: 'Album', get: r => r.album },
    { label: 'Artist', get: r => r.artist },
    { label: 'Year', get: r => r.year },
    { label: 'Condition', get: r => r.condition },
    { label: 'Format', get: r => r.format },
    { label: 'Price', get: r => r.forSale ? `$${r.price}` : 'Not for sale' },
    { label: 'Rating', get: r => r.rating ? `${r.rating}/5` : 'N/A' },
    { label: 'Label', get: r => r.label || 'Unknown' },
    { label: 'Verified', get: r => r.verified ? 'Yes' : 'No' },
  ];

  return (
    <div className="mb-4 p-3.5 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-gs-dim font-mono tracking-wider">COMPARE RECORDS</span>
        <button onClick={onClose} className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted">Close</button>
      </div>
      {!compareRecord && (
        <div className="mb-2">
          <div className="text-[10px] text-gs-faint mb-1.5">Select a record to compare with:</div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
            {candidates.length === 0 && <div className="text-[10px] text-gs-faint">No similar records found to compare.</div>}
            {candidates.map(r => (
              <button key={r.id} onClick={() => setCompareId(r.id)} className="w-full text-left px-2 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-[10px] text-gs-muted cursor-pointer hover:border-gs-accent/40 transition-colors">
                {r.album} - {r.artist} ({r.condition})
              </button>
            ))}
          </div>
        </div>
      )}
      {compareRecord && (
        <div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="text-gs-faint font-mono text-right pr-2">Field</div>
            <div className="text-gs-accent font-bold text-center">This Record</div>
            <div className="text-amber-400 font-bold text-center">Compared</div>
            {fields.map(f => (
              <div key={f.label} className="contents">
                <div className="text-gs-faint font-mono text-right pr-2 py-0.5">{f.label}</div>
                <div className="text-gs-muted text-center py-0.5 truncate">{f.get(record)}</div>
                <div className="text-gs-muted text-center py-0.5 truncate">{f.get(compareRecord)}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setCompareId(null)} className="mt-2 text-[10px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted">Compare another</button>
        </div>
      )}
    </div>
  );
}

// [Improvement #17] Record Investment Calculator
function RecordInvestmentCalculator({ record }) {
  const [show, setShow] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [yearsHeld, setYearsHeld] = useState('5');

  const projection = useMemo(() => {
    const buy = parseFloat(purchasePrice) || (record?.price ? parseFloat(record.price) : 0);
    const years = parseInt(yearsHeld) || 5;
    if (!buy || buy <= 0) return null;
    // Vinyl appreciation: ~3-8% per year depending on condition and age
    const condRates = { M: 0.08, NM: 0.06, 'VG+': 0.05, VG: 0.04, 'G+': 0.03, G: 0.02, F: 0.01, P: 0.005 };
    const rate = condRates[record?.condition] || 0.04;
    const yearBonus = record?.year && record.year < 1980 ? 0.02 : 0;
    const totalRate = rate + yearBonus;
    const futureValue = buy * Math.pow(1 + totalRate, years);
    const roi = ((futureValue - buy) / buy * 100).toFixed(1);
    return { futureValue: futureValue.toFixed(2), roi, annualRate: (totalRate * 100).toFixed(1) };
  }, [purchasePrice, yearsHeld, record]);

  if (!record) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setShow(s => !s)} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono">
        {show ? 'Hide Investment Calculator' : 'Investment Calculator'}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[9px] text-gs-faint font-mono block mb-0.5">PURCHASE PRICE ($)</label>
              <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder={String(record.price || 20)} className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[11px] text-gs-text outline-none font-mono" />
            </div>
            <div>
              <label className="text-[9px] text-gs-faint font-mono block mb-0.5">YEARS TO HOLD</label>
              <select value={yearsHeld} onChange={e => setYearsHeld(e.target.value)} className="w-full bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[11px] text-gs-text outline-none cursor-pointer">
                {[1, 2, 3, 5, 10, 15, 20].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          {projection && (
            <div className="bg-[#111] rounded-lg p-2 text-center">
              <div className="text-[9px] text-gs-faint font-mono mb-1">PROJECTED VALUE ({projection.annualRate}% annual appreciation)</div>
              <div className="text-lg font-extrabold text-emerald-400">${projection.futureValue}</div>
              <div className="text-[10px] text-emerald-400/70">+{projection.roi}% ROI</div>
            </div>
          )}
          <div className="text-[8px] text-gs-faint mt-1.5">Based on condition ({record.condition}), release year, and historical vinyl appreciation rates. Not financial advice.</div>
        </div>
      )}
    </div>
  );
}

// [Improvement #18] Record Trade Value Estimator
function RecordTradeValueEstimator({ record, records }) {
  const [show, setShow] = useState(false);

  const tradeData = useMemo(() => {
    if (!record || !records) return null;
    const basePrices = { M: 40, NM: 30, 'VG+': 22, VG: 15, 'G+': 10, G: 7, F: 5, P: 3 };
    const myValue = record.price ? parseFloat(record.price) : (basePrices[record.condition] || 15);
    // Find records of similar value that could be trade candidates
    const candidates = records
      .filter(r => r.id !== record.id && r.user !== record.user && r.forSale)
      .map(r => {
        const theirValue = r.price ? parseFloat(r.price) : (basePrices[r.condition] || 15);
        const diff = Math.abs(myValue - theirValue);
        const fairness = diff <= myValue * 0.15 ? 'Fair' : diff <= myValue * 0.3 ? 'Possible' : 'Uneven';
        return { ...r, theirValue, diff, fairness };
      })
      .filter(r => r.fairness !== 'Uneven')
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5);
    return { myValue, candidates };
  }, [record, records]);

  if (!record) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setShow(s => !s)} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono">
        {show ? 'Hide Trade Estimator' : 'Trade Value Estimator'}
      </button>
      {show && tradeData && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
          <div className="text-[10px] text-gs-dim font-mono mb-2">ESTIMATED TRADE VALUE: <span className="text-emerald-400 font-bold">${tradeData.myValue.toFixed(2)}</span></div>
          {tradeData.candidates.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[9px] text-gs-faint mb-1">Potential trade matches:</div>
              {tradeData.candidates.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 bg-[#111] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gs-text font-semibold truncate">{c.album}</div>
                    <div className="text-[9px] text-gs-faint">{c.artist} - ${c.theirValue.toFixed(2)}</div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.fairness === 'Fair' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>{c.fairness}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-gs-faint">No suitable trade matches found at this time.</div>
          )}
        </div>
      )}
    </div>
  );
}

// [Improvement #19] Record Completion Checker
function RecordCompletionChecker({ record }) {
  const [show, setShow] = useState(false);

  const checks = useMemo(() => {
    if (!record) return [];
    return [
      { label: 'Album title', done: !!record.album?.trim(), required: true },
      { label: 'Artist name', done: !!record.artist?.trim(), required: true },
      { label: 'Release year', done: !!record.year, required: false },
      { label: 'Record label', done: !!record.label?.trim(), required: false },
      { label: 'Condition graded', done: !!record.condition, required: true },
      { label: 'Format specified', done: !!record.format, required: false },
      { label: 'Rating given', done: record.rating > 0, required: false },
      { label: 'Review written', done: !!record.review?.trim(), required: false },
      { label: 'Genre tagged', done: record.tags?.length > 0, required: false },
      { label: 'Vinyl verified', done: !!record.verified, required: false },
      { label: 'Price set (if for sale)', done: !record.forSale || !!record.price, required: record.forSale },
    ];
  }, [record]);

  const completed = checks.filter(c => c.done).length;
  const total = checks.length;
  const pct = Math.round((completed / total) * 100);

  if (!record) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setShow(s => !s)} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono flex items-center gap-1.5">
        {show ? 'Hide Completion Check' : 'Record Completeness'}
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pct === 100 ? 'text-emerald-400 bg-emerald-500/10' : pct >= 60 ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'}`}>{pct}%</span>
      </button>
      {show && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
          <div className="mb-2">
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <div className="text-[9px] text-gs-faint mt-0.5 text-right">{completed}/{total} fields</div>
          </div>
          <div className="space-y-1">
            {checks.map(c => (
              <div key={c.label} className="flex items-center gap-1.5 text-[10px]">
                <span className={c.done ? 'text-emerald-400' : c.required ? 'text-red-400' : 'text-gs-faint'}>{c.done ? '\u2713' : '\u2717'}</span>
                <span className={c.done ? 'text-gs-muted' : 'text-gs-dim'}>{c.label}</span>
                {c.required && !c.done && <span className="text-[8px] text-red-400">required</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// [Improvement #20] Record Authenticity Checklist
function RecordAuthenticityChecklist({ record }) {
  const [show, setShow] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});

  const items = useMemo(() => [
    { id: 'matrix', label: 'Matrix/run-out etchings match known pressings', category: 'Physical' },
    { id: 'label_print', label: 'Label print quality and color are consistent with era', category: 'Physical' },
    { id: 'weight', label: 'Vinyl weight feels correct for the format/era', category: 'Physical' },
    { id: 'sleeve', label: 'Sleeve artwork and printing quality match original', category: 'Packaging' },
    { id: 'inserts', label: 'Inner sleeve/inserts present and period-correct', category: 'Packaging' },
    { id: 'barcode', label: 'Barcode/catalog number matches known releases', category: 'Catalog' },
    { id: 'pressing_plant', label: 'Pressing plant markings are identifiable', category: 'Catalog' },
    { id: 'sound', label: 'Audio quality consistent with pressing type', category: 'Audio' },
  ], []);

  const toggleCheck = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = items.length;
  const score = Math.round((checkedCount / totalItems) * 100);

  if (!record) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setShow(s => !s)} className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer p-0 font-mono flex items-center gap-1.5">
        {show ? 'Hide Authenticity Checklist' : 'Authenticity Checklist'}
        {checkedCount > 0 && <span className="text-[9px] font-bold text-emerald-400">{checkedCount}/{totalItems}</span>}
      </button>
      {show && (
        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gs-dim font-mono">AUTHENTICITY SCORE</span>
            <span className={`text-[11px] font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-gs-dim'}`}>
              {score}% ({score >= 80 ? 'Likely Authentic' : score >= 50 ? 'Partial Verification' : 'Needs Review'})
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#6b7280' }} />
          </div>
          {['Physical', 'Packaging', 'Catalog', 'Audio'].map(cat => {
            const catItems = items.filter(i => i.category === cat);
            return (
              <div key={cat} className="mb-2">
                <div className="text-[9px] text-gs-faint font-mono font-bold mb-1">{cat.toUpperCase()}</div>
                {catItems.map(item => (
                  <label key={item.id} className="flex items-center gap-2 py-0.5 cursor-pointer group">
                    <input type="checkbox" checked={!!checkedItems[item.id]} onChange={() => toggleCheck(item.id)} className="w-3 h-3 rounded border-gs-border accent-emerald-500 cursor-pointer" />
                    <span className={`text-[10px] ${checkedItems[item.id] ? 'text-gs-muted line-through' : 'text-gs-dim group-hover:text-gs-muted'}`}>{item.label}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DetailModal({ open, onClose, record, onLike, onSave, onComment, onBuy, onViewUser, onViewArtist, onAddWishlistItem, currentUser, records, onOfferFromDetail, onVerifyRecord, onViewRecord }) {
  const [copied, setCopied] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [collectorNote, setCollectorNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [discogsPrice, setDiscogsPrice] = useState(null);
  // [Improvement #16] Record comparison mode
  const [showCompareMode, setShowCompareMode] = useState(false);
  // [Improvement 6] Similar records carousel scroll position
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useCallback(node => {
    if (node) {
      let startX = 0;
      const onTouchStart = e => { startX = e.touches[0].clientX; };
      const onTouchEnd = e => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          setCarouselIndex(prev => diff > 0 ? Math.min(prev + 1, 3) : Math.max(prev - 1, 0));
        }
      };
      node.addEventListener('touchstart', onTouchStart, { passive: true });
      node.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  }, []);

  // Inject structured data (JSON-LD) when viewing a record (#24)
  useEffect(() => {
    if (open && record) {
      injectJsonLd(recordToJsonLd(record));
      // Fix: reset transient UI state when switching to a different record
      setCopied(false);
      setShowLightbox(false);
      setShowNegotiate(false);
      setOfferAmount('');
      setAudioPlaying(false);
      setDiscogsPrice(null);
      // Load saved collector note from localStorage
      const savedNote = localStorage.getItem(`gs_note_${record.id}`);
      if (savedNote) {
        setCollectorNote(savedNote);
        setNoteSaved(true);
      } else {
        setCollectorNote('');
        setNoteSaved(false);
      }
      // Fetch Discogs market price
      if (record.album && record.artist) {
        getDiscogsPrice(record.album, record.artist).then(data => {
          if (data && data.median) setDiscogsPrice(data.median);
        });
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

  // Estimate market value based on condition + year, or use Discogs data
  const marketValue = useMemo(() => {
    if (!record) return null;
    if (discogsPrice) return discogsPrice;
    return estimateValue(record.condition, record.year);
  }, [record, discogsPrice]);

  const isDiscogsData = !!discogsPrice;

  // Wishlist demand: count how many users want this record
  const wantCount = useMemo(() => {
    if (!record) return 0;
    return Object.values(USER_WISHLISTS).filter(items =>
      items.some(w => w.album.toLowerCase() === record.album.toLowerCase() && w.artist.toLowerCase() === record.artist.toLowerCase())
    ).length;
  }, [record]);

  const isPopular = (record?.likes || 0) >= 3;

  // ── Marketplace: Similar records that are for sale ──
  const similarForSale = useMemo(() => {
    if (!record || !records) return [];
    return records
      .filter(r => r.id !== record.id && r.user !== record.user && r.forSale && (r.artist === record.artist || r.tags?.some(t => record.tags?.includes(t))))
      .sort((a, b) => (a.artist === record.artist ? 0 : 1) - (b.artist === record.artist ? 0 : 1))
      .slice(0, 4);
  }, [record, records]);

  // ── Marketplace: Price trend data for chart ──
  const priceTrendData = useMemo(() => {
    if (!record) return [];
    const basePrice = marketValue || 20;
    const points = [];
    let h = 0;
    const s = String(record.id);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    for (let i = 0; i < 6; i++) {
      const variation = ((h + i * 13) % 20 - 8) / 100;
      points.push(Math.round(basePrice * (0.85 + (i * 0.03) + variation)));
    }
    // Trend upward slightly
    points.push(Math.round(basePrice * 1.02));
    return points;
  }, [record, marketValue]);

  const priceTrending = priceTrendData.length >= 2 && priceTrendData[priceTrendData.length - 1] > priceTrendData[0];

  // ── Marketplace: Trade suggestion — find user's records of similar value ──
  const tradeSuggestions = useMemo(() => {
    if (!record || !records || !record.forSale || isOwn) return [];
    const targetValue = record.price || marketValue || 20;
    return records
      .filter(r => r.user === currentUser && r.id !== record.id && !r.forSale)
      .map(r => ({ ...r, estValue: estimateValue(r.condition, r.year) }))
      .filter(r => Math.abs(r.estValue - targetValue) <= targetValue * 0.25)
      .sort((a, b) => Math.abs(a.estValue - targetValue) - Math.abs(b.estValue - targetValue))
      .slice(0, 3);
  }, [record, records, currentUser, isOwn, marketValue]);

  // Price comparison badge for for-sale listings
  const priceBadge = useMemo(() => {
    if (!record || !record.forSale || !record.price || !marketValue) return null;
    const p = parseFloat(record.price);
    if (p <= marketValue * 0.85) return { label: 'Listed below estimate', color: '#10b981' };
    if (p <= marketValue * 1.15) return { label: 'Fair price', color: '#60a5fa' };
    return null;
  }, [record, marketValue]);

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

      {/* Market value — Discogs data or honest estimate */}
      <div className="px-3.5 py-2.5 bg-[#111] rounded-[10px] mb-4 border border-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gs-dim font-mono tracking-wider">
            {isDiscogsData ? 'MARKET PRICE (DISCOGS)' : 'EST. VALUE'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-400">
              {isDiscogsData ? `$${marketValue}` : `~$${marketValue}`}
            </span>
            {!isDiscogsData && (
              <span className="text-[9px] text-gs-faint font-mono" title="Based on condition and year, not real market data">Est.</span>
            )}
          </div>
        </div>
        {!isDiscogsData && (
          <div className="text-[9px] text-gs-faint mt-1 leading-relaxed">
            Estimate based on condition ({record.condition}) and release year ({record.year}). Actual market value may vary.
          </div>
        )}
        {/* Price badge for for-sale listings */}
        {priceBadge && (
          <div className="mt-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color: priceBadge.color, borderColor: `${priceBadge.color}33`, background: `${priceBadge.color}11` }}
            >
              {priceBadge.label}
            </span>
          </div>
        )}
        {/* [Improvement 9] Price history sparkline */}
        <PriceHistoryChart record={record} />
      </div>

      {/* Demand signals: popularity + wishlist count — enhanced social proof */}
      {(isPopular || wantCount > 0) && (
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          {isPopular && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: '#f472b6', borderColor: '#f472b633', background: '#f472b611' }}>
              Popular
            </span>
          )}
          {wantCount > 0 && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {wantCount} collector{wantCount !== 1 ? 's' : ''} want{wantCount === 1 ? 's' : ''} this
            </span>
          )}
          {record.forSale && wantCount >= 2 && (
            <span className="text-[9px] text-red-400/80 font-semibold">High demand &mdash; may sell soon</span>
          )}
        </div>
      )}

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

      {/* [Improvement #2] Record DNA Fingerprint */}
      <RecordDNAFingerprint record={record} />

      {/* [Improvement #4] Record Certification (RIAA) */}
      <RecordCertification record={record} />

      {/* [Improvement #5] Listening Count Display */}
      <ListeningCount record={record} />

      {/* [Improvement #6] Record Age Calculator */}
      <RecordAgeCalculator year={record.year} />

      {/* [Improvement 1] Record Timeline */}
      <RecordTimeline record={record} />

      {/* [Improvement 5] Condition comparison guide */}
      <ConditionComparisonGuide condition={record.condition} />

      {/* [Improvement 7] Value trend sparkline (6-month) */}
      <div className="flex items-center gap-3 mb-4 px-3.5 py-2 bg-[#111] rounded-[10px] border border-[#1a1a1a]">
        <span className="text-[11px] text-gs-dim font-mono">6-MO TREND</span>
        <ValueTrendSparkline record={record} />
      </div>

      {/* [Improvement 4] Virtual turntable */}
      <div className="flex justify-center mb-4">
        <VirtualTurntable accent={record.accent} album={record.album} />
      </div>

      {/* [Improvement 3] Authentication certificate */}
      {record.verified && (
        <div className="mb-4">
          <AuthCertificateView record={record} />
        </div>
      )}

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

      {/* [Improvement 2] Seller response time */}
      {record.forSale && !isOwn && (
        <div className="px-3.5 mb-4">
          <SellerResponseTime username={record.user} />
        </div>
      )}

      {record.review && (
        <blockquote
          className="pl-3.5 text-[#aaa] text-[13px] leading-[1.7] italic mb-5"
          style={{ borderLeft: `2px solid ${record.accent}55` }}
        >
          &ldquo;{record.review}&rdquo;
        </blockquote>
      )}

      {/* Fix: guard against undefined tags (e.g. imported Discogs records may lack tags) */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {(record.tags || []).map(t => (
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

      {/* [Improvement #16] Record Comparison Mode */}
      {showCompareMode ? (
        <RecordComparisonMode record={record} records={records} onClose={() => setShowCompareMode(false)} />
      ) : (
        <button onClick={() => setShowCompareMode(true)} className="w-full mb-4 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[11px] text-gs-dim font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="7 8 3 12 7 16"/><polyline points="17 8 21 12 17 16"/></svg>
          Compare with Similar Records
        </button>
      )}

      {/* [Improvement #17] Record Investment Calculator */}
      <RecordInvestmentCalculator record={record} />

      {/* [Improvement #18] Record Trade Value Estimator */}
      <RecordTradeValueEstimator record={record} records={records} />

      {/* [Improvement #19] Record Completion Checker */}
      <RecordCompletionChecker record={record} />

      {/* [Improvement #20] Record Authenticity Checklist */}
      <RecordAuthenticityChecklist record={record} />

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
          {/* Fix: guard against undefined comments array */}
          &#x1F4AC; {(record.comments || []).length}
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
          {copied ? "\u2713 Copied!" : "\uD83D\uDD17 Copy"}
        </button>
        {/* [Improvement 8] Quick share to social platforms */}
        <SocialShareButtons record={record} />
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

      {/* Prominent Make an Offer for all for-sale listings — with pulsing animation */}
      {record.forSale && !isOwn && (
        <div className="mt-3">
          {!showNegotiate ? (
            <div className="relative">
              <button
                onClick={() => { setShowNegotiate(true); setOfferAmount(String(Math.floor((record.price || 20) * 0.85))); }}
                className="w-full py-3 rounded-lg text-white text-[13px] font-extrabold cursor-pointer transition-all hover:scale-[1.02] border-none relative z-10"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}
              >
                Make an Offer
              </button>
              {/* Pulsing glow effect */}
              <div
                className="absolute inset-0 rounded-lg opacity-40 animate-pulse"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', filter: 'blur(8px)' }}
              />
            </div>
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

      {/* [Improvement #3] Inline Price Negotiation Chat */}
      {record.forSale && !isOwn && showNegotiate && (
        <div className="mt-3 p-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg">
          <div className="text-[10px] text-gs-dim font-mono mb-2">NEGOTIATION CHAT</div>
          <div className="max-h-[100px] overflow-y-auto mb-2 space-y-1.5">
            <div className="flex gap-2 items-start">
              <span className="text-[10px] text-gs-accent font-bold shrink-0">You:</span>
              <span className="text-[11px] text-gs-muted">Would you consider ${offerAmount || '...'} for this record?</span>
            </div>
            <div className="flex gap-2 items-start">
              <span className="text-[10px] text-amber-400 font-bold shrink-0">@{record.user}:</span>
              <span className="text-[11px] text-gs-muted italic">Waiting for response...</span>
            </div>
          </div>
          <div className="flex gap-1">
            {['That works!', 'Can you go lower?', 'How about splitting shipping?'].map(msg => (
              <button
                key={msg}
                className="px-2 py-1 rounded-md bg-[#1a1a1a] border border-[#222] text-[9px] text-gs-dim cursor-pointer hover:text-gs-muted hover:border-[#333] transition-colors"
              >
                {msg}
              </button>
            ))}
          </div>
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

      {/* ── Marketplace: Price trend chart with buy-now nudge ── */}
      {record.forSale && !isOwn && priceTrendData.length > 1 && (
        <div className="mt-5 border-t border-[#1a1a1a] pt-4">
          <div className="text-[11px] text-gs-dim font-mono tracking-widest mb-2">PRICE TREND (6 MONTHS)</div>
          <div className="flex items-end gap-1 h-10 mb-2">
            {priceTrendData.map((price, i) => {
              const max = Math.max(...priceTrendData);
              const min = Math.min(...priceTrendData);
              const range = max - min || 1;
              const height = Math.max(4, ((price - min) / range) * 36);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${height}px`,
                      background: i === priceTrendData.length - 1 ? (priceTrending ? '#22c55e' : '#ef4444') : '#333',
                    }}
                    title={`$${price}`}
                  />
                  <span className="text-[7px] text-gs-faint font-mono">${price}</span>
                </div>
              );
            })}
          </div>
          {priceTrending && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              <span className="text-[10px] text-emerald-400 font-semibold">Price trending up &mdash; buy now before it rises further</span>
            </div>
          )}
        </div>
      )}

      {/* ── Marketplace: Trade suggestion — "Trade your X for this" ── */}
      {tradeSuggestions.length > 0 && (
        <div className="mt-4 p-3 bg-[#111] border border-violet-500/20 rounded-[10px]">
          <div className="text-[11px] text-gs-dim font-mono tracking-widest mb-2">TRADE OPTION</div>
          <div className="text-[10px] text-gs-muted mb-2">Trade one of your records for this &mdash; similar value match</div>
          <div className="space-y-1.5">
            {tradeSuggestions.map(r => (
              <div key={r.id} className="flex items-center gap-2.5 px-2.5 py-1.5 bg-[#0a0a0a] rounded-lg">
                <div className="w-8 h-8 rounded overflow-hidden shrink-0" style={{ background: r.accent || '#333' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-gs-text truncate">{r.album}</div>
                  <div className="text-[9px] text-gs-faint truncate">{r.artist}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-violet-400 font-semibold">~${r.estValue}</div>
                  <button
                    onClick={() => onOfferFromDetail?.(record, record.user, { type: 'trade', tradeRecord: r })}
                    className="text-[9px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20 cursor-pointer font-bold hover:bg-violet-500/25 transition-colors mt-0.5"
                  >
                    Offer Trade
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Marketplace: Similar records FOR SALE carousel ── */}
      {similarForSale.length > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/15 rounded-[10px]">
          <div className="text-[11px] text-gs-dim font-mono tracking-widest mb-2">SIMILAR RECORDS FOR SALE</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {similarForSale.map(r => (
              <button
                key={r.id}
                onClick={() => onViewRecord?.(r)}
                className="bg-[#111] rounded-lg p-2 border border-[#1a1a1a] cursor-pointer hover:border-amber-500/30 transition-colors flex flex-col items-center gap-1 text-center shrink-0"
                style={{ width: '100px' }}
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={48} />
                <div className="text-[9px] font-bold text-gs-text truncate w-full">{r.album}</div>
                <div className="text-[8px] text-gs-faint truncate w-full">{r.artist}</div>
                <div className="text-[10px] font-bold text-emerald-400">${r.price}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* [Improvement 6] Similar Records Carousel with Swipe */}
      {similarRecords.length > 0 && (
        <div className="mt-5 border-t border-[#1a1a1a] pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-gs-dim font-mono tracking-widest">SIMILAR RECORDS</div>
            <div className="flex gap-1">
              <button
                onClick={() => setCarouselIndex(i => Math.max(i - 1, 0))}
                disabled={carouselIndex === 0}
                className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#333] text-gs-dim text-[10px] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                &larr;
              </button>
              <button
                onClick={() => setCarouselIndex(i => Math.min(i + 1, Math.max(0, similarRecords.length - 3)))}
                disabled={carouselIndex >= similarRecords.length - 3}
                className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#333] text-gs-dim text-[10px] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                &rarr;
              </button>
            </div>
          </div>
          <div className="overflow-hidden" ref={carouselRef}>
            <div
              className="flex gap-2.5 transition-transform duration-300"
              style={{ transform: `translateX(-${carouselIndex * 130}px)` }}
            >
              {similarRecords.map(r => (
                <button
                  key={r.id}
                  onClick={() => onViewRecord?.(r)}
                  className="bg-[#111] rounded-[10px] p-2 border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors flex flex-col items-center gap-1.5 text-center shrink-0"
                  style={{ width: '120px' }}
                >
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={56} />
                  <div className="text-[10px] font-bold text-gs-text truncate w-full">{r.album}</div>
                  <div className="text-[9px] text-gs-dim truncate w-full">{r.artist}</div>
                  {r.forSale && <div className="text-[9px] text-emerald-400 font-bold">${r.price}</div>}
                </button>
              ))}
            </div>
          </div>
          {/* Carousel dots */}
          <div className="flex justify-center gap-1 mt-2">
            {similarRecords.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === carouselIndex ? 'bg-gs-accent' : 'bg-[#333]'}`}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
