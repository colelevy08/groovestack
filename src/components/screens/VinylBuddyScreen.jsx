// Vinyl Buddy feature screen — dedicated hub for the ESP32 vinyl identification device.
// Pre-activation: landing page with feature showcase + device code activation.
// Post-activation: dashboard with Overview, History, and Device tabs.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';

const TABS = ["overview", "history", "stats", "device"];

// ── CSS keyframes injected once ─────────────────────────────────────────────
const STYLE_ID = "vb-keyframes";
function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes vb-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    @keyframes vb-pulse-dot { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
    @keyframes vb-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes vb-skeleton { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes vb-now-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes vb-eq-bar1 { 0%,100% { height:20%; } 25% { height:80%; } 50% { height:40%; } 75% { height:90%; } }
    @keyframes vb-eq-bar2 { 0%,100% { height:60%; } 25% { height:30%; } 50% { height:85%; } 75% { height:45%; } }
    @keyframes vb-eq-bar3 { 0%,100% { height:40%; } 25% { height:90%; } 50% { height:20%; } 75% { height:70%; } }
    @keyframes vb-eq-bar4 { 0%,100% { height:75%; } 25% { height:50%; } 50% { height:95%; } 75% { height:30%; } }
    @keyframes vb-eq-bar5 { 0%,100% { height:50%; } 25% { height:70%; } 50% { height:30%; } 75% { height:85%; } }
    @keyframes vb-wave { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
    .vb-fade-in { animation: vb-fade-in 0.3s ease-out both; }
    .vb-skeleton {
      background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
      background-size: 200% 100%;
      animation: vb-skeleton 1.5s ease-in-out infinite;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(style);
}

// ── Relative time helper ────────────────────────────────────────────────────
function relTime(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy === 1 ? "yesterday" : `${dy}d ago`;
}

// ── Format uptime seconds to human-readable ──────────────────────────────
function fmtUptime(s) {
  if (!s) return "\u2014";
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

// ── Date grouping helper ────────────────────────────────────────────────────
function dateLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function normalizeTrackKey(track) {
  const canonical = String(track?.canonicalTrackId || "").trim().toLowerCase();
  if (canonical) return canonical;
  const artist = String(track?.artist || "").trim().toLowerCase();
  const title = String(track?.title || "").trim().toLowerCase();
  return `${artist}::${title}`;
}

function foldCapturedSessions(sessions) {
  const sorted = [...(sessions || [])].sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  const folded = [];

  for (const s of sorted) {
    const key = normalizeTrackKey(s.track);
    const trackLengthSec = Number(s.trackLengthSec || 240);
    const windowMs = Math.max(trackLengthSec * 1000, 60000);

    const existing = folded.find((f) => {
      if ((f.deviceId || "") !== (s.deviceId || "")) return false;
      if (normalizeTrackKey(f.track) !== key) return false;
      return Math.abs((f.timestampMs || 0) - (s.timestampMs || 0)) <= windowMs;
    });

    if (!existing) {
      folded.push({
        ...s,
        captureCount: Number(s.captureCount || 1),
        listenedSeconds: Number(s.listenedSeconds || 0),
      });
      continue;
    }

    existing.captureCount = Number(existing.captureCount || 1) + Number(s.captureCount || 1);
    existing.listenedSeconds = Number(existing.listenedSeconds || 0) + Number(s.listenedSeconds || 0);
    existing.score = Math.max(Number(existing.score || 0), Number(s.score || 0));

    if ((s.timestampMs || 0) > (existing.timestampMs || 0)) {
      existing.timestampMs = s.timestampMs;
      existing.timestamp = s.timestamp;
      existing.track = s.track;
    }
  }

  return folded;
}

// ── Demo data ───────────────────────────────────────────────────────────────
function generateDemoData() {
  const tracks = [
    { title: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV", year: 1971 },
    { title: "Wish You Were Here", artist: "Pink Floyd", album: "Wish You Were Here", year: 1975 },
    { title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", year: 1975 },
    { title: "Hotel California", artist: "Eagles", album: "Hotel California", year: 1976 },
    { title: "Comfortably Numb", artist: "Pink Floyd", album: "The Wall", year: 1979 },
    { title: "Black Dog", artist: "Led Zeppelin", album: "Led Zeppelin IV", year: 1971 },
    { title: "Somebody to Love", artist: "Queen", album: "A Day at the Races", year: 1976 },
    { title: "Riders on the Storm", artist: "The Doors", album: "L.A. Woman", year: 1971 },
    { title: "A Day in the Life", artist: "The Beatles", album: "Sgt. Pepper's", year: 1967 },
    { title: "Baba O'Riley", artist: "The Who", album: "Who's Next", year: 1971 },
    { title: "Ramble On", artist: "Led Zeppelin", album: "Led Zeppelin II", year: 1969 },
    { title: "Don't Stop Me Now", artist: "Queen", album: "Jazz", year: 1978 },
  ];
  const now = Date.now();
  return tracks.map((track, i) => ({
    id: `demo-${i}`,
    username: "__demo__",
    track,
    timestampMs: now - i * 3600000 * (1 + Math.random() * 5),
    score: 70 + Math.floor(Math.random() * 30),
    captureCount: 1 + Math.floor(Math.random() * 3),
    listenedSeconds: 120 + Math.floor(Math.random() * 180),
    deviceId: "DEMO00112233",
  }));
}

// ── Tooltip component ───────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#222] border border-[#333] rounded-lg text-[10px] text-gs-muted whitespace-nowrap pointer-events-none" style={{ animation: "vb-fade-in 0.15s ease-out" }}>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#333]" />
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, rounded = 6 }) {
  return <div className="vb-skeleton" style={{ width: w, height: h, borderRadius: rounded }} />;
}

function SkeletonCard() {
  return (
    <div className="bg-gs-card border border-gs-border rounded-xl p-4 flex gap-3 items-center">
      <Skeleton w={38} h={38} rounded={8} />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton w="60%" h={12} />
        <Skeleton w="40%" h={10} />
      </div>
    </div>
  );
}

// ── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] text-gs-dim font-mono">{label}</span>
          <span className="text-[10px] font-semibold font-mono" style={{ color }}>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      </div>
    </div>
  );
}

// ── Equalizer visualization ──────────────────────────────────────────────
function EqualizerVis({ active = false, barCount = 5, height = 24, color = "#0ea5e9" }) {
  const anims = ["vb-eq-bar1", "vb-eq-bar2", "vb-eq-bar3", "vb-eq-bar4", "vb-eq-bar5"];
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-t-sm"
          style={{
            height: active ? undefined : "20%",
            background: active ? color : "#333",
            animation: active ? `${anims[i % anims.length]} ${0.8 + i * 0.15}s ease-in-out infinite` : "none",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ── Sound wave visualization placeholder ─────────────────────────────────
function SoundWaveVis({ active = false }) {
  const bars = 32;
  return (
    <div className="relative w-full h-10 overflow-hidden rounded-lg bg-[#111] border border-[#1a1a1a]">
      <div
        className="absolute inset-0 flex items-center gap-[1px] px-2"
        style={{ animation: active ? "vb-wave 3s linear infinite" : "none", width: "200%" }}
      >
        {Array.from({ length: bars * 2 }, (_, i) => {
          const h = active ? 15 + Math.sin(i * 0.5) * 12 + Math.random() * 8 : 4;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-300"
              style={{
                height: `${h}px`,
                background: active
                  ? `linear-gradient(to top, #0ea5e9, #8b5cf6)`
                  : "#222",
                opacity: active ? 0.7 + Math.random() * 0.3 : 0.3,
              }}
            />
          );
        })}
      </div>
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] text-gs-faint font-mono">Waiting for audio...</span>
        </div>
      )}
    </div>
  );
}

// ── Achievement badges ──────────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: "first_listen", label: "First Spin", desc: "Identified your first track", icon: "\uD83C\uDFB5", threshold: (s) => s.totalListens >= 1 },
  { id: "10_artists", label: "Diverse Ear", desc: "Listened to 10 different artists", icon: "\uD83C\uDFA4", threshold: (s) => s.uniqueArtists >= 10 },
  { id: "50_listens", label: "Vinyl Veteran", desc: "50 tracks identified", icon: "\uD83C\uDFB6", threshold: (s) => s.totalListens >= 50 },
  { id: "100_listens", label: "Century Club", desc: "100 tracks identified", icon: "\uD83D\uDCAF", threshold: (s) => s.totalListens >= 100 },
  { id: "5_albums", label: "Album Explorer", desc: "Explored 5 unique albums", icon: "\uD83D\uDCBF", threshold: (s) => s.uniqueAlbums >= 5 },
  { id: "night_owl", label: "Night Owl", desc: "Listened after midnight", icon: "\uD83E\uDD89", threshold: (s) => s.hasLateNight },
  { id: "early_bird", label: "Early Bird", desc: "Listened before 7 AM", icon: "\uD83D\uDC26", threshold: (s) => s.hasEarlyMorning },
  { id: "marathon", label: "Marathon", desc: "Listened for over 2 hours total", icon: "\uD83C\uDFC3", threshold: (s) => s.totalMinutes >= 120 },
];

