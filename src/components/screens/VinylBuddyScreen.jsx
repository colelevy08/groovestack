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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 2 }}>Vinyl Buddy</h1>
        <p style={{ fontSize: 12, color: "#555" }}>Your personal vinyl identification companion</p>
      </div>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(135deg,#0ea5e911,#6366f111)", border: "1px solid #0ea5e922", borderRadius: 16, padding: "32px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle,#0ea5e915,transparent 70%)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em" }}>Meet Vinyl Buddy</div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5, marginTop: 4 }}>
              A tiny ESP32-powered device that sits next to your turntable, listens to your records, and identifies every track you play.
            </div>
          </div>
        </div>

        {/* How it works */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {["Place near turntable", "Music auto-detected", "Track identified in seconds"].map((step, i) => (
            <div key={i} style={{ flex: 1, background: "#0a0a0a88", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0ea5e9", marginBottom: 4 }}>{i + 1}</div>
              <div style={{ fontSize: 11, color: "#777", lineHeight: 1.4 }}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
        {features.map(f => (
          <div key={f.title} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "18px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Activation section */}
      {!showForm ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <button
            onClick={() => setShowForm(true)}
            style={{ padding: "14px 36px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: "-0.02em" }}
          >
            Activate Your Device
          </button>
          <p style={{ fontSize: 11, color: "#444", marginTop: 10 }}>Already have a Vinyl Buddy? Enter your device code to get started.</p>
        </div>
      ) : (
        <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "22px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>Activate Your Device</div>
          <p style={{ fontSize: 11, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
            Enter the 12-character device code shown on your Vinyl Buddy's OLED screen during WiFi setup. It looks like: AABB11223344
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input
                value={code}
                onChange={e => { setCode(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleActivate()}
                placeholder="e.g. AABB11223344"
                maxLength={12}
                style={{
                  width: "100%", padding: "11px 14px", background: "#111", border: `1px solid ${error ? "#ef4444" : "#2a2a2a"}`,
                  borderRadius: 9, color: "#f5f5f5", fontSize: 14, fontFamily: "'DM Mono',monospace",
                  letterSpacing: "0.08em", outline: "none", textTransform: "uppercase",
                }}
              />
              {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{error}</div>}
            </div>
            <button onClick={handleActivate} style={{ padding: "11px 22px", background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              Activate
            </button>
          </div>
          <button onClick={() => { setShowForm(false); setCode(""); setError(""); }} style={{ marginTop: 12, background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", padding: 0 }}>
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5" }}>Vinyl Buddy</h1>
          <Badge label="Active" color="#22c55e" />
        </div>
        <p style={{ fontSize: 12, color: "#555" }}>Your listening dashboard</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {[
          { l: "Total Listens", v: myListens.length, c: "#0ea5e9" },
          { l: "Artists", v: artists.size, c: "#8b5cf6" },
          { l: "Albums", v: albums.size, c: "#f59e0b" },
          { l: "Avg Score", v: `${avgScore}%`, c: "#22c55e" },
        ].map(s => (
          <div key={s.l} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: "-0.02em" }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1a1a1a", marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "9px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#0ea5e9" : "transparent"}`, color: tab === t ? "#0ea5e9" : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", marginBottom: -1 }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {/* Top Artist */}
                <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: 2, background: "linear-gradient(90deg,#8b5cf6,transparent)" }} />
                  <div style={{ padding: "16px 14px" }}>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>TOP ARTIST</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {topArtist ? topArtist[0].charAt(0).toUpperCase() : "?"}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{topArtist ? topArtist[0] : "—"}</div>
                        <div style={{ fontSize: 11, color: "#8b5cf6" }}>{topArtist ? `${topArtist[1]} plays` : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Track */}
                <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: 2, background: "linear-gradient(90deg,#0ea5e9,transparent)" }} />
                  <div style={{ padding: "16px 14px" }}>
                    <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>TOP TRACK</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <AlbumArt album={topTrackSession?.track.album} artist={topTrackSession?.track.artist} accent="#0ea5e9" size={40} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {topTrack ? topTrack[0].split(" — ")[0] : "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "#0ea5e9" }}>{topTrack ? `${topTrack[1]} plays` : ""}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent Activity</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myListens.map(session => (
              <div key={session.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#0ea5e933"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
                <div style={{ height: 2, background: "linear-gradient(90deg,#0ea5e9,#8b5cf6,transparent)" }} />
                <div style={{ padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                  <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.track.title}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{session.track.artist}</div>
                    <div style={{ fontSize: 10, color: "#555" }}>{session.track.album}{session.track.year ? ` \u00B7 ${session.track.year}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>{relTime(session.timestampMs)}</span>
                    {session.score > 0 && (
                      <span style={{ fontSize: 9, padding: "2px 6px", background: session.score >= 90 ? "#22c55e11" : "#f59e0b11", border: `1px solid ${session.score >= 90 ? "#22c55e22" : "#f59e0b22"}`, borderRadius: 4, color: session.score >= 90 ? "#22c55e" : "#f59e0b", fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>
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
    <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
      <AlbumArt album={session.track.album} artist={session.track.artist} accent="#0ea5e9" size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.track.title}</div>
        <div style={{ fontSize: 10, color: "#666" }}>{session.track.artist}</div>
      </div>
      <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{relTime(session.timestampMs)}</span>
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
      <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: 2, background: `linear-gradient(90deg,${sc.text},transparent)` }} />
        <div style={{ padding: "18px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5" }}>Vinyl Buddy</div>
                <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace" }}>ESP32-DevKitC V4</div>
              </div>
            </div>
            {/* Status pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, boxShadow: status === "online" ? `0 0 6px ${sc.dot}` : "none" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: sc.text }}>{sc.label}</span>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Device Code", value: deviceCode },
              { label: "Heartbeats", value: deviceInfo?.totalHeartbeats ?? "—" },
              { label: "Uptime", value: fmtUptime(deviceInfo?.uptime) },
              { label: "Free Memory", value: deviceInfo?.freeHeap ? `${Math.round(deviceInfo.freeHeap / 1024)}KB` : "—" },
              { label: "First Seen", value: deviceInfo?.firstSeen ? new Date(deviceInfo.firstSeen).toLocaleDateString() : "—" },
              { label: "Last Seen", value: deviceInfo?.lastSeen ? relTime(new Date(deviceInfo.lastSeen).getTime()) : "—" },
            ].map(item => (
              <div key={item.label} style={{ background: "#111", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ccc", fontFamily: item.label === "Device Code" ? "'DM Mono',monospace" : "inherit", letterSpacing: item.label === "Device Code" ? "0.06em" : "normal" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Server connection hint */}
      {status === "offline" && (
        <div style={{ background: "#f59e0b08", border: "1px solid #f59e0b22", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>Device Offline</div>
          <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>
            Make sure your Vinyl Buddy is powered on and connected to the same WiFi network. The server should be running on port 3001.
          </div>
        </div>
      )}

      {/* Reset device */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>Reset Device</div>
        <p style={{ fontSize: 11, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
          Remove this Vinyl Buddy from your account. Your listening history will be preserved, but you'll need to re-enter the device code to reconnect.
        </p>
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} style={{ padding: "9px 18px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#ef4444", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            Reset Device
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>Are you sure?</span>
            <button onClick={() => { setShowConfirm(false); onDeactivate(); }} style={{ padding: "8px 16px", background: "#ef4444", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              Yes, Reset
            </button>
            <button onClick={() => setShowConfirm(false)} style={{ padding: "8px 16px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: "#888", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
