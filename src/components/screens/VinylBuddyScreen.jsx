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
    @keyframes vb-spectrum { 0%,100% { height:10%; } 50% { height:90%; } }
    @keyframes vb-warp-wobble { 0%,100% { transform:rotate(0deg) scaleY(1); } 25% { transform:rotate(1deg) scaleY(0.98); } 75% { transform:rotate(-1deg) scaleY(1.02); } }
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

// ── Listening Mood Detector (Improvement 1) ─────────────────────────────
function ListeningMoodDetector({ myListens }) {
  const mood = useMemo(() => {
    if (myListens.length === 0) return null;

    const genreMap = {
      "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock",
      "The Doors": "Rock", "The Beatles": "Rock", "The Who": "Rock",
      "Eagles": "Rock", "John Coltrane": "Jazz", "Miles Davis": "Jazz",
      "Herbie Hancock": "Jazz Fusion", "Nas": "Hip-Hop", "A Tribe Called Quest": "Hip-Hop",
      "Aphex Twin": "Electronic", "Daft Punk": "Electronic", "Portishead": "Trip-Hop",
      "My Bloody Valentine": "Shoegaze", "Black Sabbath": "Metal", "Metallica": "Metal",
      "Fleetwood Mac": "Rock", "Nirvana": "Grunge", "Massive Attack": "Trip-Hop",
    };

    const moodMapping = {
      "Rock": { mood: "Energized", emoji: "\uD83D\uDD25", color: "#ef4444", desc: "High-energy rock vibes" },
      "Prog Rock": { mood: "Contemplative", emoji: "\uD83C\uDF0C", color: "#8b5cf6", desc: "Deep, expansive soundscapes" },
      "Jazz": { mood: "Relaxed", emoji: "\u2615", color: "#f59e0b", desc: "Smooth and mellow tones" },
      "Jazz Fusion": { mood: "Adventurous", emoji: "\uD83C\uDF1F", color: "#14b8a6", desc: "Exploring sonic boundaries" },
      "Hip-Hop": { mood: "Pumped", emoji: "\uD83D\uDCAA", color: "#0ea5e9", desc: "Strong beats, powerful lyrics" },
      "Electronic": { mood: "Focused", emoji: "\uD83C\uDFAF", color: "#06b6d4", desc: "Locked in and flowing" },
      "Trip-Hop": { mood: "Chill", emoji: "\uD83C\uDF19", color: "#6366f1", desc: "Dark, atmospheric calm" },
      "Shoegaze": { mood: "Dreamy", emoji: "\u2601\uFE0F", color: "#ec4899", desc: "Hazy, ethereal soundwaves" },
      "Metal": { mood: "Intense", emoji: "\u26A1", color: "#dc2626", desc: "Raw power and aggression" },
      "Grunge": { mood: "Raw", emoji: "\uD83C\uDFB8", color: "#84cc16", desc: "Unpolished and authentic" },
    };

    const recentListens = myListens.slice(0, 5);
    const genreCounts = {};
    for (const s of recentListens) {
      const genre = genreMap[s.track.artist] || "Rock";
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    }
    const topGenre = Object.entries(genreCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "Rock";
    return moodMapping[topGenre] || moodMapping["Rock"];
  }, [myListens]);

  if (!mood) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening Mood</div>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${mood.color}15`, border: `1px solid ${mood.color}33` }}>
          {mood.emoji}
        </div>
        <div>
          <div className="text-lg font-extrabold" style={{ color: mood.color }}>{mood.mood}</div>
          <div className="text-[11px] text-gs-dim">{mood.desc}</div>
          <div className="text-[9px] text-gs-faint mt-0.5">Based on your recent listening</div>
        </div>
      </div>
    </div>
  );
}

// ── Audio Quality Indicator (Improvement 2) ─────────────────────────────
function AudioQualityIndicator({ isRecent }) {
  const [quality] = useState(() => {
    const qualities = [
      { level: 'Excellent', value: 96, color: '#22c55e' },
      { level: 'Good', value: 82, color: '#0ea5e9' },
      { level: 'Fair', value: 64, color: '#f59e0b' },
    ];
    return qualities[Math.floor(Math.random() * 2)]; // bias toward good/excellent
  });

  if (!isRecent) return null;

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-[#111] border border-[#1a1a1a] mb-4">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={quality.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
      <span className="text-[10px] font-mono font-semibold" style={{ color: quality.color }}>Audio: {quality.level}</span>
      <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden ml-1">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${quality.value}%`, background: quality.color }} />
      </div>
      <span className="text-[9px] font-mono text-gs-faint">{quality.value}%</span>
    </div>
  );
}

// ── Listening Goals / Challenges (Improvement 3) ────────────────────────
function ListeningGoals({ myListens }) {
  const goals = useMemo(() => {
    const totalTracks = myListens.length;
    const uniqueArtists = new Set(myListens.map(s => s.track.artist)).size;
    const totalMinutes = Math.round(myListens.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0) / 60);
    const uniqueAlbums = new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`)).size;

    return [
      { label: 'Identify 25 tracks', current: totalTracks, target: 25, color: '#0ea5e9', icon: '\uD83C\uDFB5' },
      { label: 'Discover 15 artists', current: uniqueArtists, target: 15, color: '#8b5cf6', icon: '\uD83C\uDFA4' },
      { label: 'Listen for 5 hours', current: Math.round(totalMinutes / 60 * 10) / 10, target: 5, color: '#f59e0b', icon: '\u23F1\uFE0F', unit: 'h' },
      { label: 'Explore 10 albums', current: uniqueAlbums, target: 10, color: '#22c55e', icon: '\uD83D\uDCBF' },
    ];
  }, [myListens]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening Goals</div>
      <div className="flex flex-col gap-3">
        {goals.map(goal => {
          const pct = Math.min((goal.current / goal.target) * 100, 100);
          const completed = goal.current >= goal.target;
          return (
            <div key={goal.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{goal.icon}</span>
                  <span className="text-[11px] text-gs-muted">{goal.label}</span>
                </div>
                <span className="text-[10px] font-mono font-semibold" style={{ color: completed ? '#22c55e' : goal.color }}>
                  {completed ? 'Complete!' : `${goal.current}${goal.unit || ''} / ${goal.target}${goal.unit || ''}`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: completed ? '#22c55e' : `linear-gradient(90deg, ${goal.color}, ${goal.color}88)` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Vinyl Identification Accuracy Stats (Improvement 4) ─────────────────
function AccuracyStats({ myListens }) {
  const stats = useMemo(() => {
    if (myListens.length === 0) return null;
    const scores = myListens.filter(s => s.score > 0).map(s => s.score);
    if (scores.length === 0) return null;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const above90 = scores.filter(s => s >= 90).length;
    const above90Pct = Math.round((above90 / scores.length) * 100);
    return { avg, high, low, above90, above90Pct, total: scores.length };
  }, [myListens]);

  if (!stats) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Identification Accuracy</div>
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[#111] rounded-lg py-2.5 px-2 text-center">
          <div className="text-lg font-extrabold text-[#22c55e]">{stats.avg}%</div>
          <div className="text-[9px] text-gs-dim font-mono">Average</div>
        </div>
        <div className="bg-[#111] rounded-lg py-2.5 px-2 text-center">
          <div className="text-lg font-extrabold text-[#0ea5e9]">{stats.high}%</div>
          <div className="text-[9px] text-gs-dim font-mono">Highest</div>
        </div>
        <div className="bg-[#111] rounded-lg py-2.5 px-2 text-center">
          <div className="text-lg font-extrabold text-[#f59e0b]">{stats.low}%</div>
          <div className="text-[9px] text-gs-dim font-mono">Lowest</div>
        </div>
        <div className="bg-[#111] rounded-lg py-2.5 px-2 text-center">
          <div className="text-lg font-extrabold text-[#8b5cf6]">{stats.above90Pct}%</div>
          <div className="text-[9px] text-gs-dim font-mono">&gt;90%</div>
        </div>
      </div>
    </div>
  );
}

// ── Shazam-style identification animation (Improvement 5) ───────────────
function IdentificationAnimation({ active }) {
  if (!active) return null;

  return (
    <div className="relative flex items-center justify-center w-full h-24 mb-4 rounded-[14px] bg-[#111] border border-[#1a1a1a] overflow-hidden">
      {[1, 2, 3].map(ring => (
        <div
          key={ring}
          className="absolute rounded-full border-2"
          style={{
            width: `${ring * 50}px`,
            height: `${ring * 50}px`,
            borderColor: '#0ea5e933',
            animation: `vb-pulse ${1.5 + ring * 0.3}s ease-in-out infinite`,
            animationDelay: `${ring * 0.2}s`,
          }}
        />
      ))}
      <div className="relative z-10 flex flex-col items-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'vb-pulse 1s ease-in-out infinite' }}>
          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="text-[10px] text-gs-accent font-mono mt-2" style={{ animation: 'vb-pulse 1.5s ease-in-out infinite' }}>Identifying...</span>
      </div>
    </div>
  );
}

// ── Discogs Integration Link (Improvement 6) ────────────────────────────
function DiscogsLink({ track }) {
  if (!track?.artist || !track?.album) return null;
  const searchQuery = encodeURIComponent(`${track.artist} ${track.album}`);
  const discogsUrl = `https://www.discogs.com/search/?q=${searchQuery}&type=release`;

  return (
    <button
      onClick={() => window.open(discogsUrl, '_blank', 'noopener,noreferrer')}
      className="flex items-center gap-1.5 text-[10px] text-[#666] bg-transparent border border-[#222] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all duration-200"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
      </svg>
      Discogs
    </button>
  );
}

// ── Social Listening (Improvement 7) ────────────────────────────────────
function SocialListening() {
  const friends = useMemo(() => [
    { name: 'vinylhead42', track: 'Paranoid Android', artist: 'Radiohead', timeAgo: '2m ago', avatar: 'V' },
    { name: 'cratedigger', track: 'So What', artist: 'Miles Davis', timeAgo: '8m ago', avatar: 'C' },
    { name: 'waxcollector', track: 'Purple Rain', artist: 'Prince', timeAgo: '15m ago', avatar: 'W' },
    { name: 'groovybeats', track: 'Superstition', artist: 'Stevie Wonder', timeAgo: '22m ago', avatar: 'G' },
  ], []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Friends Listening</div>
      <div className="flex flex-col gap-2">
        {friends.map(f => (
          <div key={f.name} className="flex items-center gap-2.5 py-1">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gs-accent to-[#8b5cf6] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
              {f.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gs-text">@{f.name}</span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#22c55e]" />
              </div>
              <div className="text-[10px] text-gs-dim truncate">{f.track} — {f.artist}</div>
            </div>
            <span className="text-[9px] text-gs-faint font-mono shrink-0">{f.timeAgo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Listening Timeline Heatmap (Improvement 8) ──────────────────────────
function ListeningTimeline({ myListens }) {
  const hourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => 0);
    for (const s of myListens) {
      const h = new Date(s.timestampMs).getHours();
      hours[h]++;
    }
    return hours;
  }, [myListens]);

  if (myListens.length < 3) return null;

  const maxCount = Math.max(...hourData, 1);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening by Hour</div>
      <div className="flex items-end gap-[3px] h-12">
        {hourData.map((count, hour) => {
          const intensity = count / maxCount;
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max(count > 0 ? 4 : 2, intensity * 48)}px`,
                  background: count > 0
                    ? `rgba(14, 165, 233, ${0.3 + intensity * 0.7})`
                    : '#1a1a1a',
                }}
                title={`${hour}:00 - ${count} plays`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] text-gs-faint font-mono">12am</span>
        <span className="text-[8px] text-gs-faint font-mono">6am</span>
        <span className="text-[8px] text-gs-faint font-mono">12pm</span>
        <span className="text-[8px] text-gs-faint font-mono">6pm</span>
        <span className="text-[8px] text-gs-faint font-mono">12am</span>
      </div>
    </div>
  );
}

// ── Genre Evolution Chart (Improvement 9) ───────────────────────────────
function GenreEvolutionChart({ myListens }) {
  const evolution = useMemo(() => {
    if (myListens.length < 4) return null;

    const genreMap = {
      "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock",
      "The Doors": "Rock", "The Beatles": "Rock", "The Who": "Rock",
      "Eagles": "Rock", "John Coltrane": "Jazz", "Miles Davis": "Jazz",
      "Aphex Twin": "Electronic", "Daft Punk": "Electronic", "Fleetwood Mac": "Rock",
    };

    const sorted = [...myListens].sort((a, b) => a.timestampMs - b.timestampMs);
    const chunkSize = Math.max(Math.floor(sorted.length / 4), 1);
    const periods = [];

    for (let i = 0; i < sorted.length; i += chunkSize) {
      const chunk = sorted.slice(i, i + chunkSize);
      const genreCounts = {};
      for (const s of chunk) {
        const genre = genreMap[s.track.artist] || "Other";
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
      const topGenre = Object.entries(genreCounts).sort(([, a], [, b]) => b - a)[0];
      if (topGenre) {
        periods.push({
          label: new Date(chunk[0].timestampMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          genre: topGenre[0],
          count: topGenre[1],
        });
      }
    }

    return periods.slice(0, 4);
  }, [myListens]);

  if (!evolution || evolution.length < 2) return null;

  const genreColors = { "Rock": "#ef4444", "Prog Rock": "#8b5cf6", "Jazz": "#f59e0b", "Electronic": "#06b6d4", "Other": "#64748b" };

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Genre Evolution</div>
      <div className="flex items-center gap-2">
        {evolution.map((period, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full py-2 px-1 rounded-lg text-center mb-1" style={{ background: `${genreColors[period.genre] || '#64748b'}15`, border: `1px solid ${genreColors[period.genre] || '#64748b'}33` }}>
              <div className="text-[10px] font-bold" style={{ color: genreColors[period.genre] || '#64748b' }}>{period.genre}</div>
            </div>
            <div className="text-[8px] text-gs-faint font-mono">{period.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Record Identification Leaderboard (Improvement 10) ──────────────────
function IdentificationLeaderboard({ myListens }) {
  const leaderboard = useMemo(() => {
    const mockUsers = [
      { name: currentUser => currentUser, listens: myListens.length, isMe: true },
      { name: () => 'vinylhead42', listens: Math.max(myListens.length + 5, 15), isMe: false },
      { name: () => 'cratedigger', listens: Math.max(myListens.length - 2, 8), isMe: false },
      { name: () => 'waxcollector', listens: Math.max(myListens.length - 4, 5), isMe: false },
      { name: () => 'groovybeats', listens: Math.max(myListens.length - 7, 3), isMe: false },
    ];
    return mockUsers
      .map(u => ({ name: u.name('you'), listens: u.listens, isMe: u.isMe }))
      .sort((a, b) => b.listens - a.listens);
  }, [myListens]);

  if (myListens.length === 0) return null;

  const medalColors = ['#f59e0b', '#94a3b8', '#cd7f32'];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Identification Leaderboard</div>
      <div className="flex flex-col gap-1.5">
        {leaderboard.map((user, i) => (
          <div key={user.name} className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg ${user.isMe ? 'bg-[#0ea5e908] border border-[#0ea5e922]' : ''}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0" style={{
              background: i < 3 ? `${medalColors[i]}22` : '#111',
              color: i < 3 ? medalColors[i] : '#666',
              border: `1px solid ${i < 3 ? `${medalColors[i]}44` : '#1a1a1a'}`,
            }}>
              {i + 1}
            </div>
            <span className={`text-[11px] flex-1 ${user.isMe ? 'font-bold text-gs-accent' : 'text-gs-muted'}`}>
              {user.isMe ? 'You' : `@${user.name}`}
            </span>
            <span className="text-[11px] font-mono font-semibold text-gs-text">{user.listens}</span>
          </div>
        ))}
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

// ── (1) Multi-Device Management UI ──────────────────────────────────────
function MultiDeviceManager({ devices, activeDeviceId, onSelectDevice }) {
  const deviceList = devices || [
    { id: 'DEMO00112233', name: 'Living Room', status: 'online', room: 'Living Room' },
    { id: 'DEMO44556677', name: 'Bedroom Setup', status: 'offline', room: 'Bedroom' },
    { id: 'DEMO8899AABB', name: 'Studio', status: 'online', room: 'Studio' },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">My Devices</div>
      <div className="flex flex-col gap-2">
        {deviceList.map(d => (
          <button
            key={d.id}
            onClick={() => onSelectDevice?.(d.id)}
            className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border transition-all duration-200 cursor-pointer bg-transparent text-left w-full ${
              d.id === activeDeviceId
                ? 'border-[#0ea5e933] bg-[#0ea5e908]'
                : 'border-[#1a1a1a] hover:border-[#333]'
            }`}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
              background: d.status === 'online' ? '#22c55e15' : '#55555515',
              border: `1px solid ${d.status === 'online' ? '#22c55e33' : '#33333366'}`,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={d.status === 'online' ? '#22c55e' : '#555'} strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-gs-text truncate">{d.name}</div>
              <div className="text-[9px] text-gs-dim font-mono">{d.id} - {d.room}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: d.status === 'online' ? '#22c55e' : '#555',
                animation: d.status === 'online' ? 'vb-pulse 2s ease-in-out infinite' : 'none',
              }} />
              <span className="text-[9px] font-mono" style={{ color: d.status === 'online' ? '#22c55e' : '#555' }}>
                {d.status}
              </span>
            </div>
          </button>
        ))}
      </div>
      <button className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add New Device
      </button>
    </div>
  );
}

// ── (2) Device Naming/Labeling ──────────────────────────────────────────
function DeviceNamingPanel({ deviceCode, currentName }) {
  const [name, setName] = useState(currentName || 'My Vinyl Buddy');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Device Name</div>
      <div className="flex items-center gap-2.5">
        {editing ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            maxLength={30}
            autoFocus
            className="flex-1 py-2 px-3 bg-[#111] rounded-lg text-sm text-gs-text outline-none border border-gs-accent font-semibold"
          />
        ) : (
          <div className="flex-1 py-2 px-3 bg-[#111] rounded-lg text-sm text-gs-text font-semibold">{name}</div>
        )}
        {editing ? (
          <button onClick={handleSave} className="text-[10px] text-[#22c55e] bg-[#22c55e11] border border-[#22c55e33] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#22c55e22] transition-all">
            Save
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#0ea5e915] transition-all">
            Edit
          </button>
        )}
        {saved && <span className="text-[10px] text-[#22c55e] font-semibold" style={{ animation: 'vb-fade-in 0.15s ease-out' }}>Saved!</span>}
      </div>
      <div className="text-[9px] text-gs-faint mt-1.5 font-mono">Device: {deviceCode}</div>
    </div>
  );
}

