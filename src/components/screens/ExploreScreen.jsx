// Marketplace screen — unified discovery + shopping.
// "Browse" mode shows all records in a Card grid; "Shop" mode shows for-sale records in a marketplace list.
// Both modes share the search bar and genre filtering.
// When a genre is selected, subgenre pills appear for finer filtering.
// When no search or genre filter is active (in browse mode), shows a "Collectors to Discover" row.
import { useState } from 'react';
import Avatar from '../ui/Avatar';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Paginated from '../Paginated';
import Empty from '../ui/Empty';
import { GENRES, GENRE_MAP, USER_PROFILES } from '../../constants';
import { getProfile, condColor } from '../../utils/helpers';

export default function ExploreScreen({ records, onViewUser, onBuy, onAddToCart, onViewArtist, ...handlers }) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");
  const [subgenre, setSubgenre] = useState(null);
  const [mode, setMode] = useState("browse"); // "browse" | "shop"
  const [sort, setSort] = useState("newest");

  // Only show genre pills for genres that exist in the current records data
  const activeGenres = ["All", ...GENRES.filter(g => records.some(r => r.tags?.includes(g)))];

  // Subgenres for the selected genre (if any)
  const subgenres = genre !== "All" && GENRE_MAP[genre] ? GENRE_MAP[genre] : [];
  // Only show subgenres that have matching records
  const activeSubgenres = subgenres.filter(sg => records.some(r => r.tags?.includes(sg)));

  // Base filter: text search + genre + subgenre (shared by both modes)
  const baseFiltered = records.filter(r => {
    const m = q.toLowerCase();
    return (
      (!m || r.album.toLowerCase().includes(m) || r.artist.toLowerCase().includes(m) || (r.user || "").toLowerCase().includes(m) || r.tags?.some(t => t.toLowerCase().includes(m))) &&
      (genre === "All" || r.tags?.includes(genre)) &&
      (!subgenre || r.tags?.includes(subgenre))
    );
  });

  // Shop mode: further filter to for-sale only, then sort
  const shopRecords = [...baseFiltered.filter(r => r.forSale)].sort((a, b) =>
    sort === "price-asc" ? a.price - b.price :
    sort === "price-desc" ? b.price - a.price :
    b.id - a.id
  );

  const suggestedUsers = Object.keys(USER_PROFILES).filter(u => u !== "yourhandle").slice(0, 10);

  // When changing genre, clear subgenre
  const selectGenre = g => {
    setGenre(g);
    setSubgenre(null);
  };

  return (
    <div>
      {/* Header with mode toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 2 }}>Marketplace</h1>
          <p style={{ fontSize: 12, color: "#555" }}>
            {mode === "shop" ? `${shopRecords.length} records for sale` : `${baseFiltered.length} records`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: 3 }}>
          {[["browse", "Browse"], ["shop", "Shop"]].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)}
              style={{
                padding: "6px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: mode === val ? "linear-gradient(135deg,#0ea5e9,#6366f1)" : "transparent",
                color: mode === val ? "#fff" : "#555",
                transition: "all 0.15s",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder={mode === "shop" ? "Search for-sale records..." : "Search albums, artists, users, genres..."}
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px 10px 36px", color: "#f0f0f0", fontSize: 13, outline: "none", fontFamily: "'DM Sans',sans-serif" }}
          onFocus={e => e.target.style.borderColor = "#0ea5e955"}
          onBlur={e => e.target.style.borderColor = "#1e1e1e"}
        />
      </div>

      {/* Genre pills + sort (sort only in shop mode) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: activeSubgenres.length > 0 ? 8 : 18, gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {activeGenres.map(g => (
            <button key={g} onClick={() => selectGenre(g)} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid", background: genre === g ? "#0ea5e9" : "#0f0f0f", borderColor: genre === g ? "#0ea5e9" : "#1e1e1e", color: genre === g ? "#000" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {g}
            </button>
          ))}
        </div>
        {mode === "shop" && (
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: "#0f0f0f", border: "1px solid #222", borderRadius: 8, padding: "7px 12px", color: "#aaa", fontSize: 12, outline: "none", cursor: "pointer", flexShrink: 0 }}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
        )}
      </div>

      {/* Subgenre pills — shown when a parent genre is selected */}
      {activeSubgenres.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 18 }}>
          <button
            onClick={() => setSubgenre(null)}
            style={{ padding: "4px 10px", borderRadius: 16, border: "1px solid", background: !subgenre ? "#6366f1" : "#0f0f0f", borderColor: !subgenre ? "#6366f1" : "#1a1a1a", color: !subgenre ? "#fff" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer" }}
          >
            All {genre}
          </button>
          {activeSubgenres.map(sg => (
            <button key={sg} onClick={() => setSubgenre(sg)} style={{ padding: "4px 10px", borderRadius: 16, border: "1px solid", background: subgenre === sg ? "#6366f1" : "#0f0f0f", borderColor: subgenre === sg ? "#6366f1" : "#1a1a1a", color: subgenre === sg ? "#fff" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
              {sg}
            </button>
          ))}
        </div>
      )}

      {/* Collector suggestions (only in browse mode, no search active) */}
      {mode === "browse" && !q && genre === "All" && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#555", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'DM Mono',monospace" }}>COLLECTORS TO DISCOVER</h2>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
            {suggestedUsers.map(u => {
              const p = getProfile(u);
              const userRecords = records.filter(r => r.user === u);
              return (
                <div key={u} onClick={() => onViewUser(u)} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: "14px 16px", minWidth: 150, cursor: "pointer", flexShrink: 0, transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = p.accent + "55"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
                  <Avatar username={u} size={42} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", marginTop: 10, marginBottom: 2 }}>{p.displayName}</div>
                  <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>@{u}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{userRecords.length} records · {p.favGenre}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {mode === "browse" ? (
        /* Browse mode — Card grid */
        baseFiltered.length === 0
          ? <Empty icon="🔍" text={q ? `No results for "${q}"` : "No records found."} />
          : <Paginated records={baseFiltered} handlers={{ ...handlers, onViewUser, onBuy, onViewArtist }} />
      ) : (
        /* Shop mode — Marketplace list */
        shopRecords.length === 0 ? (
          <Empty icon="🏷️" text={q ? `No for-sale results for "${q}"` : "No records for sale right now."} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shopRecords.map(r => (
              <div key={r.id} onClick={() => handlers.onDetail?.(r)} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 14, padding: 16, display: "flex", gap: 14, alignItems: "center", cursor: "pointer", transition: "border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e1e"}>
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5", marginBottom: 2 }}>{r.album}</div>
                  <div style={{ fontSize: 12, color: "#777", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); onViewArtist?.(r.artist); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 12, padding: 0, fontWeight: 500 }}>{r.artist}</button>
                    ·
                    <button onClick={e => { e.stopPropagation(); onViewUser(r.user); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#0ea5e9", fontSize: 12, padding: 0 }}>@{r.user}</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge label={r.condition} color={condColor(r.condition)} />
                    <span style={{ fontSize: "11px", color: "#555", fontFamily: "'DM Mono',monospace" }}>{r.format} · {r.year}</span>
                    {r.tags?.slice(0, 2).map(t => (
                      <span key={t} style={{ fontSize: "10px", padding: "1px 6px", borderRadius: 20, background: "#1a1a1a", color: "#555", border: "1px solid #2a2a2a" }}>#{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.03em", marginBottom: 6 }}>${r.price}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); onAddToCart(r); }} style={{ padding: "8px 12px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>+ Cart</button>
                    <button onClick={e => { e.stopPropagation(); onBuy(r); }} style={{ padding: "8px 18px", borderRadius: 8, background: `linear-gradient(135deg,${r.accent},#6366f1)`, border: "none", color: "#000", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Buy Now</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