function AchievementBadges({ myListens }) {
  const stats = useMemo(() => {
    const uniqueArtists = new Set(myListens.map(s => s.track.artist)).size;
    const uniqueAlbums = new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`)).size;
    const totalMinutes = Math.round(myListens.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0) / 60);
    const hasLateNight = myListens.some(s => { const h = new Date(s.timestampMs).getHours(); return h >= 0 && h < 5; });
    const hasEarlyMorning = myListens.some(s => { const h = new Date(s.timestampMs).getHours(); return h >= 5 && h < 7; });
    return { totalListens: myListens.length, uniqueArtists, uniqueAlbums, totalMinutes, hasLateNight, hasEarlyMorning };
  }, [myListens]);

  const earned = ACHIEVEMENT_DEFS.filter(a => a.threshold(stats));
  const locked = ACHIEVEMENT_DEFS.filter(a => !a.threshold(stats));

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Achievement Badges</div>
      <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
        {earned.map(a => (
          <Tooltip key={a.id} text={a.desc}>
            <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg bg-[#0ea5e908] border border-[#0ea5e922] cursor-default transition-all duration-200 hover:border-[#0ea5e944]">
              <span className="text-xl">{a.icon}</span>
              <span className="text-[9px] text-gs-accent font-bold text-center leading-tight">{a.label}</span>
            </div>
          </Tooltip>
        ))}
        {locked.map(a => (
          <Tooltip key={a.id} text={a.desc}>
            <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg bg-[#111] border border-[#1a1a1a] cursor-default opacity-40">
              <span className="text-xl grayscale">{a.icon}</span>
              <span className="text-[9px] text-gs-faint font-bold text-center leading-tight">{a.label}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ── Listening streaks ───────────────────────────────────────────────────
function ListeningStreaks({ myListens }) {
  const { currentStreak, longestStreak } = useMemo(() => {
    if (myListens.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const days = new Set();
    for (const s of myListens) {
      const d = new Date(s.timestampMs);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }

    const sortedDays = [...days].sort().reverse();
    let current = 0;
    let longest = 0;
    let streak = 0;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = `${yesterdayDate.getFullYear()}-${yesterdayDate.getMonth()}-${yesterdayDate.getDate()}`;

    // Current streak — must include today or yesterday
    if (sortedDays[0] === todayKey || sortedDays[0] === yesterdayKey) {
      let checkDate = new Date(sortedDays[0] === todayKey ? today : yesterdayDate);
      for (let i = 0; i < 365; i++) {
        const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
        if (days.has(key)) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
    }

    // Longest streak
    const allDaysSorted = [...days].sort();
    streak = 1;
    longest = 1;
    for (let i = 1; i < allDaysSorted.length; i++) {
      const [y1, m1, d1] = allDaysSorted[i - 1].split("-").map(Number);
      const [y2, m2, d2] = allDaysSorted[i].split("-").map(Number);
      const date1 = new Date(y1, m1, d1);
      const date2 = new Date(y2, m2, d2);
      const diff = Math.round((date2 - date1) / 86400000);
      if (diff === 1) {
        streak++;
        longest = Math.max(longest, streak);
      } else {
        streak = 1;
      }
    }

    return { currentStreak: current, longestStreak: Math.max(longest, current) };
  }, [myListens]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening Streaks</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111] rounded-lg py-3 px-3 text-center">
          <div className="text-2xl font-extrabold text-[#f59e0b]">{currentStreak}</div>
          <div className="text-[10px] text-gs-dim font-mono mt-0.5">Current Streak</div>
          <div className="text-[9px] text-gs-faint mt-0.5">{currentStreak === 1 ? "day" : "days"}</div>
        </div>
        <div className="bg-[#111] rounded-lg py-3 px-3 text-center">
          <div className="text-2xl font-extrabold text-[#8b5cf6]">{longestStreak}</div>
          <div className="text-[10px] text-gs-dim font-mono mt-0.5">Longest Streak</div>
          <div className="text-[9px] text-gs-faint mt-0.5">{longestStreak === 1 ? "day" : "days"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Night Owl / Early Bird indicator ────────────────────────────────────
function ListeningPatternIndicator({ myListens }) {
  const pattern = useMemo(() => {
    if (myListens.length < 3) return null;
    let nightCount = 0;
    let morningCount = 0;
    for (const s of myListens) {
      const h = new Date(s.timestampMs).getHours();
      if (h >= 21 || h < 5) nightCount++;
      if (h >= 5 && h < 10) morningCount++;
    }
    if (nightCount > morningCount && nightCount >= 3) return { type: "night", label: "Night Owl", icon: "\uD83E\uDD89", color: "#8b5cf6", desc: "Most of your listening happens after dark" };
    if (morningCount > nightCount && morningCount >= 3) return { type: "morning", label: "Early Bird", icon: "\uD83D\uDC26", color: "#f59e0b", desc: "You start your mornings with vinyl" };
    return null;
  }, [myListens]);

  if (!pattern) return null;

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg mb-4" style={{ background: `${pattern.color}08`, border: `1px solid ${pattern.color}22` }}>
      <span className="text-lg">{pattern.icon}</span>
      <div>
        <span className="text-xs font-bold" style={{ color: pattern.color }}>{pattern.label}</span>
        <div className="text-[10px] text-gs-dim">{pattern.desc}</div>
      </div>
    </div>
  );
}

// ── Album art mosaic ────────────────────────────────────────────────────
function AlbumArtMosaic({ myListens }) {
  const uniqueAlbums = useMemo(() => {
    const seen = new Set();
    const albums = [];
    for (const s of myListens) {
      const key = `${s.track.artist}::${s.track.album}`;
      if (!seen.has(key) && s.track.album) {
        seen.add(key);
        albums.push({ album: s.track.album, artist: s.track.artist });
      }
      if (albums.length >= 9) break;
    }
    return albums;
  }, [myListens]);

  if (uniqueAlbums.length < 4) return null;

  const gridSize = uniqueAlbums.length >= 9 ? 3 : 2;
  const items = uniqueAlbums.slice(0, gridSize * gridSize);

  return (
    <div className="mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em]">Recent Albums</div>
      <div className="rounded-[14px] overflow-hidden border border-gs-border" style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: "2px" }}>
        {items.map((item, i) => (
          <div key={i} className="aspect-square">
            <AlbumArt album={item.album} artist={item.artist} accent="#0ea5e9" size="100%" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Share Now Playing button ─────────────────────────────────────────────
function ShareNowPlaying({ track }) {
  const [shared, setShared] = useState(false);

  const handleShare = useCallback(() => {
    const text = `Now spinning: ${track.title} by ${track.artist}${track.album ? ` from "${track.album}"` : ""}${track.year ? ` (${track.year})` : ""} \uD83C\uDFB6\n\nTracked by Vinyl Buddy on groovestack.co`;
    navigator.clipboard.writeText(text).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }, [track]);

  return (
    <div className="relative">
      <button onClick={handleShare} className="flex items-center gap-1.5 text-[10px] text-gs-dim bg-transparent border border-[#222] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-gs-accent hover:text-gs-accent transition-all duration-200">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Share
      </button>
      {shared && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] text-gs-accent bg-[#111] border border-gs-border rounded px-2 py-1 whitespace-nowrap" style={{ animation: "vb-fade-in 0.15s ease-out" }}>
          Copied!
        </div>
      )}
    </div>
  );
}

// ── Setup Guide ─────────────────────────────────────────────────────────
function SetupGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
          </svg>
          <span className="text-[13px] font-bold text-gs-text">Vinyl Buddy Setup Guide</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          <div className="text-xs text-gs-muted mb-3">Hardware wiring diagram for ESP32 + I2S INMP441 microphone</div>

          {/* Wiring diagram placeholder */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 mb-4 font-mono text-[10px] text-gs-muted leading-relaxed">
            <div className="text-[11px] text-gs-accent font-bold mb-2">ESP32-DevKitC V4 Pinout</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="flex justify-between"><span className="text-[#22c55e]">3V3</span><span>---&gt; INMP441 VDD</span></div>
              <div className="flex justify-between"><span className="text-[#f87171]">GND</span><span>---&gt; INMP441 GND</span></div>
              <div className="flex justify-between"><span className="text-[#0ea5e9]">GPIO 25</span><span>---&gt; INMP441 WS</span></div>
              <div className="flex justify-between"><span className="text-[#8b5cf6]">GPIO 33</span><span>---&gt; INMP441 SCK</span></div>
              <div className="flex justify-between"><span className="text-[#f59e0b]">GPIO 32</span><span>---&gt; INMP441 SD</span></div>
              <div className="flex justify-between"><span className="text-[#22c55e]">GND</span><span>---&gt; INMP441 L/R</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#1a1a1a] text-gs-faint">
              Note: Connect L/R to GND for left channel mono output. Power via USB-C.
            </div>
          </div>

          {/* Component list */}
          <div className="text-[11px] text-gs-muted mb-2 font-semibold">Required Components</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {[
              "ESP32-DevKitC V4 (or compatible)",
              "INMP441 I2S MEMS Microphone",
              "0.96\" SSD1306 OLED Display (optional)",
              "USB-C cable for power",
              "Jumper wires (6x)",
              "Breadboard (for prototyping)",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-gs-dim">
                <div className="w-1.5 h-1.5 rounded-full bg-gs-accent shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function VinylBuddyScreen({ currentUser, listeningHistory, activated, deviceCode, onActivate, onDeactivate }) {
  useEffect(() => { ensureKeyframes(); }, []);

  if (!activated) {
    return <LandingPage onActivate={onActivate} />;
  }
  return (
    <Dashboard
      currentUser={currentUser}
      listeningHistory={listeningHistory}
      deviceCode={deviceCode}
      onDeactivate={onDeactivate}
    />
  );
}

// ============================================================================
// SPINNING VINYL HERO ANIMATION
// ============================================================================
function SpinningVinyl({ size = 120 }) {
  const grooves = Array.from({ length: 18 }, (_, i) => {
    const start = i * 20;
    return `#${i % 2 === 0 ? "1a1a1a" : "222"} ${start}deg,#${i % 2 === 0 ? "1a1a1a" : "222"} ${start + 10}deg`;
  }).join(",");

  return (
    <div style={{ width: size, height: size, animation: "vb-spin 4s linear infinite", borderRadius: "50%", background: `conic-gradient(from 0deg,${grooves})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px #333, 0 0 40px #0ea5e922", flexShrink: 0 }}>
      <div style={{ width: size * 0.35, height: size * 0.35, borderRadius: "50%", background: "radial-gradient(circle, #0ea5e9cc, #6366f166)", boxShadow: "0 0 12px #0ea5e966" }} />
    </div>
  );
}

// ============================================================================
// OTP-STYLE CODE INPUT
// ============================================================================
function CodeInput({ value, onChange, onSubmit, error }) {
  const refs = useRef([]);
  const chars = value.padEnd(12, "").split("").slice(0, 12);

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
    if (!raw) return;
    const ch = raw[raw.length - 1];
    const next = [...chars];
    next[i] = ch;
    const newVal = next.join("").replace(/ /g, "");
    onChange(newVal);
    if (i < 11 && refs.current[i + 1]) {
      refs.current[i + 1].focus();
    }
    if (newVal.length === 12 && i === 11) {
      onSubmit?.(newVal);
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (chars[i] && chars[i] !== " ") {
        const next = [...chars];
        next[i] = " ";
        onChange(next.join("").trim());
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = [...chars];
        next[i - 1] = " ";
        onChange(next.join("").trim());
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      onSubmit?.(value);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^A-Fa-f0-9]/g, "").toUpperCase().slice(0, 12);
    onChange(pasted);
    const focusIdx = Math.min(pasted.length, 11);
    setTimeout(() => refs.current[focusIdx]?.focus(), 0);
  };

  const isValid = /^[A-Fa-f0-9]{12}$/.test(value);

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1 flex-wrap justify-center">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="relative">
              {i > 0 && i % 4 === 0 && <div className="absolute -left-1 top-1/2 -translate-y-1/2 text-gs-faint text-[10px] select-none">&middot;</div>}
              <input
                ref={el => refs.current[i] = el}
                value={chars[i]?.trim() || ""}
                onChange={e => handleChange(i, e)}
                onKeyDown={e => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                maxLength={2}
                className={`w-8 h-10 text-center bg-[#111] rounded-lg text-gs-text text-sm font-mono font-bold uppercase outline-none border transition-all duration-150 focus:border-gs-accent focus:shadow-[0_0_0_2px_#0ea5e933] ${
                  error ? "border-red-500/50" : chars[i]?.trim() ? "border-[#333]" : "border-[#222]"
                } ${i > 0 && i % 4 === 0 ? "ml-2" : ""}`}
              />
            </div>
          ))}
        </div>
        {isValid && (
          <div className="w-6 h-6 rounded-full bg-[#22c55e22] border border-[#22c55e44] flex items-center justify-center shrink-0 ml-1" style={{ animation: "vb-fade-in 0.2s ease-out" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
        )}
      </div>
      {error && <div className="text-[11px] text-red-500 mt-2 text-center">{error}</div>}
    </div>
  );
}

// ============================================================================
// PRE-ACTIVATION LANDING PAGE
// ============================================================================
function LandingPage({ onActivate }) {
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [howItWorks, setHowItWorks] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const handleActivate = useCallback((val) => {
    const trimmed = (val || code).trim();
    if (!/^[A-Fa-f0-9]{12}$/.test(trimmed)) {
      setError("Enter a valid 12-character hex device code");
      return;
    }
    setError("");
    onActivate(trimmed.toUpperCase());
  }, [code, onActivate]);

  if (demoMode) {
    return (
      <DemoDashboard onExit={() => setDemoMode(false)} />
    );
  }

  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>
          <path d="M8 17V5l12-2v12"/>
        </svg>
      ),
      title: "Track Identification",
      desc: "Acoustic fingerprinting identifies every track spinning on your turntable in real time",
      color: "#0ea5e9"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10M12 20V4M6 20v-6"/>
        </svg>
      ),
      title: "Listening Analytics",
      desc: "Deep stats on your sessions: top artists, albums, listening streaks, and weekly trends",
      color: "#8b5cf6"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
        </svg>
      ),
      title: "Live Device Sync",
      desc: "Real-time connection to your ESP32 with heartbeat monitoring and health diagnostics",
      color: "#22c55e"
    },
  ];

  const howSteps = [
    { num: "1", title: "Plug in your Vinyl Buddy", desc: "Connect the ESP32 to power via USB-C. The OLED screen will display a setup code." },
    { num: "2", title: "Connect to WiFi", desc: "The device creates a hotspot. Connect and enter your WiFi credentials." },
    { num: "3", title: "Enter your device code", desc: "Type the 12-character hex code shown on the OLED screen into the field below." },
    { num: "4", title: "Start spinning records", desc: "Place the device near your turntable. It will automatically detect and identify tracks." },
  ];

  return (
    <div className="vb-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text mb-0.5">Vinyl Buddy</h1>
        <p className="text-xs text-gs-dim">Your personal vinyl identification companion</p>
      </div>

      {/* Hero card with spinning vinyl */}
      <div className="rounded-2xl p-7 mb-5 relative overflow-hidden bg-gradient-to-br from-[#0ea5e911] to-[#6366f111] border border-[#0ea5e922]">
        <div className="absolute -top-5 -right-5 w-[120px] h-[120px] rounded-full bg-[radial-gradient(circle,#0ea5e915,transparent_70%)]" />
        <div className="flex items-center gap-5 mb-4">
          <div className="shrink-0 hidden sm:block">
            <SpinningVinyl size={90} />
          </div>
          <div className="sm:hidden shrink-0">
            <SpinningVinyl size={64} />
          </div>
          <div>
            <div className="text-xl font-extrabold text-gs-text tracking-[-0.03em]">Meet Vinyl Buddy</div>
            <div className="text-[13px] text-gs-muted leading-normal mt-1">
              A tiny ESP32-powered device that sits next to your turntable, listens to your records, and identifies every track you play.
            </div>
          </div>
        </div>

        {/* How it works steps */}
        <div className="flex gap-2 mt-5">
          {["Place near turntable", "Music auto-detected", "Track identified"].map((step, i) => (
            <div key={i} className="flex-1 rounded-[10px] px-3 py-2.5 text-center bg-gs-sidebar/50 transition-colors duration-150 hover:bg-gs-sidebar/80">
              <div className="text-sm font-extrabold text-gs-accent mb-1">{i + 1}</div>
              <div className="text-[11px] text-[#777] leading-snug">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
        {features.map(f => (
          <div key={f.title} className="bg-gs-card border border-gs-border rounded-[14px] py-[18px] px-4 transition-all duration-200 hover:border-[#333]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${f.color}15`, border: `1px solid ${f.color}25` }}>
              {f.icon}
            </div>
            <div className="text-[13px] font-bold text-gs-text mb-1.5">{f.title}</div>
            <div className="text-[11px] text-[#666] leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* How It Works expandable */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] mb-5 overflow-hidden">
        <button
          onClick={() => setHowItWorks(!howItWorks)}
          className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-[13px] font-bold text-gs-text">How It Works</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: howItWorks ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        {howItWorks && (
          <div className="px-4 pb-4 vb-fade-in">
            <div className="flex flex-col gap-3">
              {howSteps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold bg-gradient-to-br from-gs-accent to-gs-indigo text-white shrink-0 mt-0.5">
                    {step.num}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gs-text">{step.title}</div>
                    <div className="text-[11px] text-[#666] leading-relaxed mt-0.5">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activation section */}
      {!showForm ? (
        <div className="text-center py-5">
          <button
            onClick={() => setShowForm(true)}
            className="gs-btn-gradient px-9 py-3.5 text-sm tracking-[-0.02em] hover:scale-105 transition-transform"
          >
            Activate Your Device
          </button>
          <div className="flex items-center justify-center gap-3 mt-3">
            <p className="text-[11px] text-gs-faint">Already have a Vinyl Buddy? Enter your device code.</p>
          </div>
          <button
            onClick={() => setDemoMode(true)}
            className="mt-3 bg-transparent border border-[#333] text-gs-dim text-[11px] cursor-pointer px-4 py-2 rounded-lg hover:border-gs-accent hover:text-gs-accent transition-all duration-200"
          >
            Try Demo Mode
          </button>
        </div>
      ) : (
        <div className="bg-gs-card border border-gs-border rounded-[14px] py-[22px] px-5 vb-fade-in">
          <div className="text-sm font-bold text-gs-text mb-1">Activate Your Device</div>
          <p className="text-[11px] text-[#666] mb-4 leading-normal">
            Enter the 12-character hex code shown on your Vinyl Buddy's OLED screen during WiFi setup.
          </p>
          <div className="flex flex-col items-center gap-4">
            <CodeInput value={code} onChange={(v) => { setCode(v); setError(""); }} onSubmit={handleActivate} error={error} />
            <div className="flex gap-2.5 items-center">
              <button onClick={() => handleActivate()} className="gs-btn-gradient py-[11px] px-[22px] rounded-[9px] text-[13px] whitespace-nowrap hover:scale-105 transition-transform">
                Activate
              </button>
              <button onClick={() => { setShowForm(false); setCode(""); setError(""); }} className="bg-transparent border border-[#333] text-gs-dim text-[11px] cursor-pointer px-4 py-[11px] rounded-[9px] hover:border-[#555] transition-colors">
                Cancel
              </button>
            </div>
          </div>

          {/* Troubleshooting guide */}
          <div className="mt-5 pt-4 border-t border-[#1a1a1a]">
            <div className="text-[11px] font-bold text-gs-muted mb-2.5">Troubleshooting</div>
            <div className="space-y-2.5">
              {[
                { q: "Where do I find the device code?", a: "Plug in your Vinyl Buddy via USB-C. The 12-character hex code appears on the OLED screen during initial setup." },
                { q: "My device screen is blank", a: "Try a different USB-C cable or power source. Hold the reset button on the back of the device for 5 seconds." },
                { q: "Code not accepted?", a: "Make sure the code is exactly 12 hex characters (0-9, A-F). The code is case-insensitive. Check for similar-looking characters like 0/O or 1/I." },
                { q: "WiFi connection issues", a: "Ensure your Vinyl Buddy is within range of your WiFi router. The device only supports 2.4GHz networks, not 5GHz." },
              ].map((item, i) => (
                <details key={i} className="group">
                  <summary className="text-[11px] text-gs-accent cursor-pointer list-none flex items-center gap-1.5 hover:text-[#38bdf8] transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 transition-transform group-open:rotate-90">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    {item.q}
                  </summary>
                  <div className="text-[11px] text-[#666] leading-relaxed mt-1 ml-4">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEMO DASHBOARD — shows sample data without a device
// ============================================================================
function DemoDashboard({ onExit }) {
  const demoHistory = useMemo(() => generateDemoData(), []);
  return (
    <div className="vb-fade-in">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text">Vinyl Buddy</h1>
          <Badge label="Demo" color="#f59e0b" />
        </div>
        <button onClick={onExit} className="text-[11px] text-gs-dim bg-transparent border border-[#333] px-3 py-1.5 rounded-lg cursor-pointer hover:border-gs-accent hover:text-gs-accent transition-all duration-200">
          Exit Demo
        </button>
      </div>
      <p className="text-xs text-gs-dim mb-5">Sample data &mdash; activate a real device to see your listening stats</p>
      <Dashboard
        currentUser="__demo__"
        listeningHistory={demoHistory}
        deviceCode="DEMO00112233"
        onDeactivate={onExit}
        isDemo
      />
    </div>
  );
}

// ============================================================================
// POST-ACTIVATION DASHBOARD
// ============================================================================
function Dashboard({ currentUser, listeningHistory, deviceCode, onDeactivate, isDemo }) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(!isDemo);

  // Simulate loading state for real data
  useEffect(() => {
    if (!isDemo) {
      const t = setTimeout(() => setLoading(false), 600);
      return () => clearTimeout(t);
    }
  }, [isDemo]);

  // Filter sessions for current user
  const myRawListens = (listeningHistory || [])
    .filter(s => s.username === currentUser)
    .sort((a, b) => b.timestampMs - a.timestampMs);
  const myListens = foldCapturedSessions(myRawListens);

  // Compute stats
  const artists = new Set(myListens.map(s => s.track.artist));
  const albums = new Set(myListens.map(s => s.track.album));
  const avgScore = myListens.length > 0
    ? Math.round(myListens.reduce((sum, s) => sum + (s.score || 0), 0) / myListens.length)
    : 0;

  // Weekly stats (last 7 days listen counts per day)
  const weeklyData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = myListens.filter(s => s.timestampMs >= dayStart && s.timestampMs < dayEnd).length;
      days.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count,
      });
    }
    return days;
  }, [myListens]);

  // Previous week stats for trend comparison
  const prevWeekListens = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const twoWeeksAgo = now - 14 * 86400000;
    return myListens.filter(s => s.timestampMs >= twoWeeksAgo && s.timestampMs < weekAgo);
  }, [myListens]);

  const thisWeekListens = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    return myListens.filter(s => s.timestampMs >= weekAgo);
  }, [myListens]);

  const prevArtists = new Set(prevWeekListens.map(s => s.track.artist));
  const prevAlbums = new Set(prevWeekListens.map(s => s.track.album));
  const thisArtists = new Set(thisWeekListens.map(s => s.track.artist));
  const thisAlbums = new Set(thisWeekListens.map(s => s.track.album));

  // Top artist
  const artistCounts = {};
  for (const s of myListens) {
    if (s.track.artist) artistCounts[s.track.artist] = (artistCounts[s.track.artist] || 0) + 1;
  }
  const topArtist = Object.entries(artistCounts).sort(([, a], [, b]) => b - a)[0];

  // Top track
  const trackCounts = {};
  for (const s of myListens) {
    const key = `${s.track.title} \u2014 ${s.track.artist}`;
    trackCounts[key] = (trackCounts[key] || 0) + 1;
  }
  const topTrack = Object.entries(trackCounts).sort(([, a], [, b]) => b - a)[0];
  const topTrackSession = topTrack ? myListens.find(s => `${s.track.title} \u2014 ${s.track.artist}` === topTrack[0]) : null;

  // Most recent listen (now playing card)
  const nowPlaying = myListens[0] || null;
  const isRecent = nowPlaying && (Date.now() - nowPlaying.timestampMs < 600000); // within 10 min

  function TrendIndicator({ current, previous }) {
    if (previous === 0 && current === 0) return null;
    const diff = current - previous;
    if (diff === 0) return <span className="text-[9px] text-gs-faint font-mono">=</span>;
    const up = diff > 0;
    return (
      <span className={`text-[9px] font-bold font-mono ${up ? "text-[#22c55e]" : "text-[#f87171]"}`}>
        {up ? "\u2191" : "\u2193"}{Math.abs(diff)}
      </span>
    );
  }

  const statCards = [
    { l: "Total Listens", v: myListens.length, c: "#0ea5e9", tip: "Total number of identified tracks across all sessions", trend: <TrendIndicator current={thisWeekListens.length} previous={prevWeekListens.length} /> },
    { l: "Artists", v: artists.size, c: "#8b5cf6", tip: "Unique artists identified from your vinyl collection", trend: <TrendIndicator current={thisArtists.size} previous={prevArtists.size} /> },
    { l: "Albums", v: albums.size, c: "#f59e0b", tip: "Unique albums detected across all listening sessions", trend: <TrendIndicator current={thisAlbums.size} previous={prevAlbums.size} /> },
    { l: "Avg Score", v: `${avgScore}%`, c: "#22c55e", tip: "Average confidence score of track identifications" },
  ];

  return (
    <div>
      {/* Header — only show if not in demo wrapper */}
      {!isDemo && (
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-0.5">
            <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text">Vinyl Buddy</h1>
            <Badge label="Active" color="#22c55e" />
          </div>
          <p className="text-xs text-gs-dim">Your listening dashboard</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-[22px]">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-gs-card border border-gs-border rounded-xl p-3.5">
              <Skeleton w={40} h={24} />
              <div className="mt-2"><Skeleton w={60} h={10} /></div>
            </div>
          ))
        ) : (
          statCards.map(s => (
            <Tooltip key={s.l} text={s.tip}>
              <div className="gs-stat bg-gs-card border border-gs-border rounded-xl cursor-default transition-all duration-200 hover:border-[#333]">
                <div className="flex items-center gap-1.5">
                  <div className="text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: s.c }}>{s.v}</div>
                  {s.trend}
                </div>
                <div className="text-[10px] text-gs-dim font-mono mt-[3px]">{s.l}</div>
              </div>
            </Tooltip>
          ))
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#1a1a1a] mb-[18px]">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-[9px] px-4 bg-transparent border-none text-xs font-semibold cursor-pointer capitalize -mb-px border-b-2 transition-all duration-200 ${
              tab === t ? "border-gs-accent text-gs-accent" : "border-transparent text-gs-dim hover:text-gs-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content with transitions */}
      <div className="vb-fade-in" key={tab}>
        {/* Overview tab */}
        {tab === "overview" && (
          <OverviewTab
            myListens={myListens}
            nowPlaying={nowPlaying}
            isRecent={isRecent}
            topArtist={topArtist}
            topTrack={topTrack}
            topTrackSession={topTrackSession}
            weeklyData={weeklyData}
            loading={loading}
          />
        )}

        {/* History tab */}
        {tab === "history" && (
          <HistoryTab myListens={myListens} loading={loading} />
        )}

        {/* Stats tab */}
        {tab === "stats" && (
          <StatsTab myListens={myListens} loading={loading} />
        )}

        {/* Device tab */}
        {tab === "device" && (
          <DeviceCard currentUser={currentUser} deviceCode={deviceCode} onDeactivate={onDeactivate} isDemo={isDemo} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NOW PLAYING CARD — with equalizer, collection match, actions
// ============================================================================
function NowPlayingCard({ nowPlaying, isRecent, myListens }) {
  // Simulate collection match — check if the track artist+album is "in collection"
  // In a real implementation, this would check the user's records collection via API
  const collectionMatch = useMemo(() => {
    const demoCollection = [
      "Led Zeppelin::Led Zeppelin IV",
      "Pink Floyd::Wish You Were Here",
      "Queen::A Night at the Opera",
      "The Beatles::Sgt. Pepper's",
    ];
    const key = `${nowPlaying.track.artist}::${nowPlaying.track.album}`;
    return demoCollection.includes(key);
  }, [nowPlaying]);

  // Simulate marketplace availability
  const marketplaceAvailable = useMemo(() => {
    // Placeholder: albums with year before 1980 are "available" in marketplace
    return nowPlaying.track.year && nowPlaying.track.year < 1980;
  }, [nowPlaying]);

  return (
    <div className="bg-gradient-to-br from-[#0ea5e908] to-[#6366f108] border border-[#0ea5e933] rounded-[14px] overflow-hidden mb-4">
      <div className="h-0.5 bg-gradient-to-r from-gs-accent via-[#8b5cf6] to-transparent" />
      <div className="p-4 flex gap-4 items-center">
        <div className="relative shrink-0">
          <AlbumArt album={nowPlaying.track.album} artist={nowPlaying.track.artist} accent="#0ea5e9" size={64} />
          {isRecent && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#22c55e] border-2 border-[#0a0a0a]" style={{ animation: "vb-now-pulse 2s ease-in-out infinite" }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-gs-accent font-bold font-mono uppercase tracking-wider">
              {isRecent ? "Now Playing" : "Last Played"}
            </span>
            {isRecent && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" style={{ animation: "vb-pulse 1.5s ease-in-out infinite" }} />
                <span className="text-[9px] text-[#22c55e] font-mono">LIVE</span>
              </span>
            )}
            {/* Equalizer visualization */}
            <EqualizerVis active={isRecent} barCount={5} height={16} color="#0ea5e9" />
          </div>
          <div className="text-[15px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{nowPlaying.track.title}</div>
          <div className="text-xs text-gs-muted">{nowPlaying.track.artist}</div>
          <div className="text-[10px] text-gs-dim">
            {nowPlaying.track.album}{nowPlaying.track.year ? ` \u00B7 ${nowPlaying.track.year}` : ""}
          </div>
          {/* Collection match indicator */}
          {collectionMatch && (
            <div className="flex items-center gap-1 mt-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span className="text-[9px] text-[#22c55e] font-bold">In Your Collection</span>
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-[10px] text-gs-faint font-mono">{relTime(nowPlaying.timestampMs)}</span>
          {nowPlaying.score > 0 && (
            <div className={`text-[10px] font-semibold font-mono ${nowPlaying.score >= 90 ? "text-[#22c55e]" : "text-[#f59e0b]"}`}>
              {nowPlaying.score}% match
            </div>
          )}
          <ShareNowPlaying track={nowPlaying.track} />
        </div>
      </div>
      {/* Action buttons row */}
      {(!collectionMatch || marketplaceAvailable) && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          {!collectionMatch && (
            <button className="flex items-center gap-1.5 text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add to Collection
            </button>
          )}
          {marketplaceAvailable && (
            <button className="flex items-center gap-1.5 text-[10px] text-[#f59e0b] bg-[#f59e0b08] border border-[#f59e0b22] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#f59e0b15] transition-all duration-200">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              Buy This Record
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================
function OverviewTab({ myListens, nowPlaying, isRecent, topArtist, topTrack, topTrackSession, weeklyData, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton w="100%" h={100} rounded={14} />
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton w="100%" h={90} rounded={14} />
          <Skeleton w="100%" h={90} rounded={14} />
        </div>
        {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (myListens.length === 0) {
    return <Empty icon={"\uD83C\uDFB6"} text="No listening data yet. Play a record near your Vinyl Buddy to get started!" />;
  }

  const maxDay = Math.max(...weeklyData.map(d => d.count), 1);

  return (
    <>
      {/* Now Playing card */}
      {nowPlaying && (
        <NowPlayingCard nowPlaying={nowPlaying} isRecent={isRecent} myListens={myListens} />
      )}

      {/* Sound wave visualization */}
      <div className="mb-4">
        <SoundWaveVis active={isRecent} />
      </div>

      {/* Listening pattern indicator */}
      <ListeningPatternIndicator myListens={myListens} />

      {/* Album art mosaic */}
      <AlbumArtMosaic myListens={myListens} />

      {/* Weekly Stats bar chart */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listens This Week</div>
        <div className="flex items-end gap-1.5 h-16">
          {weeklyData.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[9px] font-mono font-bold text-gs-muted" style={{ opacity: day.count > 0 ? 1 : 0 }}>{day.count}</div>
              <div className="w-full rounded-t-[3px] transition-all duration-500" style={{
                height: `${Math.max((day.count / maxDay) * 48, day.count > 0 ? 6 : 2)}px`,
                background: day.count > 0
                  ? `linear-gradient(to top, #0ea5e9, #6366f1)`
                  : "#1a1a1a",
              }} />
              <div className="text-[9px] text-gs-faint font-mono">{day.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-[18px]">
        {/* Top Artist */}
        <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden transition-all duration-200 hover:border-[#333]">
          <div className="h-0.5 bg-gradient-to-r from-[#8b5cf6] to-transparent" />
          <div className="p-4 px-3.5">
            <div className="text-[10px] text-gs-dim font-mono mb-2">TOP ARTIST</div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 bg-gradient-to-br from-[#8b5cf6] to-gs-indigo">
                {topArtist ? topArtist[0].charAt(0).toUpperCase() : "?"}
              </div>
              <div>
                <div className="text-sm font-bold text-gs-text">{topArtist ? topArtist[0] : "\u2014"}</div>
                <div className="text-[11px] text-[#8b5cf6]">{topArtist ? `${topArtist[1]} plays` : ""}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Track */}
        <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden transition-all duration-200 hover:border-[#333]">
          <div className="h-0.5 bg-gradient-to-r from-gs-accent to-transparent" />
          <div className="p-4 px-3.5">
            <div className="text-[10px] text-gs-dim font-mono mb-2">TOP TRACK</div>
            <div className="flex items-center gap-2.5">
              <AlbumArt album={topTrackSession?.track.album} artist={topTrackSession?.track.artist} accent="#0ea5e9" size={40} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">
                  {topTrack ? topTrack[0].split(" \u2014 ")[0] : "\u2014"}
                </div>
                <div className="text-[11px] text-gs-accent">{topTrack ? `${topTrack[1]} plays` : ""}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em]">Recent Activity</div>
        <div className="flex flex-col gap-1.5">
          {myListens.slice(0, 5).map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </div>
      </div>

      {/* Listening Streaks */}
      <ListeningStreaks myListens={myListens} />

      {/* Achievement Badges */}
      <AchievementBadges myListens={myListens} />

      {/* Recommendations based on listening history */}
      <RecommendationsSection myListens={myListens} />

      {/* Recently Played widget */}
      <div className="mb-2">
        <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em]">Recently Played Widget</div>
        <RecentlyPlayedWidget myListens={myListens} />
      </div>
    </>
  );
}

// ============================================================================
// HISTORY TAB — with search, date grouping, and CSV export
// ============================================================================
function HistoryTab({ myListens, loading }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return myListens;
    const q = search.toLowerCase();
    return myListens.filter(s =>
      s.track.title?.toLowerCase().includes(q) ||
      s.track.artist?.toLowerCase().includes(q) ||
      s.track.album?.toLowerCase().includes(q)
    );
  }, [myListens, search]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = [];
    let currentLabel = null;
    for (const s of filtered) {
      const label = dateLabel(s.timestampMs);
      if (label !== currentLabel) {
        groups.push({ type: "header", label });
        currentLabel = label;
      }
      groups.push({ type: "session", data: s });
    }
    return groups;
  }, [filtered]);

  const exportCSV = useCallback(() => {
    const headers = ["Title", "Artist", "Album", "Year", "Score", "Date"];
    const rows = myListens.map(s => [
      `"${(s.track.title || "").replace(/"/g, '""')}"`,
      `"${(s.track.artist || "").replace(/"/g, '""')}"`,
      `"${(s.track.album || "").replace(/"/g, '""')}"`,
      s.track.year || "",
      s.score || "",
      new Date(s.timestampMs).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vinyl-buddy-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [myListens]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (myListens.length === 0) {
    return <Empty icon={"\uD83C\uDFA7"} text="No listening history yet. Connect a Vinyl Buddy to start tracking!" />;
  }

  return (
    <div>
      {/* Search and export bar */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tracks, artists, albums..."
            className="w-full py-2.5 pl-9 pr-3 bg-[#111] rounded-lg text-xs text-gs-text outline-none border border-[#222] focus:border-gs-accent transition-colors placeholder:text-gs-faint"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gs-dim text-xs p-0.5 hover:text-gs-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <Tooltip text="Download listening history as CSV">
          <button onClick={exportCSV} className="bg-[#111] border border-[#222] rounded-lg p-2.5 cursor-pointer hover:border-gs-accent transition-colors group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-[#0ea5e9] transition-colors">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </button>
        </Tooltip>
      </div>

      {/* Result count */}
      {search && (
        <div className="text-[10px] text-gs-dim font-mono mb-2">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </div>
      )}

      {filtered.length === 0 ? (
        <Empty icon={"\uD83D\uDD0D"} text={`No tracks matching "${search}"`} />
      ) : (
        <div className="flex flex-col gap-1">
          {grouped.map((item, i) =>
            item.type === "header" ? (
              <div key={`h-${item.label}`} className={`text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em] ${i > 0 ? "mt-3" : ""} mb-1.5`}>
                {item.label}
              </div>
            ) : (
              <div key={item.data.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-[#0ea5e933]">
                <div className="h-0.5 bg-gradient-to-r from-gs-accent via-[#8b5cf6] to-transparent" />
                <div className="py-3 px-3.5 flex gap-3 items-center">
                  <AlbumArt album={item.data.track.album} artist={item.data.track.artist} accent="#0ea5e9" size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{item.data.track.title}</div>
                    <div className="text-[11px] text-gs-muted">{item.data.track.artist}</div>
                    <div className="text-[10px] text-gs-dim">{item.data.track.album}{item.data.track.year ? ` \u00B7 ${item.data.track.year}` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gs-faint font-mono">{relTime(item.data.timestampMs)}</span>
                    {item.data.score > 0 && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold font-mono border ${
                          item.data.score >= 90
                            ? "bg-[#22c55e11] border-[#22c55e22] text-[#22c55e]"
                            : "bg-[#f59e0b11] border-[#f59e0b22] text-[#f59e0b]"
                        }`}
                      >
                        {item.data.score}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SESSION ROW — compact row for Overview recent activity
// ============================================================================
function SessionRow({ session }) {
  return (
    <div className="bg-gs-card border border-gs-border rounded-[10px] py-2.5 px-3 flex gap-2.5 items-center transition-colors duration-150 hover:border-[#333]">
      <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={30} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
        <div className="text-[10px] text-[#666]">{session.track.artist}</div>
      </div>
      <span className="text-[10px] text-gs-faint font-mono shrink-0">{relTime(session.timestampMs)}</span>
    </div>
  );
}

// ============================================================================
// RECENTLY PLAYED WIDGET — embeddable compact list
// ============================================================================
function RecentlyPlayedWidget({ myListens }) {
  const recent = myListens.slice(0, 4);
  if (recent.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-gs-accent to-transparent" />
      <div className="p-3.5">
        <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em] flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Recently Played
        </div>
        <div className="flex flex-col gap-1.5">
          {recent.map(session => (
            <div key={session.id} className="flex gap-2 items-center py-1">
              <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-gs-text truncate">{session.track.title}</div>
                <div className="text-[9px] text-gs-dim truncate">{session.track.artist}</div>
              </div>
              <span className="text-[9px] text-gs-faint font-mono shrink-0">{relTime(session.timestampMs)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RECOMMENDATIONS — based on listening history, suggest records
// ============================================================================
function RecommendationsSection({ myListens }) {
  // Build recommendations from artist frequency — suggest albums the user hasn't listened to
  const recs = useMemo(() => {
    const artistFreq = {};
    for (const s of myListens) {
      if (s.track.artist) artistFreq[s.track.artist] = (artistFreq[s.track.artist] || 0) + 1;
    }
    const listenedAlbums = new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`));

    // Mock recommended records based on top artists
    const mockRecs = [
      { title: "Houses of the Holy", artist: "Led Zeppelin", genre: "Rock", reason: "Based on your Led Zeppelin listens" },
      { title: "The Dark Side of the Moon", artist: "Pink Floyd", genre: "Prog Rock", reason: "Based on your Pink Floyd listens" },
      { title: "News of the World", artist: "Queen", genre: "Rock", reason: "Based on your Queen listens" },
      { title: "L.A. Woman", artist: "The Doors", genre: "Rock", reason: "Based on your Doors listens" },
      { title: "Let It Bleed", artist: "The Rolling Stones", genre: "Rock", reason: "Popular among vinyl collectors" },
      { title: "Rumours", artist: "Fleetwood Mac", genre: "Rock", reason: "Top-selling vinyl on GrooveStack" },
    ];

    // Filter out already listened albums
    return mockRecs
      .filter(r => !listenedAlbums.has(`${r.artist}::${r.title}`))
      .slice(0, 4);
  }, [myListens]);

  if (recs.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <span className="text-xs font-bold text-gs-text">Recommended For You</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {recs.map((rec, i) => (
          <div key={i} className="bg-gs-card border border-gs-border rounded-xl p-3 flex gap-3 items-center transition-all duration-200 hover:border-[#f59e0b33] cursor-pointer">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-[#f59e0b] to-[#f97316] font-bold text-white">
              {rec.artist.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gs-text truncate">{rec.title}</div>
              <div className="text-[10px] text-gs-muted truncate">{rec.artist}</div>
              <div className="text-[9px] text-[#f59e0b] mt-0.5">{rec.reason}</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0 opacity-50">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// STATS TAB — genre breakdown pie chart, share stats, recently played widget
// ============================================================================
function StatsTab({ myListens, loading }) {
  const [shareMsg, setShareMsg] = useState('');

  // Genre breakdown from artist mapping
  const genreData = useMemo(() => {
    const genreMap = {
      "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock",
      "The Doors": "Rock", "The Beatles": "Rock", "The Who": "Rock",
      "Eagles": "Rock", "Nirvana": "Grunge", "The Rolling Stones": "Rock",
      "John Coltrane": "Jazz", "Miles Davis": "Jazz", "Charles Mingus": "Jazz",
      "Herbie Hancock": "Jazz Fusion", "Nas": "Hip-Hop", "A Tribe Called Quest": "Hip-Hop",
      "Madvillain": "Hip-Hop", "Aphex Twin": "Electronic", "Daft Punk": "Electronic",
      "Flying Lotus": "Electronic", "Portishead": "Trip-Hop", "Massive Attack": "Trip-Hop",
      "My Bloody Valentine": "Shoegaze", "Black Sabbath": "Metal", "Metallica": "Metal",
      "Fleetwood Mac": "Rock",
    };
    const counts = {};
    for (const s of myListens) {
      const genre = genreMap[s.track.artist] || "Other";
      counts[genre] = (counts[genre] || 0) + 1;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const colors = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#f97316", "#14b8a6", "#64748b"];
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([genre, count], i) => ({
        genre,
        count,
        pct: Math.round((count / total) * 100),
        color: colors[i % colors.length],
      }));
  }, [myListens]);

  // Total listening time
  const totalMinutes = useMemo(() => {
    return Math.round(myListens.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0) / 60);
  }, [myListens]);

  const totalHours = Math.floor(totalMinutes / 60);
  const remainMins = totalMinutes % 60;

  // Share stats
  const handleShareStats = useCallback(() => {
    const topGenre = genreData[0];
    const summary = [
      `My Vinyl Buddy Listening Stats:`,
      `Total tracks: ${myListens.length}`,
      `Listening time: ${totalHours > 0 ? `${totalHours}h ${remainMins}m` : `${remainMins}m`}`,
      topGenre ? `Top genre: ${topGenre.genre} (${topGenre.pct}%)` : '',
      `Unique artists: ${new Set(myListens.map(s => s.track.artist)).size}`,
      '',
      'groovestack.co/vinyl-buddy',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(summary).catch(() => {});
    setShareMsg('Copied to clipboard!');
    setTimeout(() => setShareMsg(''), 2000);
  }, [myListens, genreData, totalHours, remainMins]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton w="100%" h={200} rounded={14} />
        <Skeleton w="100%" h={120} rounded={14} />
      </div>
    );
  }

  if (myListens.length === 0) {
    return <Empty icon={"\uD83D\uDCCA"} text="Not enough data yet. Keep spinning records to see your stats!" />;
  }

  return (
    <div>
      {/* Listening Stats summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 text-center">
          <div className="text-xl font-extrabold text-gs-accent">{myListens.length}</div>
          <div className="text-[10px] text-gs-dim font-mono">Tracks</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 text-center">
          <div className="text-xl font-extrabold text-[#8b5cf6]">{totalHours > 0 ? `${totalHours}h` : `${remainMins}m`}</div>
          <div className="text-[10px] text-gs-dim font-mono">Listen Time</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 text-center">
          <div className="text-xl font-extrabold text-[#22c55e]">{new Set(myListens.map(s => s.track.artist)).size}</div>
          <div className="text-[10px] text-gs-dim font-mono">Artists</div>
        </div>
      </div>

      {/* Genre Breakdown Pie Chart (using divs) */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-4 uppercase tracking-[0.06em]">Genre Breakdown</div>
        <div className="flex gap-5 items-center flex-col sm:flex-row">
          {/* CSS pie chart using conic-gradient */}
          <div className="shrink-0">
            <div
              className="w-[140px] h-[140px] rounded-full relative"
              style={{
                background: `conic-gradient(${genreData.map((g, i) => {
                  const startPct = genreData.slice(0, i).reduce((sum, x) => sum + x.pct, 0);
                  return `${g.color} ${startPct}% ${startPct + g.pct}%`;
                }).join(', ')})`,
                boxShadow: '0 0 0 3px #0a0a0a, 0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              {/* Center hole for donut chart effect */}
              <div className="absolute inset-[25%] rounded-full bg-gs-card flex items-center justify-center flex-col">
                <div className="text-[15px] font-extrabold text-gs-text">{genreData.length}</div>
                <div className="text-[8px] text-gs-dim font-mono">genres</div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            {genreData.map(g => (
              <div key={g.genre} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: g.color }} />
                <span className="text-xs text-gs-muted flex-1">{g.genre}</span>
                <span className="text-[11px] font-semibold font-mono" style={{ color: g.color }}>{g.pct}%</span>
                <span className="text-[10px] text-gs-faint font-mono w-8 text-right">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Share Listening Stats button */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-gs-text mb-0.5">Share Your Stats</div>
            <div className="text-[11px] text-gs-dim">Copy a summary of your listening stats to share</div>
          </div>
          <div className="relative">
            <button
              onClick={handleShareStats}
              className="gs-btn-gradient px-4 py-2 text-xs text-white flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Share
            </button>
            {shareMsg && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] text-gs-accent bg-[#111] border border-gs-border rounded px-2 py-1 whitespace-nowrap" style={{ animation: "vb-fade-in 0.15s ease-out" }}>
                {shareMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recently Played widget (embeddable preview) */}
      <div className="mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em]">Profile Widget Preview</div>
        <RecentlyPlayedWidget myListens={myListens} />
      </div>
    </div>
  );
}

// ============================================================================
// DEVICE CARD — device status with server polling
// ============================================================================
function DeviceCard({ currentUser, deviceCode, onDeactivate, isDemo }) {
  const [deviceInfo, setDeviceInfo] = useState(isDemo ? {
    totalHeartbeats: 1247,
    uptime: 86400,
    freeHeap: 142000,
    firstSeen: new Date(Date.now() - 30 * 86400000).toISOString(),
    lastSeen: new Date().toISOString(),
    rssi: -45,
  } : null);
  const [status, setStatus] = useState(isDemo ? "online" : "checking");
  const [showConfirm, setShowConfirm] = useState(false);

  // Firmware state
  const [firmwareVersion] = useState(isDemo ? "2.0.3" : "unknown");
  const [firmwareLatest] = useState("2.1.0");
  const firmwareUpdateAvailable = firmwareVersion !== firmwareLatest && firmwareVersion !== "unknown";

  // Calibration state
  const [gain, setGain] = useState(50);
  const [threshold, setThreshold] = useState(30);
  const [sampleRate, setSampleRate] = useState(16000);
  const [calibSaved, setCalibSaved] = useState(false);

  const handleSaveCalibration = useCallback(async () => {
    try {
      await fetch("http://localhost:3001/api/vinyl-buddy/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceCode, gain, threshold, sample_rate: sampleRate }),
      });
      setCalibSaved(true);
      setTimeout(() => setCalibSaved(false), 2000);
    } catch {
      // Silently fail for demo
      setCalibSaved(true);
      setTimeout(() => setCalibSaved(false), 2000);
    }
  }, [deviceCode, gain, threshold, sampleRate]);

  // Poll server for device status
  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/vinyl-buddy/devices/${currentUser}`);
        if (!res.ok) { setStatus("offline"); return; }
        const data = await res.json();
        if (cancelled) return;

        const device = (data.devices || []).find(d => d.deviceId === deviceCode);
        if (device) {
          setDeviceInfo(device);
          const age = Date.now() - new Date(device.lastSeen).getTime();
          setStatus(age < 60000 ? "online" : "offline");
        } else {
          setStatus("offline");
        }
      } catch {
        setStatus("offline");
      }
    };

    poll();
    const interval = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentUser, deviceCode, isDemo]);

  const statusColors = {
    online: { bg: "#22c55e11", border: "#22c55e33", text: "#22c55e", dot: "#22c55e", label: "Online" },
    offline: { bg: "#f59e0b11", border: "#f59e0b33", text: "#f59e0b", dot: "#f59e0b", label: "Offline" },
    checking: { bg: "#55555511", border: "#55555533", text: "#555", dot: "#555", label: "Checking..." },
  };
  const sc = statusColors[status];

  // Derived health values
  const memoryTotal = 320 * 1024; // ESP32 typical
  const freeHeap = deviceInfo?.freeHeap || 0;
  const memoryUsedPct = freeHeap > 0 ? ((memoryTotal - freeHeap) / memoryTotal) * 100 : 0;
  const uptimeHrs = deviceInfo?.uptime ? deviceInfo.uptime / 3600 : 0;
  const signalStrength = deviceInfo?.rssi ? Math.min(100, Math.max(0, 100 + (deviceInfo.rssi + 30) * 1.5)) : isDemo ? 82 : 0;

  return (
    <div>
      {/* Connection status banner */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
        <div className="relative">
          <div className="w-3 h-3 rounded-full" style={{
            background: sc.dot,
            animation: status === "online" ? "vb-pulse-dot 2s ease-in-out infinite" : "none",
            boxShadow: status === "online" ? `0 0 8px ${sc.dot}` : "none",
          }} />
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: sc.text }}>
            {status === "online" ? "Device Connected" : status === "checking" ? "Checking Connection..." : "Device Offline"}
          </div>
          <div className="text-[10px] text-gs-dim">
            {status === "online" ? "Vinyl Buddy is active and listening" : status === "checking" ? "Establishing connection..." : "No heartbeat received recently"}
          </div>
        </div>
      </div>

      {/* Device info card */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden mb-3">
        <div className="h-0.5" style={{ background: `linear-gradient(90deg,${sc.text},transparent)` }} />
        <div className="py-[18px] px-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-gs-accent to-gs-indigo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-bold text-gs-text">Vinyl Buddy</div>
                <div className="text-[11px] text-gs-dim font-mono">ESP32-DevKitC V4</div>
              </div>
            </div>
            {/* Status pill */}
            <div className="flex items-center gap-1.5 py-[5px] px-3 rounded-full" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: sc.dot,
                boxShadow: status === "online" ? `0 0 6px ${sc.dot}` : "none",
                animation: status === "online" ? "vb-pulse 2s ease-in-out infinite" : "none",
              }} />
              <span className="text-[11px] font-semibold" style={{ color: sc.text }}>{sc.label}</span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Device Code", value: deviceCode },
              { label: "Heartbeats", value: deviceInfo?.totalHeartbeats ?? "\u2014" },
              { label: "Uptime", value: fmtUptime(deviceInfo?.uptime) },
              { label: "Free Memory", value: deviceInfo?.freeHeap ? `${Math.round(deviceInfo.freeHeap / 1024)}KB` : "\u2014" },
              { label: "First Seen", value: deviceInfo?.firstSeen ? new Date(deviceInfo.firstSeen).toLocaleDateString() : "\u2014" },
              { label: "Last Seen", value: deviceInfo?.lastSeen ? relTime(new Date(deviceInfo.lastSeen).getTime()) : "\u2014" },
            ].map(item => (
              <div key={item.label} className="bg-[#111] rounded-lg py-2.5 px-3">
                <div className="text-[10px] text-gs-dim font-mono mb-1">{item.label}</div>
                <div className={`text-[13px] font-semibold text-[#ccc] ${item.label === "Device Code" ? "font-mono tracking-[0.06em]" : ""}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device Health section */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Device Health</div>
        <div className="flex flex-col gap-3">
          <ProgressBar
            value={memoryUsedPct}
            max={100}
            color={memoryUsedPct > 80 ? "#f87171" : memoryUsedPct > 60 ? "#f59e0b" : "#22c55e"}
            label="Memory Usage"
          />
          <ProgressBar
            value={Math.min(uptimeHrs, 168)}
            max={168}
            color="#0ea5e9"
            label={`Uptime (${fmtUptime(deviceInfo?.uptime)})`}
          />
        </div>

        {/* Signal and battery indicators */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="bg-[#111] rounded-lg py-2.5 px-3">
            <div className="text-[10px] text-gs-dim font-mono mb-1.5">WiFi Signal</div>
            <div className="flex items-center gap-2">
              <div className="flex items-end gap-0.5 h-4">
                {[1, 2, 3, 4].map(bar => (
                  <div key={bar} className="w-1 rounded-t-sm transition-all duration-300" style={{
                    height: `${bar * 25}%`,
                    background: signalStrength >= bar * 25 ? "#22c55e" : "#222",
                  }} />
                ))}
              </div>
              <span className="text-[11px] font-mono font-semibold" style={{ color: signalStrength > 60 ? "#22c55e" : signalStrength > 30 ? "#f59e0b" : "#f87171" }}>
                {signalStrength > 0 ? `${Math.round(signalStrength)}%` : "\u2014"}
              </span>
            </div>
          </div>

          <div className="bg-[#111] rounded-lg py-2.5 px-3">
            <div className="text-[10px] text-gs-dim font-mono mb-1.5">Power</div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <span className="text-[11px] font-mono font-semibold text-[#22c55e]">USB Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Firmware version display */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Firmware</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-gs-text font-mono">v{firmwareVersion}</div>
            <div className="text-[10px] text-gs-dim mt-0.5">Latest: v{firmwareLatest}</div>
          </div>
          {firmwareUpdateAvailable ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#f59e0b]" style={{ animation: "vb-pulse 2s ease-in-out infinite" }} />
              <div>
                <div className="text-[11px] text-[#f59e0b] font-bold">Update Available</div>
                <div className="text-[9px] text-gs-dim">Improved audio capture quality</div>
              </div>
              <Tooltip text="OTA updates coming soon">
                <button className="text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200">
                  Update
                </button>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span className="text-[11px] text-[#22c55e] font-semibold">Up to date</span>
            </div>
          )}
        </div>
      </div>

      {/* Calibration section */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Calibration</div>
        <div className="flex flex-col gap-4">
          {/* Gain slider */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-gs-muted">Microphone Gain</span>
              <span className="text-[11px] font-semibold text-gs-accent font-mono">{gain}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={gain}
              onChange={e => setGain(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-[#222] outline-none cursor-pointer"
              style={{ accentColor: "#0ea5e9" }}
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gs-faint">Quiet</span>
              <span className="text-[9px] text-gs-faint">Loud</span>
            </div>
          </div>
          {/* Threshold slider */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-gs-muted">Detection Threshold</span>
              <span className="text-[11px] font-semibold text-[#8b5cf6] font-mono">{threshold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-[#222] outline-none cursor-pointer"
              style={{ accentColor: "#8b5cf6" }}
            />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gs-faint">Sensitive</span>
              <span className="text-[9px] text-gs-faint">Strict</span>
            </div>
          </div>
          {/* Sample Rate select */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[11px] text-gs-muted">Sample Rate</span>
              <span className="text-[11px] font-semibold text-[#22c55e] font-mono">{(sampleRate / 1000).toFixed(0)}kHz</span>
            </div>
            <div className="flex gap-1.5">
              {[8000, 16000, 22050, 44100].map(rate => (
                <button
                  key={rate}
                  onClick={() => setSampleRate(rate)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-mono cursor-pointer transition-all duration-200 border ${
                    sampleRate === rate
                      ? "bg-[#22c55e11] border-[#22c55e33] text-[#22c55e] font-bold"
                      : "bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]"
                  }`}
                >
                  {(rate / 1000).toFixed(rate === 22050 ? 1 : 0)}k
                </button>
              ))}
            </div>
          </div>
          {/* Save button */}
          <div className="relative">
            <button
              onClick={handleSaveCalibration}
              className="gs-btn-gradient py-2 px-5 text-xs text-white"
            >
              Save Calibration
            </button>
            {calibSaved && (
              <span className="ml-3 text-[10px] text-[#22c55e] font-semibold" style={{ animation: "vb-fade-in 0.15s ease-out" }}>
                Saved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <SetupGuide />

      {/* Server connection hint */}
      {status === "offline" && (
        <div className="rounded-[10px] py-3 px-3.5 mb-3 bg-[#f59e0b08] border border-[#f59e0b22]">
          <div className="text-xs font-semibold text-[#f59e0b] mb-1">Troubleshooting</div>
          <div className="text-[11px] text-gs-muted leading-normal">
            Make sure your Vinyl Buddy is powered on and connected to the same WiFi network. The server should be running on port 3001.
          </div>
        </div>
      )}

      {/* Reset device */}
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4">
        <div className="text-[13px] font-bold text-gs-text mb-1">Reset Device</div>
        <p className="text-[11px] text-[#666] mb-3 leading-normal">
          Remove this Vinyl Buddy from your account. Your listening history will be preserved, but you'll need to re-enter the device code to reconnect.
        </p>
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} className="gs-btn-secondary py-[9px] px-[18px] rounded-lg text-red-500 text-xs min-h-[36px]">
            Reset Device
          </button>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-red-500 font-semibold">Are you sure?</span>
            <button onClick={() => { setShowConfirm(false); onDeactivate(); }} className="py-2 px-4 bg-red-500 border-none rounded-lg text-white font-bold text-xs cursor-pointer min-h-[36px]">
              Yes, Reset
            </button>
            <button onClick={() => setShowConfirm(false)} className="gs-btn-secondary py-2 px-4 rounded-lg text-xs min-h-[36px]">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
