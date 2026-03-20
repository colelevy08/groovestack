// Artist profile modal — shows Wikipedia bio/image + all records by this artist on the platform.
// Data is derived from the records array passed in from App.js; artist info fetched from Wikipedia API.
import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { getArtistInfo } from '../../utils/artistInfo';
import { getProfile, condColor } from '../../utils/helpers';

export default function ArtistProfileModal({ artist, open, onClose, records, onDetail, onBuy, onViewUser }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artist || !open) return;
    setLoading(true);
    setInfo(null);
    getArtistInfo(artist).then(result => {
      setInfo(result);
      setLoading(false);
    });
  }, [artist, open]);

  if (!open || !artist) return null;

  // All records by this artist on the platform
  const artistRecords = records.filter(r => r.artist.toLowerCase() === artist.toLowerCase());
  const forSale = artistRecords.filter(r => r.forSale);
  const prices = forSale.map(r => r.price).filter(Boolean);
  const priceRange = prices.length > 0
    ? prices.length === 1 ? `$${prices[0]}` : `$${Math.min(...prices)} – $${Math.max(...prices)}`
    : null;

  // Top collectors — users who own the most records by this artist
  const collectorMap = {};
  artistRecords.forEach(r => { collectorMap[r.user] = (collectorMap[r.user] || 0) + 1; });
  const topCollectors = Object.entries(collectorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Unique genres from this artist's records
  const genres = [...new Set(artistRecords.flatMap(r => r.tags || []))].slice(0, 6);

  return (
    <Modal open={open} onClose={onClose} title="" width="680px">
      {/* Hero section with artist image + info */}
      <div style={{ margin: "-22px -22px 0", padding: 0 }}>
        <div style={{
          position: "relative",
          height: 180,
          background: info?.imageUrl
            ? `url(${info.imageUrl}) center/cover`
            : "linear-gradient(135deg,#0ea5e922,#6366f122)",
          borderRadius: "0",
          overflow: "hidden",
        }}>
          {/* Gradient overlay for text readability */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 20%, #0d0d0d 100%)" }} />
          {/* Artist name + description */}
          <div style={{ position: "absolute", bottom: 18, left: 22, right: 22 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em", marginBottom: 4, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              {info?.name || artist}
            </h2>
            {info?.description && (
              <p style={{ fontSize: 12, color: "#aaa", fontFamily: "'DM Mono',monospace", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
                {info.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 0 0" }}>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <Stat value={artistRecords.length} label="records" />
          <Stat value={forSale.length} label="for sale" />
          {priceRange && <Stat value={priceRange} label="price range" />}
          <Stat value={topCollectors.length} label="collectors" />
        </div>

        {/* Genre tags */}
        {genres.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {genres.map(g => (
              <span key={g} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a", fontWeight: 600 }}>
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {loading ? (
          <p style={{ fontSize: 13, color: "#555", padding: "12px 0" }}>Loading artist info…</p>
        ) : info?.bio ? (
          <p style={{ fontSize: 13, color: "#999", lineHeight: 1.7, marginBottom: 20, maxHeight: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
            {info.bio.length > 300 ? info.bio.slice(0, 300) + "…" : info.bio}
          </p>
        ) : null}

        {/* Top Collectors */}
        {topCollectors.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>
              TOP COLLECTORS
            </h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {topCollectors.map(([user, count]) => {
                const p = getProfile(user);
                return (
                  <div
                    key={user}
                    onClick={() => { onClose(); onViewUser(user); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = p.accent + "55"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}
                  >
                    <Avatar username={user} size={24} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>{p.displayName}</span>
                    <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace" }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Records on GrooveStack */}
        <h3 style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'DM Mono',monospace" }}>
          RECORDS ON GROOVESTACK
        </h3>
        {artistRecords.length === 0 ? (
          <p style={{ fontSize: 13, color: "#555", textAlign: "center", padding: 20 }}>No records listed yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {artistRecords.map(r => (
              <div
                key={r.id}
                onClick={() => { onClose(); onDetail(r); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: 12,
                  background: "#111", border: "1px solid #1a1a1a", borderRadius: 12,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "44"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>{r.album}{r.verified && <span title="Verified vinyl" style={{ color: "#3b82f6", fontSize: 11 }}>✓</span>}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={e => { e.stopPropagation(); onViewUser(r.user); onClose(); }}
                      style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: 11, cursor: "pointer", padding: 0, fontWeight: 600 }}
                    >
                      @{r.user}
                    </button>
                    <Badge label={r.condition} color={condColor(r.condition)} />
                    <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace" }}>{r.format} · {r.year}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {r.forSale ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em" }}>${r.price}</div>
                      <button
                        onClick={e => { e.stopPropagation(); onBuy(r); onClose(); }}
                        style={{ marginTop: 4, padding: "5px 14px", borderRadius: 6, background: `linear-gradient(135deg,${r.accent},#6366f1)`, border: "none", color: "#000", fontWeight: 700, fontSize: 10, cursor: "pointer" }}
                      >
                        Buy
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'DM Mono',monospace" }}>Not for sale</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Small stat pill used in the stats row
function Stat({ value, label }) {
  return (
    <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{label}</div>
    </div>
  );
}
