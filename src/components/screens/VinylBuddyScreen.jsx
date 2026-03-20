// Vinyl Buddy feature screen — dedicated hub for the ESP32 vinyl identification device.
// Pre-activation: landing page with feature showcase + device code activation.
// Post-activation: dashboard with Overview, History, and Device tabs.
import { useState, useEffect } from 'react';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';

const TABS = ["overview", "history", "device"];

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
  if (!s) return "—";
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function VinylBuddyScreen({ currentUser, listeningHistory, activated, deviceCode, onActivate, onDeactivate }) {
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
// PRE-ACTIVATION LANDING PAGE
// ============================================================================
function LandingPage({ onActivate }) {
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleActivate = () => {
    const trimmed = code.trim();
    if (!/^[A-Fa-f0-9]{12}$/.test(trimmed)) {
      setError("Enter a valid 12-character hex device code (e.g. AABB11223344)");
      return;
    }
    setError("");
    onActivate(trimmed.toUpperCase());
  };

  const features = [
    { icon: "\uD83C\uDFB5", title: "Track Identification", desc: "Captures audio from your turntable and identifies tracks via acoustic fingerprinting" },
    { icon: "\uD83D\uDCCA", title: "Listening Stats", desc: "Tracks your vinyl sessions — top artists, albums, and listening streaks" },
    { icon: "\uD83D\uDD17", title: "Device Sync", desc: "Real-time connection to your ESP32 device with live status and heartbeat monitoring" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text mb-0.5">Vinyl Buddy</h1>
        <p className="text-xs text-gs-dim">Your personal vinyl identification companion</p>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl p-7 mb-5 relative overflow-hidden bg-gradient-to-br from-[#0ea5e911] to-[#6366f111] border border-[#0ea5e922]">
        <div className="absolute -top-5 -right-5 w-[120px] h-[120px] rounded-full bg-[radial-gradient(circle,#0ea5e915,transparent_70%)]" />
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center text-2xl shrink-0 bg-gradient-to-br from-gs-accent to-gs-indigo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gs-text tracking-[-0.03em]">Meet Vinyl Buddy</div>
            <div className="text-[13px] text-gs-muted leading-normal mt-1">
              A tiny ESP32-powered device that sits next to your turntable, listens to your records, and identifies every track you play.
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="flex gap-2 mt-5">
          {["Place near turntable", "Music auto-detected", "Track identified in seconds"].map((step, i) => (
            <div key={i} className="flex-1 rounded-[10px] px-3 py-2.5 text-center bg-gs-sidebar/50">
              <div className="text-sm font-extrabold text-gs-accent mb-1">{i + 1}</div>
              <div className="text-[11px] text-[#777] leading-snug">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {features.map(f => (
          <div key={f.title} className="bg-gs-card border border-gs-border rounded-[14px] py-[18px] px-3.5 text-center">
            <div className="text-[28px] mb-2">{f.icon}</div>
            <div className="text-[13px] font-bold text-gs-text mb-1.5">{f.title}</div>
            <div className="text-[11px] text-[#666] leading-normal">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Activation section */}
      {!showForm ? (
        <div className="text-center py-5">
          <button
            onClick={() => setShowForm(true)}
            className="gs-btn-gradient px-9 py-3.5 text-sm tracking-[-0.02em]"
          >
            Activate Your Device
          </button>
          <p className="text-[11px] text-gs-faint mt-2.5">Already have a Vinyl Buddy? Enter your device code to get started.</p>
        </div>
      ) : (
        <div className="bg-gs-card border border-gs-border rounded-[14px] py-[22px] px-5">
          <div className="text-sm font-bold text-gs-text mb-1">Activate Your Device</div>
          <p className="text-[11px] text-[#666] mb-4 leading-normal">
            Enter the 12-character device code shown on your Vinyl Buddy's OLED screen during WiFi setup. It looks like: AABB11223344
          </p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                value={code}
                onChange={e => { setCode(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleActivate()}
                placeholder="e.g. AABB11223344"
                maxLength={12}
                className={`w-full py-[11px] px-3.5 bg-[#111] rounded-[9px] text-gs-text text-sm font-mono tracking-[0.08em] outline-none uppercase border ${error ? "border-red-500" : "border-gs-border-hover"}`}
              />
              {error && <div className="text-[11px] text-red-500 mt-1.5">{error}</div>}
            </div>
            <button onClick={handleActivate} className="gs-btn-gradient py-[11px] px-[22px] rounded-[9px] text-[13px] whitespace-nowrap">
              Activate
            </button>
          </div>
          <button onClick={() => { setShowForm(false); setCode(""); setError(""); }} className="mt-3 bg-transparent border-none text-gs-dim text-[11px] cursor-pointer p-0">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// POST-ACTIVATION DASHBOARD
// ============================================================================
function Dashboard({ currentUser, listeningHistory, deviceCode, onDeactivate }) {
  const [tab, setTab] = useState("overview");

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

  // Top artist
  const artistCounts = {};
  for (const s of myListens) {
    if (s.track.artist) artistCounts[s.track.artist] = (artistCounts[s.track.artist] || 0) + 1;
  }
  const topArtist = Object.entries(artistCounts).sort(([, a], [, b]) => b - a)[0];

  // Top track
  const trackCounts = {};
  for (const s of myListens) {
    const key = `${s.track.title} — ${s.track.artist}`;
    trackCounts[key] = (trackCounts[key] || 0) + 1;
  }
  const topTrack = Object.entries(trackCounts).sort(([, a], [, b]) => b - a)[0];
  // Find the session for the top track so we can get album info for AlbumArt
  const topTrackSession = topTrack ? myListens.find(s => `${s.track.title} — ${s.track.artist}` === topTrack[0]) : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-0.5">
          <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text">Vinyl Buddy</h1>
          <Badge label="Active" color="#22c55e" />
        </div>
        <p className="text-xs text-gs-dim">Your listening dashboard</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2.5 mb-[22px]">
        {[
          { l: "Total Listens", v: myListens.length, c: "#0ea5e9" },
          { l: "Artists", v: artists.size, c: "#8b5cf6" },
          { l: "Albums", v: albums.size, c: "#f59e0b" },
          { l: "Avg Score", v: `${avgScore}%`, c: "#22c55e" },
        ].map(s => (
          <div key={s.l} className="gs-stat bg-gs-card border border-gs-border rounded-xl">
            <div className="text-[22px] font-extrabold tracking-[-0.02em]" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[10px] text-gs-dim font-mono mt-[3px]">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#1a1a1a] mb-[18px]">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-[9px] px-4 bg-transparent border-none text-xs font-semibold cursor-pointer capitalize -mb-px border-b-2 ${
              tab === t ? "border-gs-accent text-gs-accent" : "border-transparent text-gs-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <div>
          {myListens.length === 0 ? (
            <Empty icon="\uD83C\uDFB6" text="No listening data yet. Play a record near your Vinyl Buddy to get started!" />
          ) : (
            <>
              {/* Top cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-[18px]">
                {/* Top Artist */}
                <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5 bg-gradient-to-r from-[#8b5cf6] to-transparent" />
                  <div className="p-4 px-3.5">
                    <div className="text-[10px] text-gs-dim font-mono mb-2">TOP ARTIST</div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0 bg-gradient-to-br from-[#8b5cf6] to-gs-indigo">
                        {topArtist ? topArtist[0].charAt(0).toUpperCase() : "?"}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gs-text">{topArtist ? topArtist[0] : "—"}</div>
                        <div className="text-[11px] text-[#8b5cf6]">{topArtist ? `${topArtist[1]} plays` : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Track */}
                <div className="bg-gs-card border border-gs-border rounded-[14px] overflow-hidden">
                  <div className="h-0.5 bg-gradient-to-r from-gs-accent to-transparent" />
                  <div className="p-4 px-3.5">
                    <div className="text-[10px] text-gs-dim font-mono mb-2">TOP TRACK</div>
                    <div className="flex items-center gap-2.5">
                      <AlbumArt album={topTrackSession?.track.album} artist={topTrackSession?.track.artist} accent="#0ea5e9" size={40} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">
                          {topTrack ? topTrack[0].split(" — ")[0] : "—"}
                        </div>
                        <div className="text-[11px] text-gs-accent">{topTrack ? `${topTrack[1]} plays` : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mb-2">
                <div className="text-[10px] text-gs-dim font-mono mb-2.5 uppercase tracking-[0.06em]">Recent Activity</div>
                <div className="flex flex-col gap-1.5">
                  {myListens.slice(0, 5).map(session => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        myListens.length === 0 ? (
          <Empty icon="\uD83C\uDFA7" text="No listening history yet. Connect a Vinyl Buddy to start tracking!" />
        ) : (
          <div className="flex flex-col gap-2">
            {myListens.map(session => (
              <div key={session.id} className="bg-gs-card border border-gs-border rounded-xl overflow-hidden transition-colors duration-150 hover:border-[#0ea5e933]">
                <div className="h-0.5 bg-gradient-to-r from-gs-accent via-[#8b5cf6] to-transparent" />
                <div className="py-3 px-3.5 flex gap-3 items-center">
                  <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gs-text whitespace-nowrap overflow-hidden text-ellipsis">{session.track.title}</div>
                    <div className="text-[11px] text-gs-muted">{session.track.artist}</div>
                    <div className="text-[10px] text-gs-dim">{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gs-faint font-mono">{relTime(session.timestampMs)}</span>
                    {session.score > 0 && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-semibold font-mono border ${
                          session.score >= 90
                            ? "bg-[#22c55e11] border-[#22c55e22] text-[#22c55e]"
                            : "bg-[#f59e0b11] border-[#f59e0b22] text-[#f59e0b]"
                        }`}
                      >
                        {session.score}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Device tab */}
      {tab === "device" && (
        <DeviceCard currentUser={currentUser} deviceCode={deviceCode} onDeactivate={onDeactivate} />
      )}
    </div>
  );
}

// ============================================================================
// SESSION ROW — compact row for Overview recent activity
// ============================================================================
function SessionRow({ session }) {
  return (
    <div className="bg-gs-card border border-gs-border rounded-[10px] py-2.5 px-3 flex gap-2.5 items-center">
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
// DEVICE CARD — device status with server polling
// ============================================================================
function DeviceCard({ currentUser, deviceCode, onDeactivate }) {
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [status, setStatus] = useState("checking"); // "online" | "offline" | "checking"
  const [showConfirm, setShowConfirm] = useState(false);

  // Poll server for device status
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/vinyl-buddy/devices/${currentUser}`);
        if (!res.ok) { setStatus("offline"); return; }
        const data = await res.json();
        if (cancelled) return;

        // Find matching device
        const device = (data.devices || []).find(d => d.deviceId === deviceCode);
        if (device) {
          setDeviceInfo(device);
          // Online if last heartbeat within 60 seconds
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
  }, [currentUser, deviceCode]);

  const statusColors = {
    online: { bg: "#22c55e11", border: "#22c55e33", text: "#22c55e", dot: "#22c55e", label: "Online" },
    offline: { bg: "#f59e0b11", border: "#f59e0b33", text: "#f59e0b", dot: "#f59e0b", label: "Offline" },
    checking: { bg: "#55555511", border: "#55555533", text: "#555", dot: "#555", label: "Checking..." },
  };
  const sc = statusColors[status];

  return (
    <div>
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
            {/* Status pill — dynamic colors from statusColors must stay inline */}
            <div className="flex items-center gap-1.5 py-[5px] px-3 rounded-full" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot, boxShadow: status === "online" ? `0 0 6px ${sc.dot}` : "none" }} />
              <span className="text-[11px] font-semibold" style={{ color: sc.text }}>{sc.label}</span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Device Code", value: deviceCode },
              { label: "Heartbeats", value: deviceInfo?.totalHeartbeats ?? "—" },
              { label: "Uptime", value: fmtUptime(deviceInfo?.uptime) },
              { label: "Free Memory", value: deviceInfo?.freeHeap ? `${Math.round(deviceInfo.freeHeap / 1024)}KB` : "—" },
              { label: "First Seen", value: deviceInfo?.firstSeen ? new Date(deviceInfo.firstSeen).toLocaleDateString() : "—" },
              { label: "Last Seen", value: deviceInfo?.lastSeen ? relTime(new Date(deviceInfo.lastSeen).getTime()) : "—" },
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

      {/* Server connection hint */}
      {status === "offline" && (
        <div className="rounded-[10px] py-3 px-3.5 mb-3 bg-[#f59e0b08] border border-[#f59e0b22]">
          <div className="text-xs font-semibold text-[#f59e0b] mb-1">Device Offline</div>
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
          <button onClick={() => setShowConfirm(true)} className="gs-btn-secondary py-[9px] px-[18px] rounded-lg text-red-500 text-xs">
            Reset Device
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-red-500 font-semibold">Are you sure?</span>
            <button onClick={() => { setShowConfirm(false); onDeactivate(); }} className="py-2 px-4 bg-red-500 border-none rounded-lg text-white font-bold text-xs cursor-pointer">
              Yes, Reset
            </button>
            <button onClick={() => setShowConfirm(false)} className="gs-btn-secondary py-2 px-4 rounded-lg text-xs">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
