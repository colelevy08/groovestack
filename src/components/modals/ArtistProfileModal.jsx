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
      <div className="-m-[22px] mb-0 p-0">
        <div
          className="relative h-[180px] overflow-hidden rounded-none"
          style={info?.imageUrl
            ? { background: `url(${info.imageUrl}) center/cover` }
            : { background: "linear-gradient(135deg,#0ea5e922,#6366f122)" }
          }
        >
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gs-surface" />
          {/* Artist name + description */}
          <div className="absolute bottom-[18px] left-[22px] right-[22px]">
            <h2 className="text-[28px] font-extrabold text-gs-text tracking-tight mb-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              {info?.name || artist}
            </h2>
            {info?.description && (
              <p className="text-xs text-[#aaa] font-mono drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                {info.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-[18px]">
        {/* Stats row */}
        <div className="flex gap-4 mb-[18px] flex-wrap">
          <Stat value={artistRecords.length} label="records" />
          <Stat value={forSale.length} label="for sale" />
          {priceRange && <Stat value={priceRange} label="price range" />}
          <Stat value={topCollectors.length} label="collectors" />
        </div>

        {/* Genre tags */}
        {genres.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-[18px]">
            {genres.map(g => (
              <span key={g} className="text-[10px] px-2.5 py-[3px] rounded-full bg-[#1a1a1a] text-gs-muted border border-gs-border-hover font-semibold">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {loading ? (
          <p className="text-[13px] text-gs-dim py-3">Loading artist info…</p>
        ) : info?.bio ? (
          <p className="text-[13px] text-[#999] leading-[1.7] mb-5 max-h-[100px] overflow-hidden text-ellipsis">
            {info.bio.length > 300 ? info.bio.slice(0, 300) + "…" : info.bio}
          </p>
        ) : null}

        {/* Top Collectors */}
        {topCollectors.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[11px] font-bold text-gs-dim tracking-[0.08em] mb-2.5 font-mono">
              TOP COLLECTORS
            </h3>
            <div className="flex gap-2.5 flex-wrap">
              {topCollectors.map(([user, count]) => {
                const p = getProfile(user);
                return (
                  <div
                    key={user}
                    onClick={() => { onClose(); onViewUser(user); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-gs-border rounded-[10px] cursor-pointer transition-colors duration-150 hover:border-gs-border-hover"
                  >
                    <Avatar username={user} size={24} />
                    <span className="text-xs font-semibold text-[#ccc]">{p.displayName}</span>
                    <span className="text-[10px] text-gs-dim font-mono">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Records on GrooveStack */}
        <h3 className="text-[11px] font-bold text-gs-dim tracking-[0.08em] mb-3 font-mono">
          RECORDS ON GROOVESTACK
        </h3>
        {artistRecords.length === 0 ? (
          <p className="text-[13px] text-gs-dim text-center p-5">No records listed yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {artistRecords.map(r => (
              <div
                key={r.id}
                onClick={() => { onClose(); onDetail(r); }}
                className="flex items-center gap-3 p-3 bg-[#111] border border-[#1a1a1a] rounded-xl cursor-pointer transition-colors duration-150 hover:border-gs-border-hover"
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gs-text mb-0.5 flex items-center gap-1">
                    {r.album}
                    {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[11px]">✓</span>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={e => { e.stopPropagation(); onViewUser(r.user); onClose(); }}
                      className="bg-transparent border-none text-gs-accent text-[11px] cursor-pointer p-0 font-semibold"
                    >
                      @{r.user}
                    </button>
                    <Badge label={r.condition} color={condColor(r.condition)} />
                    <span className="text-[10px] text-gs-dim font-mono">{r.format} · {r.year}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {r.forSale ? (
                    <>
                      <div className="text-lg font-extrabold text-gs-text tracking-tight">${r.price}</div>
                      <button
                        onClick={e => { e.stopPropagation(); onBuy(r); onClose(); }}
                        className="mt-1 px-3.5 py-[5px] rounded-md border-none text-black font-bold text-[10px] cursor-pointer"
                        style={{ background: `linear-gradient(135deg,${r.accent},#6366f1)` }}
                      >
                        Buy
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-[#3a3a3a] font-mono">Not for sale</span>
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
    <div className="bg-[#111] border border-[#1a1a1a] rounded-[10px] px-3.5 py-2 text-center">
      <div className="text-lg font-extrabold text-gs-text tracking-tight">{value}</div>
      <div className="text-[10px] text-gs-dim font-mono mt-0.5">{label}</div>
    </div>
  );
}
