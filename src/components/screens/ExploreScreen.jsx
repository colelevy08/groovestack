// Marketplace screen — unified discovery + shopping.
// "Browse" mode shows all records in a Card grid; "Shop" mode shows for-sale records in a marketplace list.
// Both modes share the search bar and genre filtering.
// When a genre is selected, subgenre pills appear for finer filtering.
// When no search or genre filter is active (in browse mode), shows a "Collectors to Discover" row.
import { useState, useMemo } from 'react';
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
  const baseFiltered = useMemo(() => records.filter(r => {
    const m = q.toLowerCase();
    return (
      (!m || r.album.toLowerCase().includes(m) || r.artist.toLowerCase().includes(m) || (r.user || "").toLowerCase().includes(m) || r.tags?.some(t => t.toLowerCase().includes(m))) &&
      (genre === "All" || r.tags?.includes(genre)) &&
      (!subgenre || r.tags?.includes(subgenre))
    );
  }), [records, q, genre, subgenre]);

  // Shop mode: further filter to for-sale only, then sort
  const shopRecords = useMemo(() => [...baseFiltered.filter(r => r.forSale)].sort((a, b) =>
    sort === "price-asc" ? a.price - b.price :
    sort === "price-desc" ? b.price - a.price :
    b.id - a.id
  ), [baseFiltered, sort]);

  const suggestedUsers = Object.keys(USER_PROFILES).filter(u => u !== "yourhandle").slice(0, 10);

  // When changing genre, clear subgenre
  const selectGenre = g => {
    setGenre(g);
    setSubgenre(null);
  };

  return (
    <div>
      {/* Header with mode toggle */}
      <div className="flex justify-between items-start mb-3.5">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.04em] text-gs-text mb-0.5">Marketplace</h1>
          <p className="text-xs text-gs-dim">
            {mode === "shop" ? `${shopRecords.length} records for sale` : `${baseFiltered.length} records`}
          </p>
        </div>
        <div className="flex gap-1 bg-gs-card border border-gs-border rounded-[10px] p-[3px]">
          {[["browse", "Browse"], ["shop", "Shop"]].map(([val, label]) => (
            <button key={val} onClick={() => setMode(val)}
              className={`px-4 py-1.5 rounded-lg border-none text-xs font-semibold cursor-pointer transition-all duration-150 ${
                mode === val
                  ? "bg-gradient-to-br from-gs-accent to-gs-indigo text-white"
                  : "bg-transparent text-gs-dim"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-dim" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          aria-label="Search records"
          placeholder={mode === "shop" ? "Search for-sale records..." : "Search albums, artists, users, genres..."}
          className="w-full bg-gs-card border border-gs-border rounded-[10px] py-2.5 pr-8 pl-9 text-[#f0f0f0] text-[13px] outline-none font-sans focus:border-gs-accent/30"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-gs-faint hover:text-gs-muted cursor-pointer p-0 text-sm leading-none"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Genre pills + sort (sort only in shop mode) */}
      <div className={`flex justify-between items-center gap-3 ${activeSubgenres.length > 0 ? "mb-2" : "mb-[18px]"}`}>
        <div className="flex gap-1.5 flex-wrap flex-1">
          {activeGenres.map(g => (
            <button key={g} onClick={() => selectGenre(g)}
              className={`gs-pill text-[11px] font-semibold cursor-pointer ${
                genre === g ? "gs-pill-active" : ""
              }`}>
              {g}
            </button>
          ))}
        </div>
        {mode === "shop" && (
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-gs-card border border-[#222] rounded-lg py-[7px] px-3 text-[#aaa] text-xs outline-none cursor-pointer shrink-0">
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
        )}
      </div>

      {/* Subgenre pills — shown when a parent genre is selected */}
      {activeSubgenres.length > 0 && (
        <div className="flex gap-[5px] flex-wrap mb-[18px]">
          <button
            onClick={() => setSubgenre(null)}
            className={`px-2.5 py-1 rounded-2xl border text-[10px] font-semibold cursor-pointer transition-colors ${
              !subgenre
                ? "bg-gs-indigo border-gs-indigo text-white"
                : "bg-gs-card border-[#1a1a1a] text-gs-dim"
            }`}
          >
            All {genre}
          </button>
          {activeSubgenres.map(sg => (
            <button key={sg} onClick={() => setSubgenre(sg)}
              className={`px-2.5 py-1 rounded-2xl border text-[10px] font-semibold cursor-pointer transition-colors ${
                subgenre === sg
                  ? "bg-gs-indigo border-gs-indigo text-white"
                  : "bg-gs-card border-[#1a1a1a] text-gs-dim"
              }`}>
              {sg}
            </button>
          ))}
        </div>
      )}

      {/* Collector suggestions (only in browse mode, no search active) */}
      {mode === "browse" && !q && genre === "All" && (
        <div className="mb-6">
          <h2 className="gs-label mb-3">COLLECTORS TO DISCOVER</h2>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {suggestedUsers.map(u => {
              const p = getProfile(u);
              const userRecords = records.filter(r => r.user === u);
              return (
                <div key={u} onClick={() => onViewUser(u)}
                  className="gs-card p-3.5 px-4 min-w-[150px] cursor-pointer shrink-0"
                  onMouseEnter={e => e.currentTarget.style.borderColor = p.accent + "55"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = ""}>
                  <Avatar username={u} size={42} />
                  <div className="text-[13px] font-bold text-gs-text mt-2.5 mb-0.5">{p.displayName}</div>
                  <div className="text-[10px] text-gs-dim font-mono mb-1.5">@{u}</div>
                  <div className="text-[11px] text-[#666]">{userRecords.length} records · {p.favGenre}</div>
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
          <div className="flex flex-col gap-2.5">
            {shopRecords.map(r => (
              <div key={r.id} onClick={() => handlers.onDetail?.(r)}
                className="gs-card p-4 flex gap-3.5 items-center cursor-pointer"
                onMouseEnter={e => e.currentTarget.style.borderColor = r.accent + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = ""}>
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={52} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gs-text mb-0.5">{r.album}</div>
                  <div className="text-xs text-[#777] mb-1.5 flex items-center gap-1.5">
                    <button onClick={e => { e.stopPropagation(); onViewArtist?.(r.artist); }}
                      className="bg-transparent border-none cursor-pointer text-[#ccc] text-xs p-0 font-medium">{r.artist}</button>
                    ·
                    <button onClick={e => { e.stopPropagation(); onViewUser(r.user); }}
                      className="bg-transparent border-none cursor-pointer text-gs-accent text-xs p-0">@{r.user}</button>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <Badge label={r.condition} color={condColor(r.condition)} />
                    <span className="text-[11px] text-gs-dim font-mono">{r.format} · {r.year}</span>
                    {r.tags?.slice(0, 2).map(t => (
                      <span key={t} className="gs-pill">#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-extrabold text-gs-text tracking-[-0.03em] mb-1.5">${r.price}</div>
                  <div className="flex gap-1.5">
                    <button onClick={e => { e.stopPropagation(); onAddToCart(r); }}
                      className="gs-btn-secondary py-2 px-3 text-[11px] font-bold rounded-lg">+ Cart</button>
                    <button onClick={e => { e.stopPropagation(); onBuy(r); }}
                      className="py-2 px-[18px] rounded-lg border-none text-black font-bold text-xs cursor-pointer"
                      style={{ background: `linear-gradient(135deg,${r.accent},#6366f1)` }}>Buy Now</button>
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
