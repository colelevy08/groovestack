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
  // #40 — Follow artist state
  const [followingArtist, setFollowingArtist] = useState(false);
  // #38 — Active tab for discography vs marketplace
  const [activeTab, setActiveTab] = useState('marketplace');
  // [Improvement 18] Artist news feed placeholder
  const [showNews, setShowNews] = useState(false);
  // [Improvement 19] Artist tour dates placeholder
  const [showTourDates, setShowTourDates] = useState(false);
  // [Improvement 20] Artist collaboration network
  const [showCollabNetwork, setShowCollabNetwork] = useState(false);
  // [Improvement 21] Artist genre evolution timeline
  const [showGenreTimeline, setShowGenreTimeline] = useState(false);

  useEffect(() => {
    if (!artist || !open) return;
    setLoading(true);
    setInfo(null);
    setActiveTab('marketplace');
    setShowNews(false);
    setShowTourDates(false);
    setShowCollabNetwork(false);
    setShowGenreTimeline(false);
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
    ? prices.length === 1 ? `$${prices[0]}` : `$${Math.min(...prices)} - $${Math.max(...prices)}`
    : null;

  // Top collectors — users who own the most records by this artist
  const collectorMap = {};
  artistRecords.forEach(r => { collectorMap[r.user] = (collectorMap[r.user] || 0) + 1; });
  const topCollectors = Object.entries(collectorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Unique genres from this artist's records
  const genres = [...new Set(artistRecords.flatMap(r => r.tags || []))].slice(0, 6);

  // #38 — Discography: unique albums grouped
  const discography = [...new Map(artistRecords.map(r => [r.album.toLowerCase(), r])).values()]
    .sort((a, b) => (b.year || 0) - (a.year || 0));

  // #39 — Popular records (sorted by likes)
  const popularRecords = [...forSale].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5);

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
          <div className="absolute bottom-[18px] left-[22px] right-[22px] flex items-end justify-between">
            <div>
              <h2 className="text-[28px] font-extrabold text-gs-text tracking-tight mb-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
                {info?.name || artist}
              </h2>
              {info?.description && (
                <p className="text-xs text-[#aaa] font-mono drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
                  {info.description}
                </p>
              )}
            </div>
            {/* #40 — Follow Artist button */}
            <button
              onClick={() => setFollowingArtist(f => !f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer border transition-all duration-200 shrink-0 ${
                followingArtist
                  ? 'bg-gs-accent/10 border-gs-accent/25 text-gs-accent'
                  : 'bg-black/50 border-white/20 text-white hover:bg-black/70 hover:border-white/40 backdrop-blur-sm'
              }`}
            >
              {followingArtist ? 'Following' : 'Follow Artist'}
            </button>
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
          <Stat value={discography.length} label="albums" />
        </div>

        {/* #40 — Follow notification hint */}
        {followingArtist && (
          <div className="bg-gs-accent/[0.05] border border-gs-accent/15 rounded-lg px-3 py-2 text-[11px] text-gs-accent mb-[18px] flex items-center gap-2 animate-fade-in">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            You'll be notified when new {artist} records are listed
          </div>
        )}

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
          <p className="text-[13px] text-gs-dim py-3">Loading artist info...</p>
        ) : info?.bio ? (
          <p className="text-[13px] text-[#999] leading-[1.7] mb-5 max-h-[100px] overflow-hidden text-ellipsis">
            {info.bio.length > 300 ? info.bio.slice(0, 300) + "..." : info.bio}
          </p>
        ) : null}

        {/* [Improvement 18] Artist News Feed Placeholder */}
        <div className="mb-5">
          <button
            onClick={() => setShowNews(n => !n)}
            className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[11px] font-semibold cursor-pointer hover:border-gs-border-hover transition-colors flex items-center justify-center gap-1.5 text-gs-dim"
          >
            {showNews ? 'Hide News' : 'Latest News'}
          </button>
          {showNews && (
            <div className="mt-2 space-y-2">
              {[
                { title: `New ${artist} album rumored for 2026`, date: '2 days ago', source: 'Music News' },
                { title: `${artist} reissue campaign gains traction`, date: '1 week ago', source: 'Vinyl Collective' },
                { title: `Rare ${artist} pressing sells for record price`, date: '2 weeks ago', source: 'Discogs Blog' },
              ].map((item, i) => (
                <div key={i} className="px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg">
                  <div className="text-[12px] text-gs-text font-semibold">{item.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gs-dim">{item.source}</span>
                    <span className="text-[10px] text-gs-faint">{item.date}</span>
                  </div>
                </div>
              ))}
              <div className="text-[9px] text-gs-faint text-center">News feed is a preview feature. Content is illustrative.</div>
            </div>
          )}
        </div>

        {/* [Improvement 19] Artist Tour Dates Placeholder */}
        <div className="mb-5">
          <button
            onClick={() => setShowTourDates(t => !t)}
            className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[11px] font-semibold cursor-pointer hover:border-gs-border-hover transition-colors flex items-center justify-center gap-1.5 text-gs-dim"
          >
            {showTourDates ? 'Hide Tour Dates' : 'Upcoming Tour Dates'}
          </button>
          {showTourDates && (
            <div className="mt-2 space-y-2">
              {[
                { city: 'New York, NY', venue: 'Brooklyn Steel', date: 'Apr 15, 2026' },
                { city: 'Los Angeles, CA', venue: 'The Wiltern', date: 'Apr 22, 2026' },
                { city: 'Chicago, IL', venue: 'Thalia Hall', date: 'May 1, 2026' },
                { city: 'London, UK', venue: 'Roundhouse', date: 'May 18, 2026' },
              ].map((show, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-lg">
                  <div>
                    <div className="text-[12px] text-gs-text font-semibold">{show.venue}</div>
                    <div className="text-[10px] text-gs-dim">{show.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gs-muted font-mono">{show.date}</div>
                    <button className="text-[9px] text-gs-accent bg-transparent border-none cursor-pointer p-0 font-semibold mt-0.5">
                      Tickets
                    </button>
                  </div>
                </div>
              ))}
              <div className="text-[9px] text-gs-faint text-center">Tour dates are placeholders. Ticketing integration coming soon.</div>
            </div>
          )}
        </div>

        {/* [Improvement 20] Artist Collaboration Network */}
        <div className="mb-5">
          <button
            onClick={() => setShowCollabNetwork(c => !c)}
            className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[11px] font-semibold cursor-pointer hover:border-gs-border-hover transition-colors flex items-center justify-center gap-1.5 text-gs-dim"
          >
            {showCollabNetwork ? 'Hide Network' : 'Collaboration Network'}
          </button>
          {showCollabNetwork && (
            <div className="mt-2 p-3 bg-[#111] border border-[#1a1a1a] rounded-lg">
              <div className="text-[10px] text-gs-dim font-mono mb-2 tracking-wider">COLLABORATORS</div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const seed = artist.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  const collabNames = ['Miles Davis', 'John Coltrane', 'Herbie Hancock', 'Wayne Shorter', 'Pharoah Sanders', 'Alice Coltrane', 'Sun Ra', 'Art Blakey'];
                  const start = seed % collabNames.length;
                  return Array.from({ length: 4 }, (_, i) => collabNames[(start + i) % collabNames.length])
                    .filter(name => name.toLowerCase() !== artist.toLowerCase())
                    .slice(0, 3);
                })().map((name, i) => (
                  <button
                    key={name}
                    onClick={() => { onClose(); onDetail && onDetail({ artist: name }); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#222] rounded-full cursor-pointer hover:border-gs-accent/40 transition-colors"
                  >
                    <Avatar username={name.replace(/\s/g, '').toLowerCase()} size={20} />
                    <span className="text-[11px] text-gs-muted font-semibold">{name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 relative h-[100px]">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                  <circle cx="100" cy="50" r="8" fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
                  <text x="100" y="53" textAnchor="middle" fill="#0ea5e9" fontSize="6" fontWeight="bold">{artist.split(' ').map(w => w[0]).join('')}</text>
                  {[
                    { x: 40, y: 25 }, { x: 160, y: 25 }, { x: 40, y: 75 }, { x: 160, y: 75 },
                  ].slice(0, 3).map((pos, i) => (
                    <g key={i}>
                      <line x1="100" y1="50" x2={pos.x} y2={pos.y} stroke="#333" strokeWidth="0.5" strokeDasharray="3,3" />
                      <circle cx={pos.x} cy={pos.y} r="5" fill="none" stroke="#666" strokeWidth="1" />
                    </g>
                  ))}
                </svg>
              </div>
              <div className="text-[9px] text-gs-faint text-center mt-1">Network visualization is illustrative.</div>
            </div>
          )}
        </div>

        {/* [Improvement 21] Artist Genre Evolution Timeline */}
        <div className="mb-5">
          <button
            onClick={() => setShowGenreTimeline(g => !g)}
            className="w-full py-2 bg-[#111] border border-[#1a1a1a] rounded-lg text-[11px] font-semibold cursor-pointer hover:border-gs-border-hover transition-colors flex items-center justify-center gap-1.5 text-gs-dim"
          >
            {showGenreTimeline ? 'Hide Timeline' : 'Genre Evolution'}
          </button>
          {showGenreTimeline && (
            <div className="mt-2 p-3 bg-[#111] border border-[#1a1a1a] rounded-lg">
              <div className="text-[10px] text-gs-dim font-mono mb-3 tracking-wider">GENRE EVOLUTION</div>
              <div className="relative pl-4 border-l-2 border-[#222] space-y-3">
                {(() => {
                  const allTags = [...new Set(artistRecords.flatMap(r => r.tags || []))];
                  const years = [...new Set(artistRecords.map(r => r.year).filter(Boolean))].sort();
                  if (years.length === 0) return [{ year: 'Unknown', genres: allTags.slice(0, 2) }];
                  const eras = [];
                  const decadeMap = {};
                  years.forEach(y => {
                    const decade = `${Math.floor(y / 10) * 10}s`;
                    if (!decadeMap[decade]) decadeMap[decade] = new Set();
                    const recs = artistRecords.filter(r => r.year === y);
                    recs.forEach(r => (r.tags || []).forEach(t => decadeMap[decade].add(t)));
                  });
                  Object.entries(decadeMap).forEach(([decade, genreSet]) => {
                    eras.push({ year: decade, genres: [...genreSet].slice(0, 3) });
                  });
                  return eras.length > 0 ? eras : [{ year: 'Various', genres: allTags.slice(0, 3) }];
                })().map((era, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-[#222] border-2 border-gs-accent" />
                    <div className="text-[11px] font-bold text-gs-muted">{era.year}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {era.genres.map(g => (
                        <span key={g} className="text-[9px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-gs-dim border border-gs-border-hover">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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

        {/* #38/#39 — Tab navigation for Discography / Marketplace / Popular */}
        <div className="flex gap-1 mb-3 border-b border-gs-border">
          {[
            { key: 'marketplace', label: 'MARKETPLACE' },
            { key: 'discography', label: 'DISCOGRAPHY' },
            { key: 'popular', label: 'POPULAR FOR SALE' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-[11px] font-bold tracking-[0.08em] font-mono bg-transparent border-none cursor-pointer transition-colors ${
                activeTab === tab.key
                  ? 'text-gs-accent border-b-2 border-gs-accent -mb-px'
                  : 'text-gs-dim hover:text-gs-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Marketplace tab — Records on GrooveStack */}
        {activeTab === 'marketplace' && (
          <>
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
                        {r.verified && <span title="Verified vinyl" className="text-blue-500 text-[11px]">v</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={e => { e.stopPropagation(); onViewUser(r.user); onClose(); }}
                          className="bg-transparent border-none text-gs-accent text-[11px] cursor-pointer p-0 font-semibold"
                        >
                          @{r.user}
                        </button>
                        <Badge label={r.condition} color={condColor(r.condition)} />
                        <span className="text-[10px] text-gs-dim font-mono">{r.format} - {r.year}</span>
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
          </>
        )}

        {/* #38 — Discography tab */}
        {activeTab === 'discography' && (
          <>
            {discography.length === 0 ? (
              <p className="text-[13px] text-gs-dim text-center p-5">No albums found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {discography.map(r => {
                  const copies = artistRecords.filter(ar => ar.album.toLowerCase() === r.album.toLowerCase());
                  const forSaleCount = copies.filter(c => c.forSale).length;
                  return (
                    <div
                      key={r.album}
                      onClick={() => { onClose(); onDetail(r); }}
                      className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 cursor-pointer transition-colors duration-150 hover:border-gs-border-hover"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={48} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-gs-text truncate">{r.album}</div>
                          <div className="text-[10px] text-gs-dim font-mono">{r.year || 'Unknown'}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gs-muted">{copies.length} {copies.length === 1 ? 'copy' : 'copies'}</span>
                        {forSaleCount > 0 && (
                          <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            {forSaleCount} for sale
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* #39 — Popular for sale tab */}
        {activeTab === 'popular' && (
          <>
            {popularRecords.length === 0 ? (
              <p className="text-[13px] text-gs-dim text-center p-5">No records for sale by this artist.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {popularRecords.map((r, idx) => (
                  <div
                    key={r.id}
                    onClick={() => { onClose(); onDetail(r); }}
                    className="flex items-center gap-3 p-3 bg-[#111] border border-[#1a1a1a] rounded-xl cursor-pointer transition-colors duration-150 hover:border-gs-border-hover"
                  >
                    <div className="w-6 text-center text-[11px] font-bold text-gs-dim font-mono shrink-0">
                      #{idx + 1}
                    </div>
                    <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text mb-0.5 truncate">{r.album}</div>
                      <div className="flex items-center gap-1.5">
                        <Badge label={r.condition} color={condColor(r.condition)} />
                        <span className="text-[10px] text-gs-dim">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="inline mr-0.5 -mt-px">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          {r.likes || 0}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-extrabold text-gs-text">${r.price}</div>
                      <button
                        onClick={e => { e.stopPropagation(); onBuy(r); onClose(); }}
                        className="mt-1 px-3.5 py-[5px] rounded-md border-none text-black font-bold text-[10px] cursor-pointer"
                        style={{ background: `linear-gradient(135deg,${r.accent},#6366f1)` }}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
