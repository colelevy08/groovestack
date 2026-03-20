// Expanded view of a single record — opens when clicking a record's body in a Card.
// Shows full details (label, full review, all tags) and all action buttons.
// Clicking "Comments" closes this and opens CommentsModal; clicking "Buy" closes this and opens BuyModal.
// Clicking the poster row closes this and opens UserProfileModal.
import { useMemo, useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import AlbumArt from '../ui/AlbumArt';
import Stars from '../ui/Stars';
import Badge from '../ui/Badge';
import Avatar from '../ui/Avatar';
import { condColor } from '../../utils/helpers';
import { USER_WISHLISTS } from '../../constants';
import { recordToJsonLd, injectJsonLd } from '../../utils/structuredData';

export default function DetailModal({ open, onClose, record, onLike, onSave, onComment, onBuy, onViewUser, onViewArtist, onAddWishlistItem, currentUser, records, onOfferFromDetail, onVerifyRecord, onViewRecord }) {
  const [copied, setCopied] = useState(false);

  // Inject structured data (JSON-LD) when viewing a record (#24)
  useEffect(() => {
    if (open && record) {
      injectJsonLd(recordToJsonLd(record));
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

  // Estimate market value based on condition
  const marketValue = useMemo(() => {
    if (!record) return null;
    const base = { M: 45, NM: 35, "VG+": 28, VG: 22, "G+": 15, G: 10, F: 6, P: 3 };
    const val = base[record.condition] || 20;
    // Add a bit of variance based on the record name hash
    const hash = record.album.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return (val + (hash % 15)).toFixed(2);
  }, [record]);

  const handleShare = () => {
    const url = `${window.location.origin}/record/${record.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title="Record Detail" width="520px">
      {/* Record info — more spacious layout */}
      <div className="flex gap-6 mb-6">
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={110} />
        <div className="flex-1 py-1">
          <h2 className="text-[22px] font-extrabold text-gs-text tracking-tight mb-1.5 flex items-center gap-1.5">
            {record.album}
            {record.verified && <span title="Verified vinyl" className="text-blue-500 text-base">✓</span>}
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
            <Badge label={record.condition} color={condColor(record.condition)} />
          </div>
          <span className="text-[11px] text-gs-dim font-mono">{record.format} · {record.year} · {record.label}</span>
        </div>
      </div>

      {/* Market value estimate */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#111] rounded-[10px] mb-4 border border-[#1a1a1a]">
        <span className="text-[11px] text-gs-dim font-mono tracking-wider">MARKET VALUE</span>
        <span className="text-sm font-bold text-emerald-400">~${marketValue}</span>
      </div>

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
        <span className="text-[11px] text-gs-faint">→ view profile</span>
      </div>

      {record.review && (
        <blockquote
          className="pl-3.5 text-[#aaa] text-[13px] leading-[1.7] italic mb-5"
          style={{ borderLeft: `2px solid ${record.accent}55` }}
        >
          "{record.review}"
        </blockquote>
      )}

      <div className="flex gap-1.5 flex-wrap mb-5">
        {record.tags.map(t => (
          <span key={t} className="text-[11px] px-2.5 py-[3px] rounded-full bg-[#1a1a1a] text-[#666] border border-gs-border-hover">#{t}</span>
        ))}
      </div>

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
          ❤ {record.likes}
        </button>
        <button
          onClick={() => { onClose(); onComment(record); }}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
        >
          💬 {record.comments.length}
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
          {record.saved ? "★ Saved" : "☆ Save"}
        </button>
        {/* Add to Wishlist — only shown when viewing someone else's record */}
        {!isOwn && (
          <button
            onClick={() => onAddWishlistItem(record.album, record.artist)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
          >
            ✨ Wishlist
          </button>
        )}
        {/* Share — copy link to clipboard */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-xs font-semibold cursor-pointer"
        >
          {copied ? "✓ Copied!" : "🔗 Share"}
        </button>
        {isOwn && !record.verified && onVerifyRecord && (
          <button
            onClick={() => { onClose(); onVerifyRecord(record); }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-blue-500/[0.13] border border-blue-500/[0.27] text-blue-500 text-xs font-semibold cursor-pointer"
          >
            📷 Verify
          </button>
        )}
        {record.forSale && (
          <button
            onClick={() => { onClose(); onBuy(record); }}
            className="ml-auto px-[18px] py-2.5 rounded-lg border-none text-black font-extrabold text-[13px] cursor-pointer"
            style={{ background: `linear-gradient(135deg,${record.accent},#6366f1)` }}
          >
            Buy · ${record.price}
          </button>
        )}
      </div>

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

      {/* Similar Records */}
      {similarRecords.length > 0 && (
        <div className="mt-5 border-t border-[#1a1a1a] pt-4">
          <div className="text-[11px] text-gs-dim font-mono mb-3 tracking-widest">SIMILAR RECORDS</div>
          <div className="grid grid-cols-4 gap-2.5">
            {similarRecords.map(r => (
              <button
                key={r.id}
                onClick={() => onViewRecord?.(r)}
                className="bg-[#111] rounded-[10px] p-2 border border-[#1a1a1a] cursor-pointer hover:border-[#333] transition-colors flex flex-col items-center gap-1.5 text-center"
              >
                <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={56} />
                <div className="text-[10px] font-bold text-gs-text truncate w-full">{r.album}</div>
                <div className="text-[9px] text-gs-dim truncate w-full">{r.artist}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