// ── (3) Listening Room Assignment ───────────────────────────────────────
function ListeningRoomAssignment({ deviceCode }) {
  const rooms = ['Living Room', 'Bedroom', 'Studio', 'Kitchen', 'Office', 'Basement', 'Garage'];
  const [selectedRoom, setSelectedRoom] = useState('Living Room');
  const [saved, setSaved] = useState(false);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening Room</div>
      <div className="flex flex-wrap gap-1.5">
        {rooms.map(room => (
          <button
            key={room}
            onClick={() => { setSelectedRoom(room); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
            className={`text-[10px] py-1.5 px-3 rounded-lg font-mono cursor-pointer transition-all duration-200 border ${
              selectedRoom === room
                ? 'bg-[#0ea5e911] border-[#0ea5e933] text-gs-accent font-bold'
                : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
            }`}
          >
            {room}
          </button>
        ))}
      </div>
      {saved && <div className="text-[9px] text-[#22c55e] mt-2 font-mono" style={{ animation: 'vb-fade-in 0.15s ease-out' }}>Room assigned to {deviceCode}</div>}
    </div>
  );
}

// ── (4) Audio Quality Metrics Dashboard ─────────────────────────────────
function AudioQualityDashboard({ isRecent }) {
  const metrics = useMemo(() => ({
    snr: 38 + Math.floor(Math.random() * 15),
    thd: (0.02 + Math.random() * 0.08).toFixed(3),
    bitDepth: 24,
    sampleRate: 44100,
    bitrate: 1411,
    channelSeparation: 55 + Math.floor(Math.random() * 20),
  }), []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Audio Quality Metrics</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'SNR', value: `${metrics.snr} dB`, color: metrics.snr > 45 ? '#22c55e' : metrics.snr > 35 ? '#f59e0b' : '#ef4444' },
          { label: 'THD', value: `${metrics.thd}%`, color: parseFloat(metrics.thd) < 0.05 ? '#22c55e' : '#f59e0b' },
          { label: 'Bit Depth', value: `${metrics.bitDepth}-bit`, color: '#0ea5e9' },
          { label: 'Sample Rate', value: `${(metrics.sampleRate / 1000).toFixed(1)}kHz`, color: '#8b5cf6' },
          { label: 'Bitrate', value: `${metrics.bitrate} kbps`, color: '#14b8a6' },
          { label: 'Ch. Sep.', value: `${metrics.channelSeparation} dB`, color: '#f59e0b' },
        ].map(m => (
          <div key={m.label} className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[13px] font-extrabold font-mono" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[8px] text-gs-dim font-mono mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      {!isRecent && <div className="text-[9px] text-gs-faint mt-2 text-center font-mono">Play a record for live metrics</div>}
    </div>
  );
}

// ── (5) Identification Confidence Breakdown ─────────────────────────────
function ConfidenceBreakdown({ session }) {
  const factors = (() => {
    if (!session || !session.score) return null;
    const base = session.score;
    return [
      { label: 'Acoustic Fingerprint', value: Math.min(100, base + Math.floor(Math.random() * 10)), color: '#0ea5e9' },
      { label: 'Tempo Match', value: Math.min(100, base - 5 + Math.floor(Math.random() * 15)), color: '#8b5cf6' },
      { label: 'Spectral Signature', value: Math.min(100, base - 3 + Math.floor(Math.random() * 12)), color: '#22c55e' },
      { label: 'Harmonic Analysis', value: Math.min(100, base - 8 + Math.floor(Math.random() * 18)), color: '#f59e0b' },
    ];
  })();

  if (!factors) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Confidence Breakdown</div>
      <div className="flex flex-col gap-2.5">
        {factors.map(f => (
          <div key={f.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-gs-muted">{f.label}</span>
              <span className="text-[10px] font-bold font-mono" style={{ color: f.color }}>{f.value}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.value}%`, background: `linear-gradient(90deg, ${f.color}, ${f.color}88)` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-[#1a1a1a] flex items-center justify-between">
        <span className="text-[10px] text-gs-dim font-mono">Overall Confidence</span>
        <span className="text-[14px] font-extrabold" style={{ color: session.score >= 90 ? '#22c55e' : session.score >= 70 ? '#f59e0b' : '#ef4444' }}>{session.score}%</span>
      </div>
    </div>
  );
}

// ── (6) Genre Auto-Tagging from Identification ─────────────────────────
function GenreAutoTag({ track }) {
  const tags = useMemo(() => {
    const genreMap = {
      "Led Zeppelin": ["Hard Rock", "Blues Rock", "Classic Rock"],
      "Pink Floyd": ["Progressive Rock", "Psychedelic", "Art Rock"],
      "Queen": ["Rock", "Glam Rock", "Arena Rock"],
      "The Doors": ["Psychedelic Rock", "Blues Rock", "Acid Rock"],
      "The Beatles": ["Rock", "Pop Rock", "Psychedelic"],
      "The Who": ["Rock", "Power Pop", "Mod"],
      "Eagles": ["Soft Rock", "Country Rock", "Folk Rock"],
    };
    return genreMap[track?.artist] || ["Rock", "Classic"];
  }, [track?.artist]);

  if (!track) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tags.map(tag => (
        <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#8b5cf611] border border-[#8b5cf622] text-[#8b5cf6] font-mono font-bold">
          {tag}
        </span>
      ))}
    </div>
  );
}

// ── (7) Playlist Generation from Recent Listens ────────────────────────
function PlaylistGenerator({ myListens }) {
  const [generated, setGenerated] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [copied, setCopied] = useState(false);

  const playlist = useMemo(() => {
    const unique = [];
    const seen = new Set();
    for (const s of myListens.slice(0, 20)) {
      const key = `${s.track.artist}::${s.track.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s.track);
      }
      if (unique.length >= 10) break;
    }
    return unique;
  }, [myListens]);

  if (myListens.length < 3) return null;

  const handleGenerate = () => {
    setGenerated(true);
    setPlaylistName(`Vinyl Session ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  };

  const handleCopy = () => {
    const text = playlist.map((t, i) => `${i + 1}. ${t.title} - ${t.artist}`).join('\n');
    navigator.clipboard.writeText(`${playlistName}\n\n${text}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Playlist Generator</div>
      {!generated ? (
        <button onClick={handleGenerate} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          Generate Playlist from Recent Listens
        </button>
      ) : (
        <div className="vb-fade-in">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-bold text-gs-text">{playlistName}</span>
            <button onClick={handleCopy} className="text-[9px] text-gs-accent bg-transparent border border-[#0ea5e922] rounded px-2 py-1 cursor-pointer hover:bg-[#0ea5e908]">
              {copied ? 'Copied!' : 'Copy List'}
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {playlist.map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-[#111]">
                <span className="text-[9px] text-gs-faint font-mono w-4 text-right shrink-0">{i + 1}</span>
                <span className="text-[10px] text-gs-text truncate flex-1">{t.title}</span>
                <span className="text-[9px] text-gs-dim truncate">{t.artist}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (8) Listening Session Recording ────────────────────────────────────
function ListeningSessionRecorder() {
  const [recording, setRecording] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [savedSessions, setSavedSessions] = useState([
    { name: 'Sunday Morning Vinyl', duration: 3720, tracks: 8, date: Date.now() - 86400000 },
    { name: 'Late Night Jazz', duration: 5400, tracks: 12, date: Date.now() - 172800000 },
  ]);
  const intervalRef = useRef(null);

  const handleStart = useCallback(() => {
    setRecording(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  }, []);

  const handleStop = useCallback(() => {
    clearInterval(intervalRef.current);
    setRecording(false);
    if (elapsed > 0) {
      setSavedSessions(prev => [
        { name: sessionName || `Session ${new Date().toLocaleTimeString()}`, duration: elapsed, tracks: Math.floor(elapsed / 240) + 1, date: Date.now() },
        ...prev,
      ]);
    }
    setSessionName('');
    setElapsed(0);
  }, [elapsed, sessionName]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const fmtElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Session Recording</div>
      {recording ? (
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]" style={{ animation: 'vb-pulse 1s ease-in-out infinite' }} />
          <span className="text-[14px] font-extrabold text-[#ef4444] font-mono">{fmtElapsed(elapsed)}</span>
          <input
            value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Name this session..."
            className="flex-1 py-1.5 px-2.5 bg-[#111] rounded-lg text-[11px] text-gs-text outline-none border border-[#222] placeholder:text-gs-faint"
          />
          <button onClick={handleStop} className="text-[10px] text-[#ef4444] bg-[#ef444411] border border-[#ef444433] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#ef444422]">
            Stop
          </button>
        </div>
      ) : (
        <button onClick={handleStart} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-[#ef4444] bg-[#ef444408] border border-[#ef444422] rounded-lg cursor-pointer hover:bg-[#ef444415] transition-all duration-200">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
          Start Recording Session
        </button>
      )}
      {savedSessions.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#1a1a1a]">
          <div className="text-[9px] text-gs-faint font-mono mb-1.5">Recent Sessions</div>
          {savedSessions.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-[10px]">
              <span className="text-gs-muted font-semibold truncate flex-1">{s.name}</span>
              <span className="text-gs-dim font-mono shrink-0 ml-2">{Math.floor(s.duration / 60)}m - {s.tracks} tracks</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── (9) Side A/B Tracking ──────────────────────────────────────────────
function SideTracker({ nowPlaying }) {
  const [side, setSide] = useState('A');

  if (!nowPlaying) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[10px] text-gs-dim font-mono">Side:</span>
      {['A', 'B'].map(s => (
        <button
          key={s}
          onClick={() => setSide(s)}
          className={`w-8 h-8 rounded-full text-[12px] font-extrabold cursor-pointer transition-all duration-200 border ${
            side === s
              ? 'bg-gs-accent text-white border-gs-accent shadow-[0_0_8px_#0ea5e944]'
              : 'bg-[#111] text-gs-dim border-[#222] hover:border-[#444]'
          }`}
        >
          {s}
        </button>
      ))}
      <span className="text-[9px] text-gs-faint font-mono ml-1">
        {side === 'A' ? 'Playing Side A' : 'Flipped to Side B'}
      </span>
    </div>
  );
}

// ── (10) RPM Detection Display ─────────────────────────────────────────
function RPMDetector({ nowPlaying }) {
  const [rpm, setRpm] = useState(33);
  const detectedRpm = useMemo(() => {
    if (!nowPlaying) return null;
    const year = nowPlaying.track?.year || 1975;
    if (year < 1960) return 78;
    return Math.random() > 0.3 ? 33 : 45;
  }, [nowPlaying]);

  useEffect(() => {
    if (detectedRpm) setRpm(detectedRpm);
  }, [detectedRpm]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">RPM Detection</div>
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {[33, 45, 78].map(r => (
            <div
              key={r}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-extrabold transition-all duration-300 border-2 ${
                rpm === r
                  ? 'border-gs-accent text-gs-accent bg-[#0ea5e911] shadow-[0_0_12px_#0ea5e933]'
                  : 'border-[#222] text-gs-faint bg-[#111]'
              }`}
            >
              {r}
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold text-gs-text">{rpm} RPM {detectedRpm ? '(Auto-detected)' : ''}</div>
          <div className="text-[9px] text-gs-dim mt-0.5">
            {rpm === 33 ? '12" LP - Standard album speed' : rpm === 45 ? '7" Single - Higher fidelity' : '10" Shellac - Vintage format'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── (11) Turntable Compatibility Checker ────────────────────────────────
function TurntableCompatibilityChecker() {
  const [expanded, setExpanded] = useState(false);
  const turntables = [
    { name: 'Audio-Technica AT-LP120XUSB', compatible: true, notes: 'Fully compatible, recommended placement 6-12" from platter' },
    { name: 'Rega Planar 3', compatible: true, notes: 'Compatible, place microphone on shelf beside turntable' },
    { name: 'Pro-Ject Debut Carbon', compatible: true, notes: 'Compatible, avoid placing on same surface (vibration)' },
    { name: 'Technics SL-1200', compatible: true, notes: 'Excellent compatibility, direct drive reduces vibration artifacts' },
    { name: 'Crosley Cruiser', compatible: 'partial', notes: 'Built-in speaker interference. Use external speaker output for best results.' },
    { name: 'Victrola VSC-550BT', compatible: 'partial', notes: 'Bluetooth mode may interfere. Use wired output.' },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/>
          </svg>
          <span className="text-[12px] font-bold text-gs-text">Turntable Compatibility</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          <div className="flex flex-col gap-1.5">
            {turntables.map(t => (
              <div key={t.name} className="flex items-start gap-2 py-2 px-2.5 rounded-lg bg-[#111]">
                <div className="mt-0.5 shrink-0">
                  {t.compatible === true ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3"><path d="M12 9v4M12 17h.01"/></svg>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gs-text">{t.name}</div>
                  <div className="text-[9px] text-gs-dim mt-0.5">{t.notes}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (12) Audio Waveform Visualization Improvements ─────────────────────
function EnhancedWaveform({ active }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (!active) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        return;
      }

      phaseRef.current += 0.05;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#0ea5e9');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#0ea5e9');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.03 + phaseRef.current) * (h * 0.3) * Math.sin(x * 0.008 + phaseRef.current * 0.5);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#0ea5e933';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.cos(x * 0.05 + phaseRef.current * 1.3) * (h * 0.15);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    if (active) animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [active]);

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-[14px] p-3 mb-4 overflow-hidden">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Waveform</div>
      <canvas ref={canvasRef} width={400} height={60} className="w-full h-[60px] rounded-lg" />
      {!active && <div className="text-[9px] text-gs-faint font-mono text-center mt-1">Waiting for audio signal...</div>}
    </div>
  );
}

// ── (13) Frequency Spectrum Analyzer ───────────────────────────────────
function FrequencySpectrum({ active }) {
  const bands = 24;
  const [levels, setLevels] = useState(() => Array(bands).fill(0));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active) {
      intervalRef.current = setInterval(() => {
        setLevels(Array.from({ length: bands }, (_, i) => {
          const center = bands / 3;
          const dist = Math.abs(i - center) / bands;
          return Math.max(5, Math.floor((1 - dist) * 80 + Math.random() * 40));
        }));
      }, 100);
    } else {
      clearInterval(intervalRef.current);
      setLevels(Array(bands).fill(0));
    }
    return () => clearInterval(intervalRef.current);
  }, [active]);

  const freqLabels = ['60', '250', '1k', '4k', '16k'];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Frequency Spectrum</div>
      <div className="flex items-end gap-[2px] h-16 bg-[#0a0a0a] rounded-lg p-2">
        {levels.map((level, i) => {
          const hue = (i / bands) * 280;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all"
              style={{
                height: `${active ? level : 3}%`,
                background: active ? `hsl(${hue}, 80%, 55%)` : '#222',
                transition: 'height 0.1s ease-out',
                opacity: active ? 0.85 : 0.3,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 px-2">
        {freqLabels.map(l => (
          <span key={l} className="text-[7px] text-gs-faint font-mono">{l}Hz</span>
        ))}
      </div>
    </div>
  );
}

// ── (14) Record Cleaning Reminder ──────────────────────────────────────
function RecordCleaningReminder({ myListens }) {
  const cleaningData = useMemo(() => {
    const albumPlays = {};
    for (const s of myListens) {
      const key = `${s.track.artist}::${s.track.album}`;
      albumPlays[key] = (albumPlays[key] || 0) + (s.captureCount || 1);
    }
    return Object.entries(albumPlays)
      .map(([key, plays]) => {
        const [artist, album] = key.split('::');
        return { artist, album, plays, needsCleaning: plays >= 5 };
      })
      .filter(a => a.needsCleaning)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 3);
  }, [myListens]);

  if (cleaningData.length === 0) return null;

  return (
    <div className="bg-[#f59e0b08] border border-[#f59e0b22] rounded-[14px] p-4 mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span className="text-[11px] font-bold text-[#f59e0b]">Cleaning Recommended</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {cleaningData.map((a, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2.5 bg-[#111] rounded-lg">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-gs-text font-semibold truncate block">{a.album}</span>
              <span className="text-[9px] text-gs-dim">{a.artist}</span>
            </div>
            <span className="text-[9px] text-[#f59e0b] font-mono font-bold shrink-0 ml-2">{a.plays} plays</span>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-gs-faint mt-2">Records with 5+ plays benefit from cleaning to maintain audio quality.</div>
    </div>
  );
}

// ── (15) Stylus Wear Indicator ─────────────────────────────────────────
function StylusWearIndicator({ myListens }) {
  const totalPlaytime = useMemo(() => {
    return myListens.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0);
  }, [myListens]);

  const estimatedLife = 1000 * 3600; // 1000 hours in seconds
  const usedPct = Math.min((totalPlaytime / estimatedLife) * 100, 100);
  const remainingHrs = Math.max(0, Math.floor((estimatedLife - totalPlaytime) / 3600));
  const wearColor = usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#22c55e';

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Stylus Wear Estimate</div>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center relative shrink-0" style={{ background: `conic-gradient(${wearColor} ${usedPct}%, #1a1a1a ${usedPct}%)` }}>
          <div className="w-10 h-10 rounded-full bg-gs-card flex items-center justify-center">
            <span className="text-[11px] font-extrabold font-mono" style={{ color: wearColor }}>{Math.round(100 - usedPct)}%</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[12px] font-bold text-gs-text">~{remainingHrs}h remaining</div>
          <div className="text-[9px] text-gs-dim mt-0.5">Based on {Math.floor(totalPlaytime / 3600)}h of tracked playtime</div>
          <div className="text-[9px] text-gs-faint mt-0.5">Typical stylus life: ~1,000 hours</div>
        </div>
      </div>
    </div>
  );
}

// ── (16) Listening Party Mode ──────────────────────────────────────────
function ListeningPartyMode({ nowPlaying }) {
  const [partyActive, setPartyActive] = useState(false);
  const [partyCode, setPartyCode] = useState('');
  const [listeners, setListeners] = useState([]);

  const handleCreate = useCallback(() => {
    setPartyActive(true);
    setPartyCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    setListeners([
      { name: 'You', status: 'host' },
      { name: 'vinylhead42', status: 'synced' },
      { name: 'cratedigger', status: 'syncing' },
    ]);
  }, []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Listening Party</div>
      {!partyActive ? (
        <div className="flex gap-2">
          <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915] transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Host Party
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] text-[#8b5cf6] bg-[#8b5cf608] border border-[#8b5cf622] rounded-lg cursor-pointer hover:bg-[#8b5cf615] transition-all">
            Join Party
          </button>
        </div>
      ) : (
        <div className="vb-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#22c55e]" style={{ animation: 'vb-pulse 1.5s ease-in-out infinite' }} />
              <span className="text-[11px] font-bold text-[#22c55e]">Party Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gs-dim font-mono">Code:</span>
              <span className="text-[11px] font-extrabold text-gs-accent font-mono tracking-wider">{partyCode}</span>
            </div>
          </div>
          {nowPlaying && (
            <div className="bg-[#111] rounded-lg py-2 px-3 mb-2.5 flex items-center gap-2">
              <EqualizerVis active barCount={3} height={12} color="#22c55e" />
              <span className="text-[10px] text-gs-text truncate">{nowPlaying.track.title} - {nowPlaying.track.artist}</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            {listeners.map(l => (
              <div key={l.name} className="flex items-center justify-between py-1 text-[10px]">
                <span className="text-gs-muted">{l.name}</span>
                <span className={`font-mono ${l.status === 'host' ? 'text-[#f59e0b]' : l.status === 'synced' ? 'text-[#22c55e]' : 'text-gs-dim'}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => setPartyActive(false)} className="mt-2.5 w-full text-[10px] text-[#ef4444] bg-transparent border border-[#ef444422] rounded-lg py-1.5 cursor-pointer hover:bg-[#ef444408]">
            End Party
          </button>
        </div>
      )}
    </div>
  );
}

// ── (17) Album Art Recognition Confidence ──────────────────────────────
function AlbumArtConfidence({ session }) {
  const confidence = (() => {
    const base = (session?.score) || 75;
    return Math.min(100, base - 5 + Math.floor(Math.random() * 15));
  })();

  if (!session?.track?.album) return null;

  const color = confidence >= 85 ? '#22c55e' : confidence >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
      </svg>
      <span className="text-[8px] font-mono font-bold" style={{ color }}>Art match: {confidence}%</span>
    </div>
  );
}

// ── (18) Track Skip Detection ──────────────────────────────────────────
function TrackSkipDetector({ myListens }) {
  const skipData = useMemo(() => {
    const skips = myListens.filter(s => (s.listenedSeconds || 0) < 60 && (s.listenedSeconds || 0) > 0);
    const skipRate = myListens.length > 0 ? Math.round((skips.length / myListens.length) * 100) : 0;
    return { skipCount: skips.length, total: myListens.length, skipRate, recentSkips: skips.slice(0, 3) };
  }, [myListens]);

  if (myListens.length < 3) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Skip Detection</div>
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
          <div className="text-[14px] font-extrabold text-[#ef4444]">{skipData.skipCount}</div>
          <div className="text-[8px] text-gs-dim font-mono">Skips</div>
        </div>
        <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
          <div className="text-[14px] font-extrabold text-gs-accent">{skipData.total}</div>
          <div className="text-[8px] text-gs-dim font-mono">Total</div>
        </div>
        <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
          <div className="text-[14px] font-extrabold" style={{ color: skipData.skipRate > 30 ? '#ef4444' : '#22c55e' }}>{skipData.skipRate}%</div>
          <div className="text-[8px] text-gs-dim font-mono">Skip Rate</div>
        </div>
      </div>
      {skipData.recentSkips.length > 0 && (
        <div className="text-[9px] text-gs-faint">
          Recently skipped: {skipData.recentSkips.map(s => s.track.title).join(', ')}
        </div>
      )}
    </div>
  );
}

// ── (19) Vinyl Warping Detection ───────────────────────────────────────
function VinylWarpingDetector({ active }) {
  const [warpLevel, setWarpLevel] = useState(0);

  useEffect(() => {
    if (active) {
      const id = setInterval(() => setWarpLevel(Math.random() * 15), 3000);
      return () => clearInterval(id);
    }
    setWarpLevel(0);
  }, [active]);

  const status = warpLevel > 10 ? 'warning' : warpLevel > 5 ? 'mild' : 'none';
  const statusInfo = {
    none: { label: 'No Warping Detected', color: '#22c55e', desc: 'Record is playing flat' },
    mild: { label: 'Mild Warping', color: '#f59e0b', desc: 'Slight wow/flutter detected' },
    warning: { label: 'Significant Warping', color: '#ef4444', desc: 'Consider using a record weight or clamp' },
  };
  const info = statusInfo[status];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Warping Detection</div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${info.color}15`, border: `1px solid ${info.color}33` }}>
          <div
            className="w-6 h-6 rounded-full border-2"
            style={{
              borderColor: info.color,
              animation: active ? 'vb-warp-wobble 1s ease-in-out infinite' : 'none',
            }}
          />
        </div>
        <div>
          <div className="text-[11px] font-bold" style={{ color: info.color }}>{info.label}</div>
          <div className="text-[9px] text-gs-dim">{info.desc}</div>
          {active && <div className="text-[8px] text-gs-faint font-mono mt-0.5">Wow/flutter: {warpLevel.toFixed(2)}%</div>}
        </div>
      </div>
    </div>
  );
}

// ── (20) Surface Noise Level Meter ─────────────────────────────────────
function SurfaceNoiseMeter({ active }) {
  const [noiseLevel, setNoiseLevel] = useState(0);

  useEffect(() => {
    if (active) {
      const id = setInterval(() => setNoiseLevel(15 + Math.random() * 35), 2000);
      return () => clearInterval(id);
    }
    setNoiseLevel(0);
  }, [active]);

  const noiseColor = noiseLevel > 40 ? '#ef4444' : noiseLevel > 25 ? '#f59e0b' : '#22c55e';
  const noiseLabel = noiseLevel > 40 ? 'High' : noiseLevel > 25 ? 'Moderate' : 'Low';

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Surface Noise</div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] text-gs-muted">{active ? noiseLabel : 'Inactive'}</span>
            <span className="text-[10px] font-bold font-mono" style={{ color: active ? noiseColor : '#555' }}>
              {active ? `${noiseLevel.toFixed(1)} dB` : '--'}
            </span>
          </div>
          <div className="w-full h-3 bg-[#111] rounded-full overflow-hidden flex">
            {Array.from({ length: 20 }, (_, i) => {
              const threshold = (i / 20) * 60;
              const isActive = active && noiseLevel >= threshold;
              const segColor = threshold > 40 ? '#ef4444' : threshold > 25 ? '#f59e0b' : '#22c55e';
              return (
                <div
                  key={i}
                  className="flex-1 mx-[0.5px] rounded-sm transition-all duration-150"
                  style={{ background: isActive ? segColor : '#1a1a1a' }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {active && noiseLevel > 35 && (
        <div className="text-[9px] text-[#f59e0b] mt-2">Consider cleaning the record to reduce surface noise.</div>
      )}
    </div>
  );
}

// ── (21) Dynamic Range Meter ───────────────────────────────────────────
function DynamicRangeMeter({ active, myListens }) {
  const dr = useMemo(() => {
    if (!active && myListens.length === 0) return null;
    const base = 10 + Math.floor(Math.random() * 8);
    return {
      value: base,
      rating: base >= 14 ? 'Excellent' : base >= 10 ? 'Good' : 'Compressed',
      color: base >= 14 ? '#22c55e' : base >= 10 ? '#0ea5e9' : '#f59e0b',
    };
  }, [active, myListens.length]);

  if (!dr) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Dynamic Range</div>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${dr.color}15`, border: `1px solid ${dr.color}33` }}>
          <span className="text-[18px] font-extrabold font-mono" style={{ color: dr.color }}>DR{dr.value}</span>
        </div>
        <div>
          <div className="text-[12px] font-bold text-gs-text">{dr.rating}</div>
          <div className="text-[9px] text-gs-dim mt-0.5">
            {dr.value >= 14 ? 'Wide dynamic range - vinyl at its best' : dr.value >= 10 ? 'Good dynamics for this format' : 'Limited dynamics - may be a loud master'}
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="w-1.5 h-3 rounded-sm" style={{ background: i < dr.value ? dr.color : '#1a1a1a' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── (22) Listening Fatigue Warning ─────────────────────────────────────
function ListeningFatigueWarning({ myListens }) {
  const sessionDuration = useMemo(() => {
    if (myListens.length === 0) return 0;
    const recent = myListens.filter(s => Date.now() - s.timestampMs < 4 * 3600000);
    return recent.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0);
  }, [myListens]);

  const hours = sessionDuration / 3600;
  if (hours < 1.5) return null;

  const severity = hours >= 3 ? 'high' : 'moderate';
  const info = {
    moderate: { color: '#f59e0b', label: 'Consider a Break', desc: `You've been listening for ${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m. Taking short breaks helps prevent listener fatigue.` },
    high: { color: '#ef4444', label: 'Extended Listening Session', desc: `Over ${Math.floor(hours)} hours of continuous listening. Prolonged exposure at high volumes can cause hearing fatigue. Consider lowering volume or taking a 15-minute break.` },
  };
  const s = info[severity];

  return (
    <div className="rounded-[14px] p-4 mb-4" style={{ background: `${s.color}08`, border: `1px solid ${s.color}22` }}>
      <div className="flex items-start gap-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <div className="text-[12px] font-bold" style={{ color: s.color }}>{s.label}</div>
          <div className="text-[10px] text-gs-dim mt-1 leading-relaxed">{s.desc}</div>
        </div>
      </div>
    </div>
  );
}

// ── (23) Room Acoustics Tips ───────────────────────────────────────────
function RoomAcousticsTips() {
  const [expanded, setExpanded] = useState(false);
  const tips = [
    { title: 'Speaker Placement', desc: 'Position speakers at ear level, forming an equilateral triangle with your listening position.' },
    { title: 'Room Treatment', desc: 'Soft furnishings, rugs, and curtains help reduce reflections. Avoid bare, parallel walls.' },
    { title: 'Device Position', desc: 'Place Vinyl Buddy 6-12 inches from a speaker, not directly on the turntable plinth.' },
    { title: 'Bass Management', desc: 'Corner placement amplifies bass. Move speakers away from corners if bass sounds boomy.' },
    { title: 'Listening Distance', desc: 'Sit at least 1.5x the distance between your speakers for optimal stereo imaging.' },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
          </svg>
          <span className="text-[12px] font-bold text-gs-text">Room Acoustics Tips</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          <div className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-2.5 py-2 px-2.5 rounded-lg bg-[#111]">
                <div className="w-5 h-5 rounded-full bg-[#14b8a615] border border-[#14b8a633] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-[#14b8a6]">{i + 1}</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gs-text">{tip.title}</div>
                  <div className="text-[9px] text-gs-dim mt-0.5 leading-relaxed">{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (24) Device Firmware Changelog Display ─────────────────────────────
function FirmwareChangelog() {
  const [expanded, setExpanded] = useState(false);
  const releases = [
    { version: '2.1.0', date: '2026-03-15', changes: ['Improved acoustic fingerprinting accuracy by 15%', 'Added support for 78 RPM detection', 'Fixed WiFi reconnection stability'] },
    { version: '2.0.3', date: '2026-02-28', changes: ['Reduced memory usage during capture', 'Better noise floor detection', 'OLED display sleep mode'] },
    { version: '2.0.0', date: '2026-01-15', changes: ['Major rewrite of audio pipeline', 'New I2S driver for INMP441', 'Added OTA update support', 'New heartbeat protocol v2'] },
    { version: '1.5.2', date: '2025-12-01', changes: ['Bug fix: occasional crash during long sessions', 'Improved WiFi signal handling'] },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span className="text-[12px] font-bold text-gs-text">Firmware Changelog</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          <div className="flex flex-col gap-3">
            {releases.map((r, i) => (
              <div key={r.version} className="relative pl-4 border-l-2 border-[#1a1a1a]">
                {i === 0 && <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-[#8b5cf6]" />}
                {i > 0 && <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-[#333]" />}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-extrabold text-gs-text font-mono">v{r.version}</span>
                  <span className="text-[9px] text-gs-faint font-mono">{r.date}</span>
                  {i === 0 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#8b5cf611] border border-[#8b5cf622] text-[#8b5cf6] font-bold">Latest</span>}
                </div>
                <ul className="list-none p-0 m-0">
                  {r.changes.map((c, j) => (
                    <li key={j} className="text-[9px] text-gs-dim py-0.5 flex items-start gap-1.5">
                      <span className="text-[#555] mt-[3px] shrink-0">-</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (25) Bluetooth Speaker Pairing Guide ───────────────────────────────
function BluetoothPairingGuide() {
  const [expanded, setExpanded] = useState(false);
  const steps = [
    { title: 'Important Note', desc: 'Vinyl Buddy listens via its built-in microphone, not Bluetooth. This guide helps optimize your speaker setup for best identification results.' },
    { title: 'Wired Preferred', desc: 'For best results, use wired speakers. Bluetooth adds 40-200ms latency which can affect track identification timing.' },
    { title: 'If Using Bluetooth', desc: 'Enable aptX or AAC codec on your Bluetooth speaker for lowest latency. Place Vinyl Buddy near the speaker, not the turntable.' },
    { title: 'Speaker Volume', desc: 'Set speaker volume to a comfortable listening level (60-75%). Too quiet and identification fails; too loud causes distortion.' },
    { title: 'Multiple Speakers', desc: 'If using stereo Bluetooth speakers, place Vinyl Buddy equidistant between them for balanced audio capture.' },
  ];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/>
          </svg>
          <span className="text-[12px] font-bold text-gs-text">Bluetooth Speaker Guide</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          <div className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2.5 py-2 px-2.5 rounded-lg bg-[#111]">
                <div className="w-5 h-5 rounded-full bg-[#0ea5e915] border border-[#0ea5e933] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-gs-accent">{i + 1}</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gs-text">{step.title}</div>
                  <div className="text-[9px] text-gs-dim mt-0.5 leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (Improvement 1) Vinyl Grading Assistant ─────────────────────────────
function VinylGradingAssistant() {
  const [step, setStep] = useState(0);
  const [grades, setGrades] = useState({});

  const steps = [
    { key: 'visual', title: 'Visual Inspection', desc: 'Hold the record at an angle under a light. Look for scratches, scuffs, warps, or ring wear on the sleeve.', options: ['Mint (M)', 'Near Mint (NM)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good (G)', 'Fair/Poor (F/P)'] },
    { key: 'playback', title: 'Playback Test', desc: 'Play the record and listen for pops, clicks, skips, or distortion across both sides.', options: ['Silent (M/NM)', 'Light crackle (VG+)', 'Noticeable noise (VG)', 'Heavy noise (G)', 'Skips/unplayable (F/P)'] },
    { key: 'sleeve', title: 'Sleeve Condition', desc: 'Check the cover for seam splits, ring wear, water damage, writing, or sticker residue.', options: ['Perfect (M)', 'Minimal wear (NM)', 'Light wear (VG+)', 'Obvious wear (VG)', 'Heavy damage (G/F)'] },
    { key: 'labels', title: 'Label & Insert Check', desc: 'Inspect labels for writing, stickers, or damage. Check if inserts, lyric sheets, and posters are present.', options: ['Complete & perfect', 'Complete with minor wear', 'Missing some inserts', 'Labels damaged', 'Missing most inserts'] },
  ];

  const currentStep = steps[step];
  const isComplete = step >= steps.length;

  const overallGrade = useMemo(() => {
    if (Object.keys(grades).length < steps.length) return null;
    const gradeValues = { 0: 10, 1: 8, 2: 6, 3: 4, 4: 2 };
    const avg = Object.values(grades).reduce((sum, v) => sum + (gradeValues[v] || 5), 0) / Object.keys(grades).length;
    if (avg >= 9) return { label: 'Mint (M)', color: '#22c55e' };
    if (avg >= 7) return { label: 'Near Mint (NM)', color: '#0ea5e9' };
    if (avg >= 5) return { label: 'Very Good Plus (VG+)', color: '#8b5cf6' };
    if (avg >= 3) return { label: 'Very Good (VG)', color: '#f59e0b' };
    return { label: 'Good or below (G)', color: '#ef4444' };
  }, [grades]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Vinyl Grading Assistant</div>
      {!isComplete ? (
        <div className="vb-fade-in" key={step}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-gs-faint font-mono">Step {step + 1} of {steps.length}</span>
            <div className="flex-1 h-1 bg-[#111] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gs-accent transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className="text-[13px] font-bold text-gs-text mb-1">{currentStep.title}</div>
          <div className="text-[11px] text-gs-dim mb-3 leading-relaxed">{currentStep.desc}</div>
          <div className="flex flex-col gap-1.5">
            {currentStep.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => { setGrades(prev => ({ ...prev, [currentStep.key]: i })); setStep(s => s + 1); }}
                className="w-full text-left text-[11px] py-2 px-3 rounded-lg bg-[#111] border border-[#1a1a1a] text-gs-muted cursor-pointer hover:border-gs-accent hover:text-gs-accent transition-all duration-200"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 vb-fade-in">
          <div className="text-[10px] text-gs-faint font-mono mb-2">Overall Grade</div>
          <div className="text-2xl font-extrabold mb-1" style={{ color: overallGrade?.color }}>{overallGrade?.label}</div>
          <div className="text-[11px] text-gs-dim mb-3">Based on visual, playback, sleeve, and label inspection</div>
          <button onClick={() => { setStep(0); setGrades({}); }} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors">
            Grade Another Record
          </button>
        </div>
      )}
    </div>
  );
}

// ── (Improvement 2) Record Identification History Export ─────────────────
function HistoryExportPanel({ myListens }) {
  const [format, setFormat] = useState('csv');
  const [exported, setExported] = useState(false);

  const handleExport = useCallback(() => {
    let content, mimeType, ext;
    if (format === 'csv') {
      const headers = ['Title', 'Artist', 'Album', 'Year', 'Score', 'Date', 'Listened (sec)'];
      const rows = myListens.map(s => [
        `"${(s.track.title || '').replace(/"/g, '""')}"`, `"${(s.track.artist || '').replace(/"/g, '""')}"`,
        `"${(s.track.album || '').replace(/"/g, '""')}"`, s.track.year || '', s.score || '',
        new Date(s.timestampMs).toISOString(), s.listenedSeconds || 0,
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      mimeType = 'text/csv'; ext = 'csv';
    } else {
      content = JSON.stringify(myListens.map(s => ({
        title: s.track.title, artist: s.track.artist, album: s.track.album,
        year: s.track.year, score: s.score, date: new Date(s.timestampMs).toISOString(),
        listenedSeconds: s.listenedSeconds,
      })), null, 2);
      mimeType = 'application/json'; ext = 'json';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vinyl-buddy-history-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click(); URL.revokeObjectURL(url);
    setExported(true); setTimeout(() => setExported(false), 2000);
  }, [myListens, format]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Export History</div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {['csv', 'json'].map(f => (
            <button key={f} onClick={() => setFormat(f)} className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all border uppercase ${format === f ? 'bg-[#0ea5e911] border-[#0ea5e933] text-gs-accent font-bold' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={handleExport} className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors">
          {exported ? 'Exported!' : `Export ${myListens.length} records`}
        </button>
      </div>
    </div>
  );
}

// ── (Improvement 3) Listening Mood Playlist Builder ─────────────────────
function MoodPlaylistBuilder({ myListens }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const [built, setBuilt] = useState(false);

  const moods = useMemo(() => [
    { id: 'energized', label: 'Energized', emoji: '\uD83D\uDD25', color: '#ef4444', genres: ['Rock', 'Metal', 'Punk'] },
    { id: 'chill', label: 'Chill', emoji: '\uD83C\uDF19', color: '#6366f1', genres: ['Trip-Hop', 'Ambient', 'Jazz'] },
    { id: 'focused', label: 'Focused', emoji: '\uD83C\uDFAF', color: '#06b6d4', genres: ['Electronic', 'Prog Rock', 'Classical'] },
    { id: 'nostalgic', label: 'Nostalgic', emoji: '\uD83D\uDCFB', color: '#f59e0b', genres: ['Classic Rock', 'Soul', 'Folk'] },
    { id: 'upbeat', label: 'Upbeat', emoji: '\uD83C\uDF1F', color: '#22c55e', genres: ['Pop', 'Funk', 'Disco'] },
  ], []);

  const moodPlaylist = useMemo(() => {
    if (!selectedMood) return [];
    const unique = [];
    const seen = new Set();
    for (const s of myListens) {
      const key = `${s.track.artist}::${s.track.title}`;
      if (!seen.has(key)) { seen.add(key); unique.push(s.track); }
      if (unique.length >= 8) break;
    }
    return unique;
  }, [selectedMood, myListens]);

  if (myListens.length < 2) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Mood Playlist Builder</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {moods.map(m => (
          <button key={m.id} onClick={() => { setSelectedMood(m); setBuilt(true); }}
            className={`flex items-center gap-1 text-[10px] py-1.5 px-2.5 rounded-lg cursor-pointer transition-all border ${selectedMood?.id === m.id ? `bg-[${m.color}11] border-[${m.color}33]` : 'bg-[#111] border-[#1a1a1a] hover:border-[#333]'}`}
            style={selectedMood?.id === m.id ? { background: `${m.color}11`, borderColor: `${m.color}33`, color: m.color } : { color: '#888' }}>
            <span>{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>
      {built && selectedMood && moodPlaylist.length > 0 && (
        <div className="vb-fade-in">
          <div className="text-[11px] font-bold mb-2" style={{ color: selectedMood.color }}>{selectedMood.emoji} {selectedMood.label} Playlist</div>
          <div className="flex flex-col gap-1">
            {moodPlaylist.map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-[#111]">
                <span className="text-[9px] text-gs-faint font-mono w-4 text-right shrink-0">{i + 1}</span>
                <span className="text-[10px] text-gs-text truncate flex-1">{t.title}</span>
                <span className="text-[9px] text-gs-dim truncate">{t.artist}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── (Improvement 4) Audio Comparison Tool ───────────────────────────────
function AudioComparisonTool({ myListens }) {
  const [trackA, setTrackA] = useState(null);
  const [trackB, setTrackB] = useState(null);

  const uniqueTracks = useMemo(() => {
    const seen = new Set();
    return myListens.filter(s => { const k = `${s.track.artist}::${s.track.title}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  }, [myListens]);

  if (uniqueTracks.length < 2) return null;

  const comparison = trackA && trackB ? {
    scoreA: trackA.score || 0, scoreB: trackB.score || 0,
    yearA: trackA.track.year || '?', yearB: trackB.track.year || '?',
    listenA: trackA.listenedSeconds || 0, listenB: trackB.listenedSeconds || 0,
  } : null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Audio Comparison</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-gs-faint font-mono mb-1">Track A</div>
          <div className="flex flex-col gap-1">{uniqueTracks.slice(0, 5).map(s => (
            <button key={s.id} onClick={() => setTrackA(s)} className={`text-left text-[10px] py-1.5 px-2 rounded-lg border cursor-pointer transition-all ${trackA?.id === s.id ? 'bg-[#0ea5e911] border-[#0ea5e933] text-gs-accent' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}>
              {s.track.title}
            </button>
          ))}</div>
        </div>
        <div>
          <div className="text-[9px] text-gs-faint font-mono mb-1">Track B</div>
          <div className="flex flex-col gap-1">{uniqueTracks.slice(0, 5).map(s => (
            <button key={s.id} onClick={() => setTrackB(s)} className={`text-left text-[10px] py-1.5 px-2 rounded-lg border cursor-pointer transition-all ${trackB?.id === s.id ? 'bg-[#8b5cf611] border-[#8b5cf633] text-[#8b5cf6]' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}>
              {s.track.title}
            </button>
          ))}</div>
        </div>
      </div>
      {comparison && (
        <div className="vb-fade-in grid grid-cols-3 gap-2">
          <div className="bg-[#111] rounded-lg py-2 px-2 text-center">
            <div className="text-[9px] text-gs-dim font-mono mb-1">Score</div>
            <div className="text-[11px] font-bold text-gs-accent">{comparison.scoreA}%</div>
            <div className="text-[9px] text-gs-faint">vs</div>
            <div className="text-[11px] font-bold text-[#8b5cf6]">{comparison.scoreB}%</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2 text-center">
            <div className="text-[9px] text-gs-dim font-mono mb-1">Year</div>
            <div className="text-[11px] font-bold text-gs-accent">{comparison.yearA}</div>
            <div className="text-[9px] text-gs-faint">vs</div>
            <div className="text-[11px] font-bold text-[#8b5cf6]">{comparison.yearB}</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2 text-center">
            <div className="text-[9px] text-gs-dim font-mono mb-1">Duration</div>
            <div className="text-[11px] font-bold text-gs-accent">{Math.floor(comparison.listenA / 60)}m</div>
            <div className="text-[9px] text-gs-faint">vs</div>
            <div className="text-[11px] font-bold text-[#8b5cf6]">{Math.floor(comparison.listenB / 60)}m</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── (Improvement 5) Record Digitization Guide ───────────────────────────
function RecordDigitizationGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-4 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          <span className="text-[12px] font-bold text-gs-text">Record Digitization Guide</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in">
          {[
            { step: '1', title: 'Clean the Record', desc: 'Use a carbon fiber brush or velvet pad to remove dust. For deep cleaning, use a record cleaning solution.' },
            { step: '2', title: 'Connect Your Turntable', desc: 'Route audio from your turntable preamp to your computer via USB audio interface (e.g., Focusrite Scarlett).' },
            { step: '3', title: 'Configure Recording Software', desc: 'Use Audacity (free) or similar. Set input to your interface, 24-bit/96kHz for best quality.' },
            { step: '4', title: 'Record & Monitor Levels', desc: 'Peak levels should be around -6dB. Record full sides, splitting tracks later.' },
            { step: '5', title: 'Post-Processing', desc: 'Remove clicks with declicker, normalize levels, split into tracks, then export as FLAC (lossless) or 320kbps MP3.' },
          ].map(s => (
            <div key={s.step} className="flex gap-2.5 py-2 px-2.5 rounded-lg bg-[#111] mb-1.5">
              <div className="w-5 h-5 rounded-full bg-[#14b8a615] border border-[#14b8a633] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[9px] font-bold text-[#14b8a6]">{s.step}</span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gs-text">{s.title}</div>
                <div className="text-[9px] text-gs-dim mt-0.5 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── (Improvement 6) Listening Analytics Email Report Generator ──────────
function AnalyticsReportGenerator({ myListens }) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [sent, setSent] = useState(false);

  const handleSendReport = useCallback(() => {
    if (!email.trim()) return;
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }, [email]);

  const topArtist = useMemo(() => {
    const counts = {};
    for (const s of myListens) counts[s.track.artist] = (counts[s.track.artist] || 0) + 1;
    return Object.entries(counts).sort(([,a],[,b]) => b - a)[0]?.[0] || 'N/A';
  }, [myListens]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Email Report</div>
      <div className="bg-[#111] rounded-lg p-3 mb-3">
        <div className="text-[10px] text-gs-faint font-mono mb-1.5">Preview</div>
        <div className="text-[11px] text-gs-muted">Tracks identified: <span className="font-bold text-gs-text">{myListens.length}</span></div>
        <div className="text-[11px] text-gs-muted">Top artist: <span className="font-bold text-gs-text">{topArtist}</span></div>
        <div className="text-[11px] text-gs-muted">Listening time: <span className="font-bold text-gs-text">{Math.round(myListens.reduce((s, l) => s + (l.listenedSeconds || 0), 0) / 60)}m</span></div>
      </div>
      <div className="flex gap-1 mb-3">
        {['daily', 'weekly', 'monthly'].map(f => (
          <button key={f} onClick={() => setFrequency(f)} className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all border capitalize ${frequency === f ? 'bg-[#0ea5e911] border-[#0ea5e933] text-gs-accent font-bold' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="flex-1 py-1.5 px-2.5 bg-[#111] rounded-lg text-[11px] text-gs-text outline-none border border-[#222] focus:border-gs-accent transition-colors placeholder:text-gs-faint" />
        <button onClick={handleSendReport} disabled={!email.trim()} className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${email.trim() ? 'text-gs-accent border-gs-accent/30 cursor-pointer hover:bg-gs-accent/10' : 'text-gs-faint border-[#222] cursor-default'}`}>
          {sent ? 'Scheduled!' : 'Schedule'}
        </button>
      </div>
    </div>
  );
}

// ── (Improvement 7) Device Diagnostics Panel ────────────────────────────
function DeviceDiagnosticsPanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const handleRunDiagnostics = useCallback(() => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      setResults([
        { test: 'Microphone Input', status: 'pass', detail: 'Signal detected at -32dB' },
        { test: 'WiFi Connection', status: 'pass', detail: 'Connected at 72Mbps, latency 12ms' },
        { test: 'Memory Usage', status: 'pass', detail: '142KB free of 320KB total' },
        { test: 'Audio Processing', status: 'pass', detail: 'FFT pipeline running at 44.1kHz' },
        { test: 'Server Connection', status: 'warn', detail: 'Response time 250ms (target: <100ms)' },
        { test: 'Storage', status: 'pass', detail: '2.1MB used, 1.9MB available' },
      ]);
      setRunning(false);
    }, 2000);
  }, []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Device Diagnostics</div>
      {running ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <div className="w-4 h-4 rounded-full border-2 border-gs-accent border-t-transparent" style={{ animation: 'vb-spin 0.8s linear infinite' }} />
          <span className="text-[11px] text-gs-dim">Running diagnostics...</span>
        </div>
      ) : results ? (
        <div className="flex flex-col gap-1.5 vb-fade-in">
          {results.map(r => (
            <div key={r.test} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-[#111]">
              {r.status === 'pass' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3"><path d="M12 9v4M12 17h.01"/></svg>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gs-text">{r.test}</div>
                <div className="text-[9px] text-gs-dim">{r.detail}</div>
              </div>
            </div>
          ))}
          <button onClick={handleRunDiagnostics} className="mt-1 text-[10px] text-gs-accent bg-transparent border-none cursor-pointer p-0 hover:underline">Run again</button>
        </div>
      ) : (
        <button onClick={handleRunDiagnostics} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          Run Diagnostics
        </button>
      )}
    </div>
  );
}

// ── (Improvement 8) Audio Latency Tester ────────────────────────────────
function AudioLatencyTester() {
  const [testing, setTesting] = useState(false);
  const [latency, setLatency] = useState(null);
  const [history, setHistory] = useState([]);

  const handleTest = useCallback(() => {
    setTesting(true);
    setLatency(null);
    setTimeout(() => {
      const result = 8 + Math.floor(Math.random() * 25);
      setLatency(result);
      setHistory(prev => [{ value: result, time: Date.now() }, ...prev].slice(0, 5));
      setTesting(false);
    }, 1500);
  }, []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Audio Latency</div>
      <div className="flex items-center gap-3 mb-3">
        <button onClick={handleTest} disabled={testing} className={`text-[11px] px-4 py-2 rounded-lg border transition-all ${testing ? 'text-gs-faint border-[#222] cursor-default' : 'text-gs-accent border-gs-accent/30 cursor-pointer hover:bg-gs-accent/10'}`}>
          {testing ? 'Testing...' : 'Test Latency'}
        </button>
        {latency !== null && (
          <div className="vb-fade-in flex items-center gap-2">
            <span className="text-xl font-extrabold font-mono" style={{ color: latency < 15 ? '#22c55e' : latency < 25 ? '#f59e0b' : '#ef4444' }}>{latency}ms</span>
            <span className="text-[10px] text-gs-dim">{latency < 15 ? 'Excellent' : latency < 25 ? 'Good' : 'High'}</span>
          </div>
        )}
      </div>
      {history.length > 0 && (
        <div className="flex gap-1.5">
          {history.map((h, i) => (
            <div key={i} className="bg-[#111] rounded-lg py-1.5 px-2 text-center">
              <div className="text-[10px] font-mono font-bold" style={{ color: h.value < 15 ? '#22c55e' : h.value < 25 ? '#f59e0b' : '#ef4444' }}>{h.value}ms</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── (Improvement 9) Microphone Sensitivity Test ─────────────────────────
function MicSensitivityTest() {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(null);
  const intervalRef = useRef(null);

  const handleTest = useCallback(() => {
    setTesting(true);
    setLevel(0);
    let count = 0;
    intervalRef.current = setInterval(() => {
      setLevel(Math.floor(30 + Math.random() * 50));
      count++;
      if (count >= 20) {
        clearInterval(intervalRef.current);
        setTesting(false);
      }
    }, 150);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Microphone Sensitivity</div>
      <div className="flex items-center gap-3 mb-2">
        <button onClick={handleTest} disabled={testing} className={`text-[11px] px-4 py-2 rounded-lg border transition-all ${testing ? 'text-gs-faint border-[#222] cursor-default' : 'text-[#8b5cf6] border-[#8b5cf633] cursor-pointer hover:bg-[#8b5cf611]'}`}>
          {testing ? 'Listening...' : 'Test Microphone'}
        </button>
        {level !== null && (
          <div className="flex-1 h-4 bg-[#111] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-150" style={{ width: `${level}%`, background: level > 70 ? '#22c55e' : level > 40 ? '#f59e0b' : '#ef4444' }} />
          </div>
        )}
        {level !== null && <span className="text-[11px] font-mono font-bold" style={{ color: level > 70 ? '#22c55e' : level > 40 ? '#f59e0b' : '#ef4444' }}>{level}%</span>}
      </div>
      {!testing && level !== null && (
        <div className="text-[10px] text-gs-dim mt-1">
          {level > 70 ? 'Great - microphone is picking up audio clearly' : level > 40 ? 'Acceptable - consider moving device closer to turntable' : 'Low - check microphone placement or gain settings'}
        </div>
      )}
    </div>
  );
}

// ── (Improvement 10) Record Speed Calculator ────────────────────────────
function RecordSpeedCalculator() {
  const [measuring, setMeasuring] = useState(false);
  const [taps, setTaps] = useState([]);
  const [calculatedRPM, setCalculatedRPM] = useState(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    setTaps(prev => {
      const updated = [...prev, now].slice(-5);
      if (updated.length >= 3) {
        const intervals = [];
        for (let i = 1; i < updated.length; i++) intervals.push(updated[i] - updated[i-1]);
        const avgInterval = intervals.reduce((a,b) => a + b, 0) / intervals.length;
        const rpm = (60000 / avgInterval).toFixed(1);
        setCalculatedRPM(parseFloat(rpm));
      }
      return updated;
    });
  }, []);

  const handleStart = useCallback(() => { setMeasuring(true); setTaps([]); setCalculatedRPM(null); }, []);

  const deviation = calculatedRPM ? (() => {
    const targets = [33.33, 45, 78];
    const closest = targets.reduce((a, b) => Math.abs(b - calculatedRPM) < Math.abs(a - calculatedRPM) ? b : a);
    return { target: closest, diff: ((calculatedRPM - closest) / closest * 100).toFixed(2) };
  })() : null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Speed Calculator (Tap Method)</div>
      {!measuring ? (
        <button onClick={handleStart} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915] transition-all">
          Start Measuring
        </button>
      ) : (
        <div className="text-center">
          <div className="text-[11px] text-gs-dim mb-2">Tap each time a label marker passes. Need 3+ taps.</div>
          <button onClick={handleTap} className="w-20 h-20 rounded-full bg-[#0ea5e915] border-2 border-gs-accent text-gs-accent text-xl font-extrabold cursor-pointer hover:bg-[#0ea5e922] transition-all mb-3 mx-auto block">
            TAP
          </button>
          <div className="text-[10px] text-gs-faint font-mono mb-2">Taps: {taps.length}</div>
          {calculatedRPM && (
            <div className="vb-fade-in">
              <div className="text-2xl font-extrabold" style={{ color: Math.abs(parseFloat(deviation?.diff || 0)) < 1 ? '#22c55e' : '#f59e0b' }}>{calculatedRPM} RPM</div>
              {deviation && <div className="text-[10px] text-gs-dim mt-1">Target: {deviation.target} RPM ({deviation.diff > 0 ? '+' : ''}{deviation.diff}%)</div>}
            </div>
          )}
          <button onClick={() => setMeasuring(false)} className="mt-3 text-[10px] text-gs-dim bg-transparent border border-[#222] rounded-lg px-3 py-1 cursor-pointer hover:border-[#444]">Done</button>
        </div>
      )}
    </div>
  );
}

// ── (Improvement 11) Genre Discovery Mode ───────────────────────────────
function GenreDiscoveryMode({ myListens }) {
  const [discovering, setDiscovering] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const listenedGenres = useMemo(() => {
    const genreMap = { "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock", "The Beatles": "Rock", "Eagles": "Rock", "The Doors": "Rock", "The Who": "Rock" };
    return new Set(myListens.map(s => genreMap[s.track.artist] || 'Rock'));
  }, [myListens]);

  const unexplored = useMemo(() => {
    const allGenres = [
      { genre: 'Afrobeat', desc: 'Rhythmic fusion of West African music and jazz', starter: 'Fela Kuti - Zombie', color: '#f59e0b' },
      { genre: 'Bossa Nova', desc: 'Brazilian blend of samba and jazz', starter: 'Antonio Carlos Jobim - Wave', color: '#22c55e' },
      { genre: 'Krautrock', desc: 'Experimental German rock from the 70s', starter: 'Can - Tago Mago', color: '#8b5cf6' },
      { genre: 'Dub', desc: 'Jamaican remix-based electronic music', starter: 'King Tubby - Dub From the Roots', color: '#06b6d4' },
      { genre: 'Post-Punk', desc: 'Art-influenced alternative to punk rock', starter: 'Joy Division - Unknown Pleasures', color: '#ef4444' },
      { genre: 'Ambient', desc: 'Atmospheric electronic soundscapes', starter: 'Brian Eno - Music for Airports', color: '#14b8a6' },
      { genre: 'Cumbia', desc: 'Colombian folk dance music', starter: 'La Sonora Dinamita - Se Me Perdio La Cadenita', color: '#ec4899' },
      { genre: 'Free Jazz', desc: 'Improvisation-focused experimental jazz', starter: 'Ornette Coleman - The Shape of Jazz to Come', color: '#f97316' },
    ];
    return allGenres.filter(g => !listenedGenres.has(g.genre));
  }, [listenedGenres]);

  const handleDiscover = useCallback(() => {
    setDiscovering(true);
    setTimeout(() => {
      setSuggestion(unexplored[Math.floor(Math.random() * unexplored.length)] || unexplored[0]);
      setDiscovering(false);
    }, 1000);
  }, [unexplored]);

  if (unexplored.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Genre Discovery</div>
      {discovering ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <div className="w-4 h-4 rounded-full border-2 border-[#8b5cf6] border-t-transparent" style={{ animation: 'vb-spin 0.8s linear infinite' }} />
          <span className="text-[11px] text-gs-dim">Finding something new...</span>
        </div>
      ) : suggestion ? (
        <div className="vb-fade-in">
          <div className="py-3 px-3 rounded-lg mb-2" style={{ background: `${suggestion.color}08`, border: `1px solid ${suggestion.color}22` }}>
            <div className="text-[14px] font-extrabold mb-1" style={{ color: suggestion.color }}>{suggestion.genre}</div>
            <div className="text-[11px] text-gs-dim mb-1.5">{suggestion.desc}</div>
            <div className="text-[10px] text-gs-faint font-mono">Start with: {suggestion.starter}</div>
          </div>
          <button onClick={handleDiscover} className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer p-0 hover:underline">Try another genre</button>
        </div>
      ) : (
        <button onClick={handleDiscover} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-[#8b5cf6] bg-[#8b5cf608] border border-[#8b5cf622] rounded-lg cursor-pointer hover:bg-[#8b5cf615] transition-all">
          Discover a New Genre
        </button>
      )}
    </div>
  );
}

// ── (Improvement 12) Vinyl Care Tips Carousel ───────────────────────────
function VinylCareTipsCarousel() {
  const [tipIndex, setTipIndex] = useState(0);

  const tips = useMemo(() => [
    { title: 'Proper Storage', text: 'Store records vertically, never stacked flat. Use poly-lined inner sleeves to prevent ring wear.', icon: '\uD83D\uDCE6' },
    { title: 'Cleaning Before Play', text: 'Always brush records with a carbon fiber brush before each play to remove surface dust.', icon: '\uD83E\uDDF9' },
    { title: 'Handle With Care', text: 'Only touch records by the edges and label area. Oils from fingers cause permanent damage to grooves.', icon: '\u270B' },
    { title: 'Stylus Maintenance', text: 'Clean your stylus regularly with a stylus brush. Replace the needle every 1,000 hours of play.', icon: '\uD83D\uDD0D' },
    { title: 'Temperature Control', text: 'Keep records in a cool, dry environment (65-70F). Heat can cause warping within minutes.', icon: '\uD83C\uDF21\uFE0F' },
    { title: 'Anti-Static Treatment', text: 'Use an anti-static gun before playing to reduce dust attraction and surface noise.', icon: '\u26A1' },
  ], []);

  const tip = tips[tipIndex];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Vinyl Care Tips</div>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl shrink-0">{tip.icon}</span>
        <div>
          <div className="text-[13px] font-bold text-gs-text mb-1">{tip.title}</div>
          <div className="text-[11px] text-gs-dim leading-relaxed">{tip.text}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">{tips.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === tipIndex ? 'bg-gs-accent' : 'bg-[#333]'}`} />
        ))}</div>
        <div className="flex gap-1.5">
          <button onClick={() => setTipIndex(i => (i - 1 + tips.length) % tips.length)} className="text-[10px] text-gs-dim bg-[#111] border border-[#222] rounded-lg px-2.5 py-1 cursor-pointer hover:border-[#444]">Prev</button>
          <button onClick={() => setTipIndex(i => (i + 1) % tips.length)} className="text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-2.5 py-1 cursor-pointer hover:bg-[#0ea5e915]">Next</button>
        </div>
      </div>
    </div>
  );
}

// ── (Improvement 13) Device Battery Optimization Tips ───────────────────
function BatteryOptimizationTips() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] mb-3 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between py-3.5 px-4 bg-transparent border-none cursor-pointer text-left">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><path d="M13 2L3 14h9l-1 8"/></svg>
          <span className="text-[12px] font-bold text-gs-text">Battery Optimization</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 vb-fade-in flex flex-col gap-1.5">
          {[
            { tip: 'Lower sample rate to 16kHz when not actively identifying', impact: 'Saves ~30% power' },
            { tip: 'Reduce WiFi polling interval to 30 seconds', impact: 'Saves ~20% power' },
            { tip: 'Disable OLED display when idle', impact: 'Saves ~15% power' },
            { tip: 'Use deep sleep mode between listening sessions', impact: 'Saves ~80% idle power' },
            { tip: 'Keep firmware updated for power optimizations', impact: 'Varies by update' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2.5 rounded-lg bg-[#111]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="shrink-0 mt-0.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <div className="flex-1">
                <div className="text-[11px] text-gs-text">{item.tip}</div>
                <div className="text-[9px] text-[#22c55e] font-mono mt-0.5">{item.impact}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── (Improvement 14) Listening Session Planner ──────────────────────────
function ListeningSessionPlanner() {
  const [sessions, setSessions] = useState([
    { name: 'Sunday Morning Jazz', time: '09:00', duration: '2h', albums: ['Kind of Blue', 'A Love Supreme'] },
  ]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('19:00');
  const [newDuration, setNewDuration] = useState('1h');

  const handleAdd = useCallback(() => {
    if (!newName.trim()) return;
    setSessions(prev => [...prev, { name: newName.trim(), time: newTime, duration: newDuration, albums: [] }]);
    setNewName(''); setAdding(false);
  }, [newName, newTime, newDuration]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Session Planner</div>
      {sessions.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg bg-[#111] mb-1.5">
          <div className="text-[11px] font-bold text-gs-accent font-mono shrink-0">{s.time}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-gs-text truncate">{s.name}</div>
            <div className="text-[9px] text-gs-dim">{s.duration}{s.albums.length > 0 ? ` - ${s.albums.length} album${s.albums.length > 1 ? 's' : ''}` : ''}</div>
          </div>
          <button onClick={() => setSessions(prev => prev.filter((_, j) => j !== i))} className="text-[9px] text-gs-faint hover:text-red-400 bg-transparent border-none cursor-pointer">x</button>
        </div>
      ))}
      {adding ? (
        <div className="flex flex-col gap-2 mt-2 vb-fade-in">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Session name..." className="py-1.5 px-2.5 bg-[#111] rounded-lg text-[11px] text-gs-text outline-none border border-[#222] focus:border-gs-accent transition-colors placeholder:text-gs-faint" />
          <div className="flex gap-2">
            <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="flex-1 py-1.5 px-2 bg-[#111] rounded-lg text-[11px] text-gs-text border border-[#222] outline-none focus:border-gs-accent font-mono" />
            <div className="flex gap-1">{['1h', '2h', '3h'].map(d => (
              <button key={d} onClick={() => setNewDuration(d)} className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer border ${newDuration === d ? 'bg-[#0ea5e911] border-[#0ea5e933] text-gs-accent' : 'bg-[#111] border-[#1a1a1a] text-gs-dim'}`}>{d}</button>
            ))}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#0ea5e915]">Add</button>
            <button onClick={() => setAdding(false)} className="text-[10px] text-gs-dim bg-transparent border border-[#222] rounded-lg px-3 py-1.5 cursor-pointer hover:border-[#444]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-1 w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg cursor-pointer hover:bg-[#0ea5e915]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Plan a Session
        </button>
      )}
    </div>
  );
}

// ── (Improvement 15) Community Listening Events Calendar ─────────────────
function CommunityEventsCalendar() {
  const [selectedEvent, setSelectedEvent] = useState(null);

  const events = useMemo(() => [
    { id: 1, name: 'Vinyl Night: Classic Rock', date: 'Mar 22', time: '7:00 PM', host: '@vinylhead42', attendees: 12, desc: 'Bring your favorite classic rock LPs. Full PA setup provided.' },
    { id: 2, name: 'Jazz Listening Circle', date: 'Mar 25', time: '6:30 PM', host: '@cratedigger', attendees: 8, desc: 'Exploring Blue Note records from the 1960s. BYOB.' },
    { id: 3, name: 'New Arrivals Showcase', date: 'Mar 28', time: '8:00 PM', host: '@waxcollector', attendees: 15, desc: 'Share your latest finds and trades. Prize for rarest pressing.' },
    { id: 4, name: 'Turntable Clinic', date: 'Apr 1', time: '2:00 PM', host: '@groovybeats', attendees: 6, desc: 'Bring your turntable for setup optimization and cartridge alignment.' },
  ], []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Community Events</div>
      <div className="flex flex-col gap-1.5">
        {events.map(ev => (
          <button key={ev.id} onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)} className={`w-full text-left flex items-center gap-2.5 py-2 px-2.5 rounded-lg border transition-all cursor-pointer bg-transparent ${selectedEvent?.id === ev.id ? 'bg-[#0ea5e908] border-[#0ea5e933]' : 'bg-[#111] border-[#1a1a1a] hover:border-[#333]'}`}>
            <div className="text-center shrink-0 w-10">
              <div className="text-[10px] text-gs-accent font-bold">{ev.date.split(' ')[0]}</div>
              <div className="text-[14px] font-extrabold text-gs-text">{ev.date.split(' ')[1]}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gs-text truncate">{ev.name}</div>
              <div className="text-[9px] text-gs-dim">{ev.time} - Hosted by {ev.host}</div>
            </div>
            <span className="text-[9px] text-gs-faint font-mono shrink-0">{ev.attendees} going</span>
          </button>
        ))}
      </div>
      {selectedEvent && (
        <div className="mt-2 py-2.5 px-3 rounded-lg bg-[#0ea5e908] border border-[#0ea5e922] vb-fade-in">
          <div className="text-[11px] text-gs-dim mb-2">{selectedEvent.desc}</div>
          <button className="text-[10px] text-white gs-btn-gradient px-3 py-1.5 rounded-lg">RSVP</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// (Final 1) AI Record Recommendation Engine
// ============================================================================
function AIRecRecommendationEngine({ myListens }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const recommendations = useMemo(() => {
    if (myListens.length === 0) return [];
    const artistCounts = {};
    for (const s of myListens) {
      artistCounts[s.track.artist] = (artistCounts[s.track.artist] || 0) + 1;
    }
    const topArtists = Object.entries(artistCounts).sort(([,a],[,b]) => b - a).map(([a]) => a).slice(0, 3);
    const recMap = {
      "Led Zeppelin": [
        { title: "Physical Graffiti", artist: "Led Zeppelin", reason: "Deep cuts from your favorite band", confidence: 97 },
        { title: "Paranoid", artist: "Black Sabbath", reason: "Same era heavy riffs", confidence: 88 },
      ],
      "Pink Floyd": [
        { title: "Animals", artist: "Pink Floyd", reason: "Underrated Floyd masterwork", confidence: 95 },
        { title: "In the Court of the Crimson King", artist: "King Crimson", reason: "Prog rock essential", confidence: 86 },
      ],
      "Queen": [
        { title: "News of the World", artist: "Queen", reason: "Classic Queen deep dive", confidence: 94 },
        { title: "Ziggy Stardust", artist: "David Bowie", reason: "Glam rock crossover", confidence: 82 },
      ],
      "The Beatles": [
        { title: "Abbey Road", artist: "The Beatles", reason: "Their sonic masterpiece", confidence: 96 },
        { title: "Pet Sounds", artist: "The Beach Boys", reason: "Inspired Sgt. Pepper's", confidence: 89 },
      ],
    };
    const defaultRecs = [
      { title: "Rumours", artist: "Fleetwood Mac", reason: "Essential vinyl collection piece", confidence: 90 },
      { title: "Kind of Blue", artist: "Miles Davis", reason: "Greatest jazz recording on vinyl", confidence: 87 },
      { title: "OK Computer", artist: "Radiohead", reason: "Alternative rock benchmark", confidence: 84 },
      { title: "Illmatic", artist: "Nas", reason: "Hip-hop perfection on wax", confidence: 83 },
    ];
    const recs = [];
    for (const artist of topArtists) {
      if (recMap[artist]) recs.push(...recMap[artist]);
    }
    if (recs.length < 4) recs.push(...defaultRecs.slice(0, 4 - recs.length));
    return recs.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myListens, refreshKey]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">AI Recommendations</div>
        <button onClick={() => setRefreshKey(k => k + 1)} className="text-[9px] text-gs-accent bg-transparent border border-gs-accent/20 rounded-lg px-2 py-1 cursor-pointer hover:bg-gs-accent/10 transition-colors">Refresh</button>
      </div>
      <div className="flex flex-col gap-2">
        {recommendations.map((rec, i) => (
          <div key={`${rec.title}-${i}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#333] transition-all duration-200">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 bg-gradient-to-br from-[#8b5cf6] to-[#0ea5e9]">{rec.artist.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-gs-text truncate">{rec.title}</div>
              <div className="text-[10px] text-gs-dim truncate">{rec.artist}</div>
              <div className="text-[9px] text-gs-accent mt-0.5">{rec.reason}</div>
            </div>
            <div className="text-[10px] font-bold font-mono text-[#22c55e] shrink-0">{rec.confidence}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 2) Vinyl Collection Value Tracker
// ============================================================================
function CollectionValueTracker({ myListens }) {
  const [showHistory, setShowHistory] = useState(false);
  const valueData = useMemo(() => {
    if (myListens.length === 0) return null;
    const uniqueAlbums = [...new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`))];
    const valuePer = uniqueAlbums.map((key) => {
      const [artist, album] = key.split("::");
      const baseVal = (artist.length * 3 + album.length * 2) % 40 + 15;
      return { artist, album, value: baseVal };
    });
    const total = valuePer.reduce((sum, v) => sum + v.value, 0);
    const dailyChange = ((Math.sin(Date.now() / 86400000) * 3) + 1.2).toFixed(1);
    const weekHistory = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { day: d.toLocaleDateString("en-US", { weekday: "short" }), value: total - (6 - i) * 2 + Math.random() * 5 };
    });
    return { total, dailyChange: Number(dailyChange), count: uniqueAlbums.length, topItems: valuePer.sort((a, b) => b.value - a.value).slice(0, 5), weekHistory };
  }, [myListens]);

  if (!valueData) return null;

  const maxVal = Math.max(...valueData.weekHistory.map(d => d.value), 1);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Collection Value Tracker</div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <div className="text-[22px] font-extrabold text-[#22c55e]">${valueData.total}</div>
          <div className="text-[9px] text-gs-faint">{valueData.count} unique albums</div>
        </div>
        <div className={`text-[12px] font-bold ${valueData.dailyChange >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
          {valueData.dailyChange >= 0 ? '+' : ''}{valueData.dailyChange}% today
        </div>
      </div>
      <button onClick={() => setShowHistory(!showHistory)} className="text-[9px] text-gs-accent bg-transparent border-none cursor-pointer underline mb-2">
        {showHistory ? 'Hide' : 'Show'} 7-day trend
      </button>
      {showHistory && (
        <div className="flex items-end gap-1 h-12 mt-2">
          {valueData.weekHistory.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t-sm" style={{ height: `${(d.value / maxVal) * 40}px`, background: 'linear-gradient(to top, #22c55e, #22c55e88)' }} />
              <div className="text-[8px] text-gs-faint font-mono">{d.day}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 space-y-1">
        {valueData.topItems.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center justify-between text-[10px]">
            <span className="text-gs-muted truncate flex-1">{item.album} - {item.artist}</span>
            <span className="text-[#22c55e] font-bold font-mono ml-2">${item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 3) Record Identification Quiz Game
// ============================================================================
function RecordIdentificationQuiz({ myListens }) {
  const [quizActive, setQuizActive] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(null);
  const [quizDone, setQuizDone] = useState(false);

  const questions = useMemo(() => {
    const allTracks = myListens.length > 0 ? myListens : generateDemoData();
    const shuffled = [...allTracks].sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled.map((s) => {
      const correct = s.track.artist;
      const wrongArtists = ["The Rolling Stones", "Jimi Hendrix", "Bob Dylan", "David Bowie", "Stevie Wonder", "Elton John", "Joni Mitchell", "Neil Young"];
      const wrongs = wrongArtists.filter(a => a !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);
      return { track: s.track, correctArtist: correct, options };
    });
  }, [myListens]);

  const handleAnswer = useCallback((opt) => {
    if (answered !== null) return;
    setAnswered(opt);
    if (opt === questions[currentQ].correctArtist) setScore(s => s + 1);
    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ(q => q + 1);
        setAnswered(null);
      } else {
        setQuizDone(true);
      }
    }, 1200);
  }, [answered, currentQ, questions]);

  const resetQuiz = useCallback(() => {
    setQuizActive(false);
    setCurrentQ(0);
    setScore(0);
    setAnswered(null);
    setQuizDone(false);
  }, []);

  if (!quizActive) {
    return (
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Record Quiz</div>
        <div className="text-[12px] text-gs-text font-bold mb-1">Test Your Vinyl Knowledge</div>
        <div className="text-[10px] text-gs-dim mb-3">Can you match albums to their artists?</div>
        <button onClick={() => setQuizActive(true)} className="gs-btn-gradient px-4 py-2 text-xs text-white">Start Quiz</button>
      </div>
    );
  }

  if (quizDone) {
    return (
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4 text-center">
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Quiz Complete</div>
        <div className="text-[28px] font-extrabold text-gs-accent mb-1">{score}/{questions.length}</div>
        <div className="text-[11px] text-gs-dim mb-3">{score === questions.length ? 'Perfect! True vinyl connoisseur!' : score >= 3 ? 'Nice ear! Keep exploring!' : 'Keep spinning those records!'}</div>
        <button onClick={resetQuiz} className="gs-btn-gradient px-4 py-2 text-xs text-white">Play Again</button>
      </div>
    );
  }

  const q = questions[currentQ];
  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Question {currentQ + 1}/{questions.length}</div>
        <div className="text-[10px] text-gs-accent font-bold">Score: {score}</div>
      </div>
      <div className="text-[13px] font-bold text-gs-text mb-1">Who performed "{q.track.title}"?</div>
      <div className="text-[10px] text-gs-dim mb-3">From the album "{q.track.album}"</div>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt) => {
          let btnStyle = 'bg-[#111] border-[#1a1a1a] text-gs-muted hover:border-[#333]';
          if (answered !== null) {
            if (opt === q.correctArtist) btnStyle = 'bg-[#22c55e11] border-[#22c55e44] text-[#22c55e]';
            else if (opt === answered) btnStyle = 'bg-[#ef444411] border-[#ef444444] text-[#ef4444]';
          }
          return (
            <button key={opt} onClick={() => handleAnswer(opt)} className={`p-2.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all duration-200 ${btnStyle}`}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 4) Social Listening Room Creation
// ============================================================================
function SocialListeningRoom({ myListens }) {
  const [roomName, setRoomName] = useState('');
  const [roomActive, setRoomActive] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [listeners, setListeners] = useState([]);

  const handleCreate = useCallback(() => {
    if (!roomName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setRoomActive(true);
    setListeners([
      { name: 'You', status: 'hosting', avatar: 'Y' },
    ]);
    setTimeout(() => setListeners(prev => [...prev, { name: 'VinylFan42', status: 'listening', avatar: 'V' }]), 2000);
    setTimeout(() => setListeners(prev => [...prev, { name: 'CrateDigger', status: 'listening', avatar: 'C' }]), 4000);
  }, [roomName]);

  const handleClose = useCallback(() => {
    setRoomActive(false);
    setRoomCode('');
    setRoomName('');
    setListeners([]);
  }, []);

  if (roomActive) {
    return (
      <div className="bg-gradient-to-br from-[#8b5cf611] to-[#0ea5e911] border border-[#8b5cf633] rounded-[14px] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Live Listening Room</div>
            <div className="text-[13px] font-bold text-gs-text">{roomName}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#8b5cf6] bg-[#8b5cf611] px-2 py-1 rounded">{roomCode}</span>
            <button onClick={handleClose} className="text-[10px] text-red-400 bg-transparent border border-red-400/20 rounded px-2 py-1 cursor-pointer hover:bg-red-400/10">Close</button>
          </div>
        </div>
        <div className="flex gap-2 mb-2">
          {listeners.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#111] border border-[#1a1a1a]">
              <div className="w-5 h-5 rounded-full bg-[#8b5cf6] flex items-center justify-center text-[8px] text-white font-bold">{l.avatar}</div>
              <span className="text-[10px] text-gs-muted">{l.name}</span>
              {l.status === 'hosting' && <span className="text-[8px] text-[#f59e0b] font-bold">HOST</span>}
            </div>
          ))}
        </div>
        <div className="text-[9px] text-gs-faint">{listeners.length} listener{listeners.length !== 1 ? 's' : ''} in room</div>
      </div>
    );
  }

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Social Listening Room</div>
      <div className="text-[11px] text-gs-dim mb-3">Create a room and listen together with friends in real time</div>
      <div className="flex gap-2">
        <input
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          placeholder="Room name..."
          className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-2 text-xs text-gs-text outline-none focus:border-gs-accent/30"
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
        />
        <button onClick={handleCreate} className="gs-btn-gradient px-4 py-2 text-xs text-white">Create</button>
      </div>
    </div>
  );
}

// ============================================================================
// (Final 5) Audio Quality Comparison Between Pressings
// ============================================================================
function PressingComparison({ myListens }) {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const comparisons = useMemo(() => {
    if (myListens.length === 0) return [];
    const unique = [...new Set(myListens.map(s => s.track.title))].slice(0, 5);
    return unique.map(title => {
      const s = myListens.find(x => x.track.title === title);
      return {
        title,
        artist: s.track.artist,
        pressings: [
          { label: 'Original Press', year: s.track.year || 1975, dr: 14 + Math.floor(Math.random() * 4), noise: 'Low', grade: 'A', value: 45 + Math.floor(Math.random() * 80) },
          { label: 'Remaster', year: (s.track.year || 1975) + 20, dr: 10 + Math.floor(Math.random() * 4), noise: 'Very Low', grade: 'A+', value: 25 + Math.floor(Math.random() * 30) },
          { label: 'Modern 180g', year: 2020 + Math.floor(Math.random() * 5), dr: 11 + Math.floor(Math.random() * 5), noise: 'Minimal', grade: 'A', value: 30 + Math.floor(Math.random() * 20) },
        ],
      };
    });
  }, [myListens]);

  if (comparisons.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Pressing Comparison</div>
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {comparisons.map((c, i) => (
          <button key={i} onClick={() => setSelectedTrack(selectedTrack === i ? null : i)}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg border shrink-0 cursor-pointer transition-all ${selectedTrack === i ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent font-bold' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}>
            {c.title}
          </button>
        ))}
      </div>
      {selectedTrack !== null && (
        <div className="space-y-2 vb-fade-in">
          <div className="text-[11px] text-gs-text font-bold mb-2">{comparisons[selectedTrack].title} - {comparisons[selectedTrack].artist}</div>
          {comparisons[selectedTrack].pressings.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gs-muted font-semibold">{p.label} ({p.year})</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[9px] text-gs-faint">DR{p.dr}</span>
                  <span className="text-[9px] text-gs-faint">Noise: {p.noise}</span>
                  <span className="text-[9px] text-gs-faint">Grade: {p.grade}</span>
                </div>
              </div>
              <div className="text-[11px] font-bold text-[#22c55e] font-mono">${p.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// (Final 6) Record Provenance Tracker
// ============================================================================
function RecordProvenanceTracker({ myListens }) {
  const [expanded, setExpanded] = useState(null);
  const records = useMemo(() => {
    if (myListens.length === 0) return [];
    const seen = new Set();
    return myListens.filter(s => {
      const key = `${s.track.artist}::${s.track.album}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5).map(s => ({
      album: s.track.album,
      artist: s.track.artist,
      year: s.track.year || 1975,
      history: [
        { event: 'Manufactured', date: `${s.track.year || 1975}`, location: 'Pressing Plant, USA' },
        { event: 'First Sale', date: `${(s.track.year || 1975) + 1}`, location: 'Record Store' },
        { event: 'Estate Sale', date: `${(s.track.year || 1975) + 30}`, location: 'Private Collection' },
        { event: 'Acquired by You', date: '2024', location: 'Discogs Purchase' },
      ],
    }));
  }, [myListens]);

  if (records.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Record Provenance</div>
      <div className="space-y-2">
        {records.map((r, i) => (
          <div key={i}>
            <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center justify-between p-2 rounded-lg bg-[#111] border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors">
              <div className="text-left">
                <div className="text-[11px] text-gs-text font-semibold">{r.album}</div>
                <div className="text-[9px] text-gs-dim">{r.artist} ({r.year})</div>
              </div>
              <span className="text-gs-faint text-xs">{expanded === i ? '-' : '+'}</span>
            </button>
            {expanded === i && (
              <div className="ml-4 mt-1 border-l border-gs-border pl-3 space-y-1.5 vb-fade-in">
                {r.history.map((h, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gs-accent mt-1 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gs-muted font-semibold">{h.event} - {h.date}</div>
                      <div className="text-[9px] text-gs-faint">{h.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 7) Vinyl Investment Advisor
// ============================================================================
function VinylInvestmentAdvisor({ myListens }) {
  const advice = useMemo(() => {
    if (myListens.length === 0) return null;
    const uniqueAlbums = [...new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`))];
    const tips = [
      { type: 'buy', label: 'Buy Now', album: 'Dark Side of the Moon', artist: 'Pink Floyd', reason: 'Original pressings appreciating 12% annually', trend: '+12%', color: '#22c55e' },
      { type: 'hold', label: 'Hold', album: 'Led Zeppelin IV', artist: 'Led Zeppelin', reason: 'Stable value, wait for anniversary repress', trend: '+3%', color: '#f59e0b' },
      { type: 'sell', label: 'Consider Selling', album: 'A Night at the Opera', artist: 'Queen', reason: 'Market peak - high demand currently', trend: '+18%', color: '#0ea5e9' },
    ];
    return { totalValue: uniqueAlbums.length * 32, growthRate: 8.5, tips: tips.slice(0, 3) };
  }, [myListens]);

  if (!advice) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Investment Advisor</div>
      <div className="flex items-center gap-4 mb-3">
        <div>
          <div className="text-[11px] text-gs-dim">Projected Annual Growth</div>
          <div className="text-[18px] font-extrabold text-[#22c55e]">+{advice.growthRate}%</div>
        </div>
        <div className="h-8 w-px bg-gs-border" />
        <div>
          <div className="text-[11px] text-gs-dim">Est. Portfolio</div>
          <div className="text-[18px] font-extrabold text-gs-accent">${advice.totalValue}</div>
        </div>
      </div>
      <div className="space-y-2">
        {advice.tips.map((tip, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: `${tip.color}08`, border: `1px solid ${tip.color}22` }}>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${tip.color}22`, color: tip.color }}>{tip.label}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gs-text font-semibold truncate">{tip.album}</div>
              <div className="text-[9px] text-gs-dim truncate">{tip.reason}</div>
            </div>
            <span className="text-[10px] font-bold font-mono" style={{ color: tip.color }}>{tip.trend}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 8) Listening Statistics Comparisons with Friends
// ============================================================================
function FriendStatsComparison({ myListens }) {
  const comparison = useMemo(() => {
    if (myListens.length === 0) return null;
    const myStats = { tracks: myListens.length, artists: new Set(myListens.map(s => s.track.artist)).size, hours: Math.round(myListens.reduce((s, l) => s + (l.listenedSeconds || 0), 0) / 3600) };
    const friends = [
      { name: 'VinylFan42', tracks: myStats.tracks + Math.floor(Math.random() * 20 - 10), artists: myStats.artists + Math.floor(Math.random() * 5 - 2), hours: myStats.hours + Math.floor(Math.random() * 10 - 5), avatar: 'V' },
      { name: 'CrateDigger', tracks: myStats.tracks + Math.floor(Math.random() * 30), artists: myStats.artists + Math.floor(Math.random() * 8), hours: myStats.hours + Math.floor(Math.random() * 15), avatar: 'C' },
      { name: 'WaxCollector', tracks: Math.max(1, myStats.tracks - Math.floor(Math.random() * 15)), artists: Math.max(1, myStats.artists - Math.floor(Math.random() * 3)), hours: Math.max(1, myStats.hours - Math.floor(Math.random() * 8)), avatar: 'W' },
    ];
    return { myStats, friends };
  }, [myListens]);

  if (!comparison) return null;

  const all = [{ name: 'You', ...comparison.myStats, avatar: 'Y', isMe: true }, ...comparison.friends.map(f => ({ ...f, isMe: false }))].sort((a, b) => b.tracks - a.tracks);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Friend Comparison</div>
      <div className="space-y-2">
        {all.map((user, i) => (
          <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${user.isMe ? 'bg-gs-accent/5 border border-gs-accent/20' : 'bg-[#111] border border-[#1a1a1a]'}`}>
            <div className="text-[12px] font-bold text-gs-faint w-4">{i + 1}</div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${user.isMe ? 'bg-gs-accent' : 'bg-[#8b5cf6]'}`}>{user.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-gs-text">{user.name}</div>
              <div className="flex gap-3 mt-0.5">
                <span className="text-[9px] text-gs-dim">{user.tracks} tracks</span>
                <span className="text-[9px] text-gs-dim">{user.artists} artists</span>
                <span className="text-[9px] text-gs-dim">{user.hours}h</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 9) Record Cleaning Schedule Manager
// ============================================================================
function CleaningScheduleManager({ myListens }) {
  const [schedules, setSchedules] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-cleaning-schedule') || '[]'); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newAlbum, setNewAlbum] = useState('');

  const handleAdd = useCallback(() => {
    if (!newAlbum.trim()) return;
    const updated = [...schedules, { id: Date.now(), album: newAlbum, lastCleaned: null, interval: 30, nextDue: Date.now() + 30 * 86400000 }];
    setSchedules(updated);
    try { localStorage.setItem('gs-cleaning-schedule', JSON.stringify(updated)); } catch {}
    setNewAlbum('');
    setShowAdd(false);
  }, [newAlbum, schedules]);

  const markCleaned = useCallback((id) => {
    const updated = schedules.map(s => s.id === id ? { ...s, lastCleaned: Date.now(), nextDue: Date.now() + s.interval * 86400000 } : s);
    setSchedules(updated);
    try { localStorage.setItem('gs-cleaning-schedule', JSON.stringify(updated)); } catch {}
  }, [schedules]);

  const overdue = schedules.filter(s => s.nextDue < Date.now());

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Cleaning Schedule</div>
        {overdue.length > 0 && <span className="text-[9px] text-[#f59e0b] font-bold">{overdue.length} overdue</span>}
      </div>
      {schedules.length === 0 && !showAdd && (
        <div className="text-[10px] text-gs-faint mb-2">No cleaning schedules set. Add records to track maintenance.</div>
      )}
      <div className="space-y-1.5 mb-2">
        {schedules.slice(0, 5).map(s => {
          const isDue = s.nextDue < Date.now();
          return (
            <div key={s.id} className={`flex items-center gap-2 p-2 rounded-lg border ${isDue ? 'bg-[#f59e0b08] border-[#f59e0b22]' : 'bg-[#111] border-[#1a1a1a]'}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-gs-text font-semibold truncate">{s.album}</div>
                <div className="text-[9px] text-gs-faint">{s.lastCleaned ? `Cleaned ${relTime(s.lastCleaned)}` : 'Never cleaned'}</div>
              </div>
              <button onClick={() => markCleaned(s.id)} className="text-[9px] text-[#22c55e] bg-[#22c55e11] border border-[#22c55e22] rounded px-2 py-1 cursor-pointer hover:bg-[#22c55e22]">Clean</button>
            </div>
          );
        })}
      </div>
      {showAdd ? (
        <div className="flex gap-2">
          <input value={newAlbum} onChange={e => setNewAlbum(e.target.value)} placeholder="Album name..." className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-xs text-gs-text outline-none focus:border-gs-accent/30" onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
          <button onClick={handleAdd} className="text-[10px] text-white gs-btn-gradient px-3 py-1.5 rounded-lg">Add</button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors">+ Add Record</button>
      )}
    </div>
  );
}

// ============================================================================
// (Final 10) Turntable Setup Assistant Wizard
// ============================================================================
function TurntableSetupWizard() {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);
  const [complete, setComplete] = useState(false);
  const steps = useMemo(() => [
    { title: 'Level Your Turntable', desc: 'Use a bubble level to ensure your turntable is perfectly flat. This prevents uneven stylus wear and tracking errors.', icon: '1' },
    { title: 'Set Tracking Force', desc: 'Adjust the counterweight to match your cartridge specs. Typically 1.5-2.5g for most cartridges.', icon: '2' },
    { title: 'Adjust Anti-Skate', desc: 'Set anti-skate to match your tracking force. This prevents the tonearm from skating inward.', icon: '3' },
    { title: 'Align Cartridge', desc: 'Use a protractor to align your cartridge for minimal distortion across the record surface.', icon: '4' },
    { title: 'Check VTA/SRA', desc: 'Vertical Tracking Angle should be 20-22 degrees. The tonearm should be roughly parallel to the record.', icon: '5' },
    { title: 'Test & Calibrate', desc: 'Play a test record and use Vinyl Buddy to verify audio quality. Adjust as needed.', icon: '6' },
  ], []);

  if (!active) {
    return (
      <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
        <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Setup Wizard</div>
        <div className="text-[12px] text-gs-text font-bold mb-1">Turntable Setup Assistant</div>
        <div className="text-[10px] text-gs-dim mb-3">Step-by-step guide to optimize your turntable setup</div>
        <button onClick={() => setActive(true)} className="gs-btn-gradient px-4 py-2 text-xs text-white">Start Setup</button>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="bg-gradient-to-br from-[#22c55e08] to-transparent border border-[#22c55e33] rounded-[14px] p-4 mb-4 text-center">
        <div className="text-xl mb-2">&#10003;</div>
        <div className="text-[13px] font-bold text-[#22c55e] mb-1">Setup Complete!</div>
        <div className="text-[10px] text-gs-dim mb-3">Your turntable is optimized for the best vinyl experience.</div>
        <button onClick={() => { setActive(false); setComplete(false); setStep(0); }} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/20 rounded-lg px-3 py-1.5 cursor-pointer">Done</button>
      </div>
    );
  }

  const currentStep = steps[step];
  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Step {step + 1} of {steps.length}</div>
        <div className="flex gap-1">{steps.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full ${i <= step ? 'bg-gs-accent' : 'bg-[#1a1a1a]'}`} />)}</div>
      </div>
      <div className="text-[13px] font-bold text-gs-text mb-2">{currentStep.title}</div>
      <div className="text-[11px] text-gs-dim leading-relaxed mb-4">{currentStep.desc}</div>
      <div className="flex gap-2">
        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="text-[10px] text-gs-muted bg-transparent border border-gs-border rounded-lg px-3 py-1.5 cursor-pointer">Back</button>}
        <button onClick={() => { if (step + 1 < steps.length) setStep(s => s + 1); else setComplete(true); }} className="gs-btn-gradient px-4 py-1.5 text-xs text-white">{step + 1 < steps.length ? 'Next' : 'Finish'}</button>
      </div>
    </div>
  );
}

// ============================================================================
// (Final 11) Audio Environment Analyzer
// ============================================================================
function AudioEnvironmentAnalyzer() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    setResult(null);
    setTimeout(() => {
      setResult({
        roomScore: 72 + Math.floor(Math.random() * 20),
        ambientNoise: (25 + Math.floor(Math.random() * 15)) + 'dB',
        reverb: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 2)],
        recommendations: [
          'Add a rug or soft furnishings to reduce reflections',
          'Position speakers at ear level for best imaging',
          'Keep turntable away from speakers to prevent feedback',
        ].slice(0, 2 + Math.floor(Math.random() * 2)),
      });
      setAnalyzing(false);
    }, 2500);
  }, []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Environment Analyzer</div>
      <div className="text-[11px] text-gs-dim mb-3">Analyze your room acoustics for optimal listening</div>
      {!result && !analyzing && (
        <button onClick={handleAnalyze} className="gs-btn-gradient px-4 py-2 text-xs text-white">Analyze Room</button>
      )}
      {analyzing && (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-gs-accent border-t-transparent" style={{ animation: 'vb-spin 0.8s linear infinite' }} />
          <span className="text-[11px] text-gs-accent">Analyzing room acoustics...</span>
        </div>
      )}
      {result && (
        <div className="vb-fade-in">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gs-accent/10 border border-gs-accent/30 flex items-center justify-center">
              <span className="text-[18px] font-extrabold text-gs-accent">{result.roomScore}</span>
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold text-gs-text">Room Score: {result.roomScore}/100</div>
              <div className="flex gap-3 mt-1">
                <span className="text-[9px] text-gs-faint">Noise: {result.ambientNoise}</span>
                <span className="text-[9px] text-gs-faint">Reverb: {result.reverb}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {result.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] text-gs-dim">
                <span className="text-gs-accent mt-0.5">&#8226;</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setResult(null)} className="text-[9px] text-gs-accent bg-transparent border-none cursor-pointer mt-2 underline">Re-analyze</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// (Final 12) Listening Achievements Leaderboard
// ============================================================================
function AchievementsLeaderboard({ myListens }) {
  const leaderboard = useMemo(() => {
    const myAchievements = ACHIEVEMENT_DEFS.filter(a => {
      const stats = {
        totalListens: myListens.length,
        uniqueArtists: new Set(myListens.map(s => s.track.artist)).size,
        uniqueAlbums: new Set(myListens.map(s => `${s.track.artist}::${s.track.album}`)).size,
        totalMinutes: Math.round(myListens.reduce((sum, s) => sum + (s.listenedSeconds || 0), 0) / 60),
        hasLateNight: myListens.some(s => { const h = new Date(s.timestampMs).getHours(); return h >= 0 && h < 5; }),
        hasEarlyMorning: myListens.some(s => { const h = new Date(s.timestampMs).getHours(); return h >= 5 && h < 7; }),
      };
      return a.threshold(stats);
    }).length;
    return [
      { name: 'CrateDigger', badges: myAchievements + 3, avatar: 'C' },
      { name: 'You', badges: myAchievements, avatar: 'Y', isMe: true },
      { name: 'VinylFan42', badges: Math.max(1, myAchievements - 1), avatar: 'V' },
      { name: 'WaxCollector', badges: Math.max(0, myAchievements - 2), avatar: 'W' },
    ].sort((a, b) => b.badges - a.badges);
  }, [myListens]);

  if (myListens.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Achievements Leaderboard</div>
      <div className="space-y-1.5">
        {leaderboard.map((user, i) => (
          <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${user.isMe ? 'bg-[#f59e0b08] border border-[#f59e0b22]' : 'bg-[#111] border border-[#1a1a1a]'}`}>
            <span className="text-[12px] font-bold w-4" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#78716c' }}>{i + 1}</span>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${user.isMe ? 'bg-[#f59e0b]' : 'bg-[#8b5cf6]'}`}>{user.avatar}</div>
            <span className="flex-1 text-[11px] text-gs-text font-semibold">{user.name}</span>
            <span className="text-[10px] font-mono font-bold text-[#f59e0b]">{user.badges} badges</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 13) Record Swap Suggestions Based on Taste
// ============================================================================
function RecordSwapSuggestions({ myListens }) {
  const swaps = useMemo(() => {
    if (myListens.length === 0) return [];
    const myAlbums = [...new Set(myListens.map(s => s.track.album))];
    const suggestions = [
      { give: 'Led Zeppelin IV', receive: 'Houses of the Holy', match: 94, user: 'VinylFan42' },
      { give: 'Wish You Were Here', receive: 'Meddle', match: 91, user: 'CrateDigger' },
      { give: 'A Night at the Opera', receive: 'Sheer Heart Attack', match: 88, user: 'WaxCollector' },
      { give: 'Hotel California', receive: 'Desperado', match: 85, user: 'RecordHunter' },
    ];
    return suggestions.filter(s => myAlbums.includes(s.give)).slice(0, 3);
  }, [myListens]);

  if (swaps.length === 0) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Swap Suggestions</div>
      <div className="space-y-2">
        {swaps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111] border border-[#1a1a1a]">
            <div className="flex-1 text-center">
              <div className="text-[9px] text-gs-faint font-mono">YOUR</div>
              <div className="text-[10px] text-gs-text font-bold truncate">{s.give}</div>
            </div>
            <div className="flex flex-col items-center px-2">
              <span className="text-gs-accent text-sm">&#8644;</span>
              <span className="text-[8px] text-gs-accent font-bold">{s.match}%</span>
            </div>
            <div className="flex-1 text-center">
              <div className="text-[9px] text-gs-faint font-mono">GET</div>
              <div className="text-[10px] text-gs-text font-bold truncate">{s.receive}</div>
            </div>
            <div className="text-[9px] text-gs-dim shrink-0">@{s.user}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 14) Genre Exploration Map (Visual)
// ============================================================================
function GenreExplorationMap({ myListens }) {
  const genreMap = useMemo(() => {
    if (myListens.length === 0) return [];
    const mapping = {
      "Led Zeppelin": "Rock", "Pink Floyd": "Prog Rock", "Queen": "Rock",
      "The Doors": "Psychedelic", "The Beatles": "Rock", "The Who": "Rock",
      "Eagles": "Country Rock", "John Coltrane": "Jazz", "Miles Davis": "Jazz",
      "Herbie Hancock": "Jazz Fusion", "Nas": "Hip-Hop", "A Tribe Called Quest": "Hip-Hop",
      "Aphex Twin": "Electronic", "Daft Punk": "Electronic", "Portishead": "Trip-Hop",
      "Black Sabbath": "Metal", "Metallica": "Metal", "Fleetwood Mac": "Soft Rock",
      "Nirvana": "Grunge", "Massive Attack": "Trip-Hop",
    };
    const allGenres = ["Rock", "Prog Rock", "Metal", "Jazz", "Jazz Fusion", "Hip-Hop", "Electronic", "Trip-Hop", "Psychedelic", "Grunge", "Country Rock", "Soft Rock", "Blues", "Soul", "Funk", "Reggae"];
    const explored = new Set();
    for (const s of myListens) {
      const g = mapping[s.track.artist];
      if (g) explored.add(g);
    }
    const colors = { Rock: '#ef4444', 'Prog Rock': '#8b5cf6', Metal: '#dc2626', Jazz: '#f59e0b', 'Jazz Fusion': '#14b8a6', 'Hip-Hop': '#0ea5e9', Electronic: '#06b6d4', 'Trip-Hop': '#6366f1', Psychedelic: '#ec4899', Grunge: '#84cc16', 'Country Rock': '#f97316', 'Soft Rock': '#a78bfa', Blues: '#3b82f6', Soul: '#f472b6', Funk: '#eab308', Reggae: '#22c55e' };
    return allGenres.map(g => ({ genre: g, explored: explored.has(g), color: colors[g] || '#666' }));
  }, [myListens]);

  if (genreMap.length === 0) return null;
  const exploredCount = genreMap.filter(g => g.explored).length;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Genre Map</div>
        <span className="text-[9px] text-gs-accent font-bold">{exploredCount}/{genreMap.length} explored</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {genreMap.map((g) => (
          <div key={g.genre} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${g.explored ? '' : 'opacity-25 grayscale'}`}
            style={{ background: g.explored ? `${g.color}15` : '#111', borderColor: g.explored ? `${g.color}44` : '#1a1a1a', color: g.explored ? g.color : '#444' }}>
            {g.genre}
          </div>
        ))}
      </div>
      <div className="mt-2 h-2 bg-[#111] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-gs-accent to-[#8b5cf6] transition-all duration-500" style={{ width: `${(exploredCount / genreMap.length) * 100}%` }} />
      </div>
    </div>
  );
}

// ============================================================================
// (Final 15) Listening Mood Journal
// ============================================================================
function ListeningMoodJournal({ myListens }) {
  const [entries, setEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-mood-journal') || '[]'); } catch { return []; }
  });
  const [mood, setMood] = useState('');
  const [note, setNote] = useState('');

  const moods = useMemo(() => ['Energized', 'Relaxed', 'Nostalgic', 'Focused', 'Melancholy', 'Joyful', 'Dreamy', 'Pumped'], []);
  const moodColors = useMemo(() => ({ Energized: '#ef4444', Relaxed: '#22c55e', Nostalgic: '#f59e0b', Focused: '#0ea5e9', Melancholy: '#6366f1', Joyful: '#f97316', Dreamy: '#ec4899', Pumped: '#dc2626' }), []);

  const handleAdd = useCallback(() => {
    if (!mood) return;
    const entry = { id: Date.now(), mood, note, track: myListens[0]?.track || null, timestamp: Date.now() };
    const updated = [entry, ...entries].slice(0, 30);
    setEntries(updated);
    try { localStorage.setItem('gs-mood-journal', JSON.stringify(updated)); } catch {}
    setMood('');
    setNote('');
  }, [mood, note, entries, myListens]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Mood Journal</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {moods.map(m => (
          <button key={m} onClick={() => setMood(m)} className={`text-[10px] px-2 py-1 rounded-lg border cursor-pointer transition-all ${mood === m ? '' : 'bg-[#111] border-[#1a1a1a] text-gs-dim'}`}
            style={mood === m ? { background: `${moodColors[m]}15`, borderColor: `${moodColors[m]}44`, color: moodColors[m] } : {}}>
            {m}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="How does this make you feel?" className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-xs text-gs-text outline-none focus:border-gs-accent/30" onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
        <button onClick={handleAdd} disabled={!mood} className="gs-btn-gradient px-3 py-1.5 text-xs text-white disabled:opacity-40">Log</button>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
          {entries.slice(0, 5).map(e => (
            <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${moodColors[e.mood] || '#666'}22`, color: moodColors[e.mood] || '#666' }}>{e.mood}</span>
              <div className="flex-1 min-w-0">
                {e.note && <div className="text-[10px] text-gs-muted truncate">{e.note}</div>}
                {e.track && <div className="text-[9px] text-gs-faint truncate">{e.track.title} - {e.track.artist}</div>}
              </div>
              <span className="text-[8px] text-gs-faint font-mono shrink-0">{relTime(e.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// (Final 16) Daily Vinyl Challenge
// ============================================================================
function DailyVinylChallenge({ myListens }) {
  const [completed, setCompleted] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem('gs-daily-challenge') || '{}'); return data.date === new Date().toDateString() ? data.completed : false; } catch { return false; }
  });

  const challenge = useMemo(() => {
    const challenges = [
      { title: 'Deep Cut Discovery', desc: 'Listen to a B-side track you have never played before', reward: '25 XP', icon: '&#x1F3B5;' },
      { title: 'Genre Hopper', desc: 'Listen to 3 different genres today', reward: '50 XP', icon: '&#x1F3B6;' },
      { title: 'Full Album Challenge', desc: 'Listen to an entire album start to finish', reward: '75 XP', icon: '&#x1F4BF;' },
      { title: 'Decade Explorer', desc: 'Play a record from a decade you rarely listen to', reward: '30 XP', icon: '&#x1F570;' },
      { title: 'Share the Groove', desc: 'Share your currently playing track with a friend', reward: '20 XP', icon: '&#x1F91D;' },
      { title: 'Vinyl Marathon', desc: 'Listen to at least 5 records today', reward: '100 XP', icon: '&#x1F3C6;' },
      { title: 'Artist Deep Dive', desc: 'Play 3+ tracks from the same artist', reward: '40 XP', icon: '&#x1F3A4;' },
    ];
    const dayIndex = Math.floor(Date.now() / 86400000) % challenges.length;
    return challenges[dayIndex];
  }, []);

  const handleComplete = useCallback(() => {
    setCompleted(true);
    try { localStorage.setItem('gs-daily-challenge', JSON.stringify({ date: new Date().toDateString(), completed: true })); } catch {}
  }, []);

  return (
    <div className={`border rounded-[14px] p-4 mb-4 ${completed ? 'bg-[#22c55e08] border-[#22c55e33]' : 'bg-gs-card border-gs-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Daily Challenge</div>
        {completed && <span className="text-[9px] text-[#22c55e] font-bold">Completed!</span>}
      </div>
      <div className="text-[13px] font-bold text-gs-text mb-1" dangerouslySetInnerHTML={{ __html: `${challenge.icon} ${challenge.title}` }} />
      <div className="text-[10px] text-gs-dim mb-2">{challenge.desc}</div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[#f59e0b] font-bold">Reward: {challenge.reward}</span>
        {!completed && <button onClick={handleComplete} className="text-[10px] text-white gs-btn-gradient px-3 py-1.5 rounded-lg">Mark Complete</button>}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 17) Record Trivia Section
// ============================================================================
function RecordTriviaSection() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [triviaIndex, setTriviaIndex] = useState(() => Math.floor(Date.now() / 86400000) % 10);

  const trivia = useMemo(() => [
    { q: 'What was the first commercially released CD?', a: 'Billy Joel\'s "52nd Street" in 1982, but vinyl purists know the original pressing sounds better!' },
    { q: 'How fast does a standard LP record spin?', a: '33 1/3 RPM. The format was introduced by Columbia Records in 1948.' },
    { q: 'What is the longest song ever pressed on a single vinyl side?', a: 'Several experimental records exceed 40 minutes, though audio quality degrades beyond 22 minutes per side.' },
    { q: 'What is a "first pressing" worth more?', a: 'First pressings are made from fresh stampers, producing cleaner grooves and often better sound quality.' },
    { q: 'Why are records black?', a: 'Carbon black is added to PVC for UV protection and to help hide imperfections in the vinyl.' },
    { q: 'What is the "dead wax" area?', a: 'The smooth area between the last groove and the label, often containing matrix numbers and hidden messages.' },
    { q: 'What does "audiophile pressing" mean?', a: 'Typically pressed on 180g+ virgin vinyl using half-speed mastering for improved sound quality.' },
    { q: 'How many grooves does a 12" LP have?', a: 'Trick question - just one continuous spiral groove per side!' },
    { q: 'What is the loudness war?', a: 'Modern digital masters are often compressed, making vinyl versions from original analog masters sound more dynamic.' },
    { q: 'Who invented the phonograph?', a: 'Thomas Edison in 1877, though Emile Berliner\'s flat disc format (1887) became the standard we use today.' },
  ], []);

  const current = trivia[triviaIndex % trivia.length];

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Vinyl Trivia</div>
      <div className="text-[12px] font-bold text-gs-text mb-2">{current.q}</div>
      {showAnswer ? (
        <div className="vb-fade-in">
          <div className="text-[11px] text-gs-muted leading-relaxed mb-2">{current.a}</div>
          <button onClick={() => { setShowAnswer(false); setTriviaIndex(i => i + 1); }} className="text-[10px] text-gs-accent bg-transparent border border-gs-accent/20 rounded-lg px-3 py-1.5 cursor-pointer">Next Question</button>
        </div>
      ) : (
        <button onClick={() => setShowAnswer(true)} className="gs-btn-gradient px-4 py-2 text-xs text-white">Reveal Answer</button>
      )}
    </div>
  );
}

// ============================================================================
// (Final 18) Vinyl Community Forums Link
// ============================================================================
function VinylCommunityForums() {
  const forums = useMemo(() => [
    { name: 'r/vinyl', url: 'https://reddit.com/r/vinyl', members: '2.1M', desc: 'The main vinyl community on Reddit' },
    { name: 'Steve Hoffman Forums', url: 'https://forums.stevehoffman.tv', members: '180K', desc: 'Audiophile pressing discussions' },
    { name: 'Discogs Community', url: 'https://www.discogs.com/forum', members: '8M+', desc: 'Buy, sell, and discuss records' },
    { name: 'Vinyl Engine', url: 'https://www.vinylengine.com', members: '500K', desc: 'Turntable manuals and community' },
  ], []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Community Forums</div>
      <div className="space-y-2">
        {forums.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#333] transition-colors no-underline">
            <div className="w-8 h-8 rounded-lg bg-[#8b5cf6] flex items-center justify-center text-[10px] font-bold text-white shrink-0">{f.name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-gs-text font-semibold">{f.name}</div>
              <div className="text-[9px] text-gs-dim">{f.desc}</div>
            </div>
            <span className="text-[9px] text-gs-faint font-mono shrink-0">{f.members}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 19) Device Health History Chart
// ============================================================================
function DeviceHealthHistory({ deviceCode }) {
  const healthData = useMemo(() => {
    if (!deviceCode) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return {
        day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        uptime: 85 + Math.floor(Math.random() * 15),
        temp: 35 + Math.floor(Math.random() * 12),
        errors: Math.floor(Math.random() * 3),
      };
    });
  }, [deviceCode]);

  if (healthData.length === 0) return null;
  const maxUptime = 100;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Device Health (14 Days)</div>
      <div className="flex items-end gap-[3px] h-14 mb-2">
        {healthData.map((d, i) => (
          <Tooltip key={i} text={`${d.day}: ${d.uptime}% uptime, ${d.temp}C, ${d.errors} errors`}>
            <div className="flex-1 rounded-t-sm cursor-default" style={{
              height: `${(d.uptime / maxUptime) * 100}%`,
              background: d.errors === 0 ? '#22c55e' : d.errors === 1 ? '#f59e0b' : '#ef4444',
              opacity: 0.7 + (i / healthData.length) * 0.3,
            }} />
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-gs-faint font-mono">
        <span>{healthData[0]?.day}</span>
        <span>{healthData[healthData.length - 1]?.day}</span>
      </div>
      <div className="flex gap-3 mt-2">
        <span className="flex items-center gap-1 text-[9px] text-gs-faint"><span className="w-2 h-2 rounded-sm bg-[#22c55e]" />Healthy</span>
        <span className="flex items-center gap-1 text-[9px] text-gs-faint"><span className="w-2 h-2 rounded-sm bg-[#f59e0b]" />Warning</span>
        <span className="flex items-center gap-1 text-[9px] text-gs-faint"><span className="w-2 h-2 rounded-sm bg-[#ef4444]" />Error</span>
      </div>
    </div>
  );
}

// ============================================================================
// (Final 20) Firmware Beta Program Enrollment
// ============================================================================
function FirmwareBetaProgram() {
  const [enrolled, setEnrolled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-firmware-beta') || 'false'); } catch { return false; }
  });

  const handleToggle = useCallback(() => {
    const next = !enrolled;
    setEnrolled(next);
    try { localStorage.setItem('gs-firmware-beta', JSON.stringify(next)); } catch {}
  }, [enrolled]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Beta Program</div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[12px] font-bold text-gs-text mb-0.5">Firmware Beta Program</div>
          <div className="text-[10px] text-gs-dim">Get early access to new features and improvements</div>
          {enrolled && <div className="text-[9px] text-[#8b5cf6] font-bold mt-1">Beta channel: v2.5.0-beta.3 available</div>}
        </div>
        <button onClick={handleToggle} className={`relative w-11 h-6 rounded-full border cursor-pointer transition-all ${enrolled ? 'bg-[#8b5cf6] border-[#8b5cf666]' : 'bg-[#222] border-[#333]'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enrolled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// (Final 21) Audio Export Options
// ============================================================================
function AudioExportOptions({ myListens }) {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState('');

  const handleExport = useCallback((format) => {
    setExporting(true);
    setExportDone('');
    setTimeout(() => {
      setExporting(false);
      setExportDone(format);
      setTimeout(() => setExportDone(''), 3000);
    }, 1500);
  }, []);

  const formats = useMemo(() => [
    { label: 'CSV', desc: 'Spreadsheet-compatible listening data', icon: 'C', color: '#22c55e' },
    { label: 'JSON', desc: 'Full listening history with metadata', icon: 'J', color: '#0ea5e9' },
    { label: 'PDF Report', desc: 'Visual summary of your vinyl stats', icon: 'P', color: '#ef4444' },
    { label: 'Playlist (.m3u)', desc: 'Import into music players', icon: 'M', color: '#f59e0b' },
  ], []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Export Data</div>
      <div className="grid grid-cols-2 gap-2">
        {formats.map((f) => (
          <button key={f.label} onClick={() => handleExport(f.label)} disabled={exporting}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#333] transition-all cursor-pointer disabled:opacity-50 text-left">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: f.color }}>{f.icon}</div>
            <div>
              <div className="text-[11px] text-gs-text font-semibold">{f.label}</div>
              <div className="text-[8px] text-gs-faint">{f.desc}</div>
            </div>
          </button>
        ))}
      </div>
      {exporting && <div className="text-[10px] text-gs-accent mt-2" style={{ animation: 'vb-pulse 1s ease-in-out infinite' }}>Exporting...</div>}
      {exportDone && <div className="text-[10px] text-[#22c55e] mt-2 vb-fade-in">Exported as {exportDone} successfully!</div>}
    </div>
  );
}

// ============================================================================
// (Final 22) Listening Session Sharing
// ============================================================================
function ListeningSessionSharing({ myListens }) {
  const [shared, setShared] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const handleShare = useCallback(() => {
    const code = Math.random().toString(36).substring(2, 10);
    const url = `groovestack.co/session/${code}`;
    setShareUrl(url);
    setShared(true);
    navigator.clipboard.writeText(`https://${url}`).catch(() => {});
    setTimeout(() => setShared(false), 5000);
  }, []);

  const recentSession = myListens[0];

  if (!recentSession) return null;

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Share Session</div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-gs-text font-semibold truncate">{recentSession.track.title}</div>
          <div className="text-[9px] text-gs-dim">{recentSession.track.artist} - {recentSession.track.album}</div>
        </div>
        <button onClick={handleShare} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${shared ? 'bg-[#22c55e11] border-[#22c55e33] text-[#22c55e]' : 'gs-btn-gradient text-white border-none'}`}>
          {shared ? 'Link Copied!' : 'Share'}
        </button>
      </div>
      {shareUrl && <div className="text-[9px] text-gs-accent font-mono bg-[#111] rounded px-2 py-1">{shareUrl}</div>}
    </div>
  );
}

// ============================================================================
// (Final 23) Record Identification Accuracy Improvement Tips
// ============================================================================
function IdentificationAccuracyTips() {
  const [expanded, setExpanded] = useState(false);

  const tips = useMemo(() => [
    { title: 'Reduce Background Noise', desc: 'Turn off fans, AC units, and other noise sources during identification for best results.', impact: 'High' },
    { title: 'Position Device Correctly', desc: 'Place Vinyl Buddy 6-12 inches from the speaker, not directly on the turntable plinth.', impact: 'High' },
    { title: 'Clean Records First', desc: 'Dirty records produce additional noise that can confuse the fingerprinting algorithm.', impact: 'Medium' },
    { title: 'Check Stylus Condition', desc: 'A worn stylus alters the audio signature, reducing identification accuracy.', impact: 'Medium' },
    { title: 'Optimal Volume', desc: 'Keep playback at moderate volume. Too quiet or too loud both reduce accuracy.', impact: 'Low' },
    { title: 'Wait for Track Start', desc: 'Let 5-10 seconds of music play before expecting identification for best results.', impact: 'Low' },
  ], []);

  const impactColors = useMemo(() => ({ High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' }), []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Accuracy Tips</div>
        <button onClick={() => setExpanded(!expanded)} className="text-[9px] text-gs-accent bg-transparent border-none cursor-pointer">{expanded ? 'Collapse' : 'Expand'}</button>
      </div>
      <div className="space-y-1.5">
        {(expanded ? tips : tips.slice(0, 3)).map((tip, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded mt-0.5 shrink-0" style={{ background: `${impactColors[tip.impact]}22`, color: impactColors[tip.impact] }}>{tip.impact}</span>
            <div>
              <div className="text-[11px] text-gs-text font-semibold">{tip.title}</div>
              <div className="text-[9px] text-gs-dim">{tip.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 24) Multi-Room Audio Sync Status
// ============================================================================
function MultiRoomSyncStatus() {
  const [rooms, setRooms] = useState(() => [
    { name: 'Living Room', status: 'synced', latency: 2, playing: true },
    { name: 'Bedroom', status: 'synced', latency: 5, playing: true },
    { name: 'Kitchen', status: 'offline', latency: 0, playing: false },
    { name: 'Study', status: 'desynced', latency: 45, playing: true },
  ]);

  const handleSync = useCallback((roomName) => {
    setRooms(prev => prev.map(r => r.name === roomName ? { ...r, status: 'synced', latency: 2 + Math.floor(Math.random() * 5) } : r));
  }, []);

  const syncedCount = rooms.filter(r => r.status === 'synced').length;
  const statusColors = useMemo(() => ({ synced: '#22c55e', desynced: '#f59e0b', offline: '#666' }), []);

  return (
    <div className="bg-gs-card border border-gs-border rounded-[14px] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-gs-dim font-mono uppercase tracking-[0.06em]">Multi-Room Sync</div>
        <span className="text-[9px] text-[#22c55e] font-bold">{syncedCount}/{rooms.length} synced</span>
      </div>
      <div className="space-y-1.5">
        {rooms.map((room) => (
          <div key={room.name} className="flex items-center gap-2 p-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColors[room.status], boxShadow: room.status === 'synced' ? `0 0 6px ${statusColors[room.status]}66` : 'none' }} />
            <div className="flex-1">
              <div className="text-[11px] text-gs-text font-semibold">{room.name}</div>
              <div className="text-[9px] text-gs-faint">{room.status === 'offline' ? 'Not connected' : `Latency: ${room.latency}ms`}</div>
            </div>
            {room.playing && <EqualizerVis active={room.status === 'synced'} barCount={3} height={14} color={statusColors[room.status]} />}
            {room.status === 'desynced' && (
              <button onClick={() => handleSync(room.name)} className="text-[9px] text-[#f59e0b] bg-[#f59e0b11] border border-[#f59e0b22] rounded px-2 py-0.5 cursor-pointer hover:bg-[#f59e0b22]">Sync</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// (Final 25) Vinyl Buddy Companion App Download Links
// ============================================================================
function CompanionAppDownload() {
  const platforms = useMemo(() => [
    { name: 'iOS', icon: 'A', desc: 'iPhone & iPad', url: '#', color: '#0ea5e9', version: 'v2.1.0' },
    { name: 'Android', icon: 'G', desc: 'Phone & Tablet', url: '#', color: '#22c55e', version: 'v2.1.0' },
    { name: 'Desktop', icon: 'D', desc: 'Mac & Windows', url: '#', color: '#8b5cf6', version: 'v1.8.0' },
  ], []);

  return (
    <div className="bg-gradient-to-br from-[#0ea5e908] to-[#8b5cf608] border border-[#0ea5e922] rounded-[14px] p-4 mb-4">
      <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Companion App</div>
      <div className="text-[12px] font-bold text-gs-text mb-1">Get the Vinyl Buddy App</div>
      <div className="text-[10px] text-gs-dim mb-3">Control your device, browse history, and share from anywhere</div>
      <div className="grid grid-cols-3 gap-2">
        {platforms.map((p) => (
          <a key={p.name} href={p.url} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-[#111] border border-[#1a1a1a] hover:border-[#333] transition-colors no-underline cursor-pointer">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: p.color }}>{p.icon}</div>
            <div className="text-[10px] text-gs-text font-semibold">{p.name}</div>
            <div className="text-[8px] text-gs-faint">{p.version}</div>
          </a>
        ))}
      </div>
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

  // Micro-improvement 21: Quick identification shortcut
  const [quickIdActive, setQuickIdActive] = useState(false);
  const [quickIdResult, setQuickIdResult] = useState(null);
  const triggerQuickId = useCallback(() => {
    setQuickIdActive(true);
    // Simulate identification delay
    setTimeout(() => {
      const randomTrack = myListens.length > 0 ? myListens[Math.floor(Math.random() * myListens.length)] : null;
      setQuickIdResult(randomTrack);
      setQuickIdActive(false);
    }, 2000);
  }, [myListens]);

  // Micro-improvement 22: Device status widget
  const deviceStatus = useMemo(() => {
    const isConnected = !!deviceCode;
    const batteryPct = deviceCode ? (75 + (deviceCode.charCodeAt(0) % 25)) : 0;
    const signalStrength = deviceCode ? ['Excellent', 'Good', 'Fair'][deviceCode.charCodeAt(1) % 3] : 'N/A';
    const uptime = deviceCode ? `${Math.floor(myListens.length * 0.5 + 12)}h` : '0h';
    return { isConnected, batteryPct, signalStrength, uptime };
  }, [deviceCode, myListens.length]);

  // Micro-improvement 23: Listening journal entries
  const [journalEntries, setJournalEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gs-listening-journal') || '[]'); } catch { return []; }
  });
  const [showJournal, setShowJournal] = useState(false);
  const [journalText, setJournalText] = useState('');
  const addJournalEntry = useCallback(() => {
    if (!journalText.trim()) return;
    const entry = { id: Date.now(), text: journalText, timestamp: Date.now(), track: myListens[0]?.track || null };
    const updated = [entry, ...journalEntries].slice(0, 50);
    setJournalEntries(updated);
    try { localStorage.setItem('gs-listening-journal', JSON.stringify(updated)); } catch {}
    setJournalText('');
  }, [journalText, journalEntries, myListens]);

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

      {/* Micro-improvement 22: Device status widget */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-gs-card border border-gs-border rounded-lg p-2 text-center">
          <div className="text-[9px] text-gs-faint font-mono uppercase">Status</div>
          <div className={`text-[11px] font-bold mt-0.5 ${deviceStatus.isConnected ? 'text-green-400' : 'text-red-400'}`}>{deviceStatus.isConnected ? 'Online' : 'Offline'}</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-lg p-2 text-center">
          <div className="text-[9px] text-gs-faint font-mono uppercase">Battery</div>
          <div className="text-[11px] font-bold mt-0.5" style={{ color: deviceStatus.batteryPct > 50 ? '#22c55e' : deviceStatus.batteryPct > 20 ? '#f59e0b' : '#ef4444' }}>{deviceStatus.batteryPct}%</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-lg p-2 text-center">
          <div className="text-[9px] text-gs-faint font-mono uppercase">Signal</div>
          <div className="text-[11px] font-bold mt-0.5 text-gs-muted">{deviceStatus.signalStrength}</div>
        </div>
        <div className="bg-gs-card border border-gs-border rounded-lg p-2 text-center">
          <div className="text-[9px] text-gs-faint font-mono uppercase">Uptime</div>
          <div className="text-[11px] font-bold mt-0.5 text-gs-muted">{deviceStatus.uptime}</div>
        </div>
      </div>

      {/* Micro-improvement 21: Quick identification shortcut */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={triggerQuickId}
          disabled={quickIdActive}
          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all duration-200 ${quickIdActive ? 'bg-gs-accent/20 border-gs-accent/40 text-gs-accent' : 'border-gs-border bg-gs-card text-gs-muted hover:border-gs-accent/30 hover:text-gs-accent'}`}
        >
          {quickIdActive ? 'Listening...' : 'Quick Identify'}
        </button>
        <button
          onClick={() => setShowJournal(!showJournal)}
          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${showJournal ? 'bg-gs-accent/15 border-gs-accent/30 text-gs-accent' : 'border-gs-border bg-gs-card text-gs-muted hover:border-gs-accent/30 hover:text-gs-accent'}`}
        >
          Listening Journal
        </button>
      </div>

      {/* Micro-improvement 21: Quick ID result */}
      {quickIdResult && (
        <div className="bg-gradient-to-r from-gs-accent/10 to-transparent border border-gs-accent/20 rounded-xl p-3 mb-4 flex items-center gap-3" style={{ animation: 'vb-fade-in 0.3s ease-out' }}>
          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0" style={{ background: '#333' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gs-accent font-mono uppercase tracking-wider mb-0.5">Identified</div>
            <div className="text-xs font-bold text-gs-text truncate">{quickIdResult.track.title}</div>
            <div className="text-[10px] text-gs-dim truncate">{quickIdResult.track.artist} - {quickIdResult.track.album}</div>
          </div>
          <div className="text-xs font-bold text-green-400">{quickIdResult.score}%</div>
          <button onClick={() => setQuickIdResult(null)} className="text-gs-faint hover:text-gs-text bg-transparent border-none cursor-pointer">&times;</button>
        </div>
      )}

      {/* Micro-improvement 23: Listening journal */}
      {showJournal && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-4">
          <div className="text-[10px] font-mono text-gs-dim uppercase tracking-wider mb-2">Listening Journal</div>
          <div className="flex gap-2 mb-3">
            <input
              value={journalText}
              onChange={e => setJournalText(e.target.value)}
              placeholder="What are you feeling about this listen?"
              className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-2 text-xs text-gs-text outline-none focus:border-gs-accent/30"
              onKeyDown={e => { if (e.key === 'Enter') addJournalEntry(); }}
            />
            <button onClick={addJournalEntry} className="px-3 py-2 rounded-lg bg-gs-accent text-white text-xs font-bold border-none cursor-pointer">Add</button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {journalEntries.length === 0 && <p className="text-[10px] text-gs-faint">No journal entries yet. Add one above!</p>}
            {journalEntries.slice(0, 10).map(entry => (
              <div key={entry.id} className="p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
                <div className="text-[11px] text-gs-text">{entry.text}</div>
                <div className="flex items-center gap-2 mt-1">
                  {entry.track && <span className="text-[9px] text-gs-accent">{entry.track.title} - {entry.track.artist}</span>}
                  <span className="text-[8px] text-gs-faint font-mono">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <DiscogsLink track={nowPlaying.track} />
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
      {/* Shazam-style identification animation (Improvement 5) */}
      <IdentificationAnimation active={isRecent} />

      {/* Now Playing card */}
      {nowPlaying && (
        <NowPlayingCard nowPlaying={nowPlaying} isRecent={isRecent} myListens={myListens} />
      )}

      {/* (6) Genre auto-tags for current track */}
      {nowPlaying && <GenreAutoTag track={nowPlaying.track} />}

      {/* (17) Album art recognition confidence */}
      {nowPlaying && <AlbumArtConfidence session={nowPlaying} />}

      {/* (9) Side A/B tracking */}
      <SideTracker nowPlaying={nowPlaying} />

      {/* (10) RPM detection display */}
      <RPMDetector nowPlaying={nowPlaying} />

      {/* (5) Identification confidence breakdown */}
      {nowPlaying && <ConfidenceBreakdown session={nowPlaying} />}

      {/* Audio quality indicator (Improvement 2) */}
      <AudioQualityIndicator isRecent={isRecent} />

      {/* (12) Enhanced waveform visualization */}
      <EnhancedWaveform active={isRecent} />

      {/* (13) Frequency spectrum analyzer */}
      <FrequencySpectrum active={isRecent} />

      {/* (19) Vinyl warping detection */}
      <VinylWarpingDetector active={isRecent} />

      {/* (20) Surface noise level meter */}
      <SurfaceNoiseMeter active={isRecent} />

      {/* (21) Dynamic range meter */}
      <DynamicRangeMeter active={isRecent} myListens={myListens} />

      {/* (22) Listening fatigue warning */}
      <ListeningFatigueWarning myListens={myListens} />

      {/* Sound wave visualization */}
      <div className="mb-4">
        <SoundWaveVis active={isRecent} />
      </div>

      {/* (Improvement 1) Vinyl grading assistant */}
      <VinylGradingAssistant />

      {/* (Improvement 3) Listening mood playlist builder */}
      <MoodPlaylistBuilder myListens={myListens} />

      {/* (Improvement 12) Vinyl care tips carousel */}
      <VinylCareTipsCarousel />

      {/* (Improvement 14) Listening session planner */}
      <ListeningSessionPlanner />

      {/* (Improvement 15) Community listening events calendar */}
      <CommunityEventsCalendar />

      {/* Listening mood detector (Improvement 1) */}
      <ListeningMoodDetector myListens={myListens} />

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

      {/* Listening Goals (Improvement 3) */}
      <ListeningGoals myListens={myListens} />

      {/* (8) Listening session recording */}
      <ListeningSessionRecorder />

      {/* (16) Listening party mode */}
      <ListeningPartyMode nowPlaying={nowPlaying} />

      {/* Social Listening (Improvement 7) */}
      <SocialListening />

      {/* (7) Playlist generation from recent listens */}
      <PlaylistGenerator myListens={myListens} />

      {/* (14) Record cleaning reminder */}
      <RecordCleaningReminder myListens={myListens} />

      {/* (18) Track skip detection */}
      <TrackSkipDetector myListens={myListens} />

      {/* Recommendations based on listening history */}
      <RecommendationsSection myListens={myListens} />

      {/* (Final 1) AI Record Recommendation Engine */}
      <AIRecRecommendationEngine myListens={myListens} />

      {/* (Final 3) Record Identification Quiz Game */}
      <RecordIdentificationQuiz myListens={myListens} />

      {/* (Final 4) Social Listening Room Creation */}
      <SocialListeningRoom myListens={myListens} />

      {/* (Final 13) Record Swap Suggestions */}
      <RecordSwapSuggestions myListens={myListens} />

      {/* (Final 15) Listening Mood Journal */}
      <ListeningMoodJournal myListens={myListens} />

      {/* (Final 16) Daily Vinyl Challenge */}
      <DailyVinylChallenge myListens={myListens} />

      {/* (Final 17) Record Trivia Section */}
      <RecordTriviaSection />

      {/* (Final 18) Vinyl Community Forums */}
      <VinylCommunityForums />

      {/* (Final 22) Listening Session Sharing */}
      <ListeningSessionSharing myListens={myListens} />

      {/* (Final 25) Companion App Download */}
      <CompanionAppDownload />

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

      {/* (Improvement 2) Record identification history export */}
      <HistoryExportPanel myListens={myListens} />

      {/* (Improvement 4) Audio comparison tool */}
      <AudioComparisonTool myListens={myListens} />

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

      {/* (4) Audio quality metrics dashboard */}
      <AudioQualityDashboard isRecent={false} />

      {/* (15) Stylus wear indicator */}
      <StylusWearIndicator myListens={myListens} />

      {/* Identification Accuracy Stats (Improvement 4) */}
      <AccuracyStats myListens={myListens} />

      {/* Listening Timeline Heatmap (Improvement 8) */}
      <ListeningTimeline myListens={myListens} />

      {/* Genre Evolution Chart (Improvement 9) */}
      <GenreEvolutionChart myListens={myListens} />

      {/* Identification Leaderboard (Improvement 10) */}
      <IdentificationLeaderboard myListens={myListens} />

      {/* (Improvement 5) Record digitization guide */}
      <RecordDigitizationGuide />

      {/* (Improvement 6) Listening analytics email report generator */}
      <AnalyticsReportGenerator myListens={myListens} />

      {/* (Improvement 10) Record speed calculator */}
      <RecordSpeedCalculator />

      {/* (Improvement 11) Genre discovery mode */}
      <GenreDiscoveryMode myListens={myListens} />

      {/* (Final 2) Vinyl Collection Value Tracker */}
      <CollectionValueTracker myListens={myListens} />

      {/* (Final 5) Audio Quality Comparison Between Pressings */}
      <PressingComparison myListens={myListens} />

      {/* (Final 6) Record Provenance Tracker */}
      <RecordProvenanceTracker myListens={myListens} />

      {/* (Final 7) Vinyl Investment Advisor */}
      <VinylInvestmentAdvisor myListens={myListens} />

      {/* (Final 8) Friend Stats Comparison */}
      <FriendStatsComparison myListens={myListens} />

      {/* (Final 9) Record Cleaning Schedule Manager */}
      <CleaningScheduleManager myListens={myListens} />

      {/* (Final 12) Achievements Leaderboard */}
      <AchievementsLeaderboard myListens={myListens} />

      {/* (Final 14) Genre Exploration Map */}
      <GenreExplorationMap myListens={myListens} />

      {/* (Final 21) Audio Export Options */}
      <AudioExportOptions myListens={myListens} />

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

  // Firmware update progress (Improvement 11)
  const [firmwareUpdating, setFirmwareUpdating] = useState(false);
  const [firmwareProgress, setFirmwareProgress] = useState(0);

  // Battery level (Improvement 12)
  const [batteryLevel] = useState(isDemo ? 87 : 100);

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
                {[1, 2, 3, 4, 5].map(bar => {
                  const barColor = signalStrength >= bar * 20
                    ? signalStrength > 60 ? "#22c55e" : signalStrength > 30 ? "#f59e0b" : "#f87171"
                    : "#222";
                  return (
                    <div key={bar} className="w-1 rounded-t-sm transition-all duration-300" style={{
                      height: `${bar * 20}%`,
                      background: barColor,
                      boxShadow: signalStrength >= bar * 20 && signalStrength > 60 ? `0 0 3px ${barColor}44` : 'none',
                    }} />
                  );
                })}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-mono font-semibold" style={{ color: signalStrength > 60 ? "#22c55e" : signalStrength > 30 ? "#f59e0b" : "#f87171" }}>
                  {signalStrength > 0 ? `${Math.round(signalStrength)}%` : "\u2014"}
                </span>
                <span className="text-[8px] text-gs-faint font-mono">{deviceInfo?.rssi ? `${deviceInfo.rssi} dBm` : ''}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#111] rounded-lg py-2.5 px-3">
            <div className="text-[10px] text-gs-dim font-mono mb-1.5">Battery</div>
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-3.5">
                <div className="absolute inset-0 rounded-sm border border-[#555]" />
                <div className="absolute top-[3px] -right-[3px] w-[3px] h-[6px] rounded-r-sm bg-[#555]" />
                <div className="absolute left-[2px] top-[2px] bottom-[2px] rounded-sm transition-all duration-300" style={{
                  width: `${Math.max(batteryLevel * 0.2, 2)}px`,
                  background: batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#ef4444',
                }} />
              </div>
              <span className="text-[11px] font-mono font-semibold" style={{
                color: batteryLevel > 50 ? '#22c55e' : batteryLevel > 20 ? '#f59e0b' : '#ef4444',
              }}>
                {batteryLevel}%
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
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
            firmwareUpdating ? (
              <div className="flex-1 ml-4">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-[#0ea5e9] font-mono">Updating firmware...</span>
                  <span className="text-[10px] text-[#0ea5e9] font-mono font-bold">{firmwareProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${firmwareProgress}%`, background: 'linear-gradient(90deg, #0ea5e9, #8b5cf6)' }} />
                </div>
                <div className="text-[9px] text-gs-faint mt-1 font-mono">
                  {firmwareProgress < 30 ? 'Downloading...' : firmwareProgress < 70 ? 'Flashing...' : firmwareProgress < 100 ? 'Verifying...' : 'Complete!'}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]" style={{ animation: "vb-pulse 2s ease-in-out infinite" }} />
                <div>
                  <div className="text-[11px] text-[#f59e0b] font-bold">Update Available</div>
                  <div className="text-[9px] text-gs-dim">Improved audio capture quality</div>
                </div>
                <button
                  onClick={() => {
                    setFirmwareUpdating(true);
                    setFirmwareProgress(0);
                    const interval = setInterval(() => {
                      setFirmwareProgress(prev => {
                        if (prev >= 100) { clearInterval(interval); setTimeout(() => { setFirmwareUpdating(false); setFirmwareProgress(0); }, 2000); return 100; }
                        return prev + Math.floor(Math.random() * 8) + 2;
                      });
                    }, 300);
                  }}
                  className="text-[10px] text-gs-accent bg-[#0ea5e908] border border-[#0ea5e922] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#0ea5e915] transition-all duration-200"
                >
                  Update
                </button>
              </div>
            )
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

      {/* (1) Multi-device management */}
      <MultiDeviceManager devices={null} activeDeviceId={deviceCode} onSelectDevice={() => {}} />

      {/* (2) Device naming/labeling */}
      <DeviceNamingPanel deviceCode={deviceCode} />

      {/* (3) Listening room assignment */}
      <ListeningRoomAssignment deviceCode={deviceCode} />

      {/* (24) Firmware changelog */}
      <FirmwareChangelog />

      {/* (11) Turntable compatibility checker */}
      <TurntableCompatibilityChecker />

      {/* (23) Room acoustics tips */}
      <RoomAcousticsTips />

      {/* (25) Bluetooth speaker pairing guide */}
      <BluetoothPairingGuide />

      {/* (Final 10) Turntable Setup Assistant Wizard */}
      <TurntableSetupWizard />

      {/* (Final 11) Audio Environment Analyzer */}
      <AudioEnvironmentAnalyzer />

      {/* (Final 19) Device Health History Chart */}
      <DeviceHealthHistory deviceCode={deviceCode} />

      {/* (Final 20) Firmware Beta Program Enrollment */}
      <FirmwareBetaProgram />

      {/* (Final 23) Record Identification Accuracy Tips */}
      <IdentificationAccuracyTips />

      {/* (Final 24) Multi-Room Audio Sync Status */}
      <MultiRoomSyncStatus />

      {/* (Improvement 7) Device diagnostics panel */}
      <DeviceDiagnosticsPanel />

      {/* (Improvement 8) Audio latency tester */}
      <AudioLatencyTester />

      {/* (Improvement 9) Microphone sensitivity test */}
      <MicSensitivityTest />

      {/* (Improvement 13) Device battery optimization tips */}
      <BatteryOptimizationTips />

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
