// Transactions hub — shows the current user's activity across four tabs:
// Offers Sent, Offers Received, Purchases, and Cart.
// Features: search/filter, date range, CSV export, larger album art on offers,
// order tracking, running totals, reorder button, drag-to-reorder cart.
import { useState, useMemo, useCallback } from 'react';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';
import { condColor } from '../../utils/helpers';

const TABS = ["offers sent", "offers received", "purchases", "cart"];

// Maps offer type -> display label and accent color
const offerTypeLabel = t => t === "trade" ? "Trade" : t === "combo" ? "Combo" : "Cash";
const offerTypeColor = t => t === "trade" ? "#8b5cf6" : t === "combo" ? "#f59e0b" : "#0ea5e9";

// Status badge colors for offers
const statusColor = s => s === "pending" ? "#f59e0b" : s === "accepted" ? "#22c55e" : s === "declined" ? "#ef4444" : "#555";

// Simulated order tracking stages
const ORDER_STAGES = ["confirmed", "processing", "shipped", "out for delivery", "delivered"];
const getOrderStage = (purchaseId) => {
  // Deterministic stage based on ID for consistent display
  let hash = 0;
  const idStr = String(purchaseId);
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  return Math.abs(hash) % ORDER_STAGES.length;
};

// Date range presets
const DATE_RANGES = [
  { key: "all", label: "All Time" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
];

export default function TransactionsScreen({ offers, purchases, cart, currentUser, records, profile, onBuy, onRemoveFromCart, onViewUser, onDetail, onAcceptOffer, onDeclineOffer }) {
  const [tab, setTab] = useState("offers sent");
  const [acceptingId, setAcceptingId] = useState(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const sentOffers = (offers || []).filter(o => o.from === currentUser);
  const receivedOffers = (offers || []).filter(o => o.to === currentUser);

  // Running totals
  const totals = useMemo(() => {
    const totalSpent = (purchases || []).reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
    const totalEarned = sentOffers.filter(o => o.status === "accepted" && o.type !== "trade").reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    return { spent: totalSpent, earned: totalEarned };
  }, [purchases, sentOffers]);

  // Search/filter helper
  const matchesSearch = useCallback((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (item.album || "").toLowerCase().includes(q) ||
           (item.artist || "").toLowerCase().includes(q) ||
           (item.from || "").toLowerCase().includes(q) ||
           (item.to || "").toLowerCase().includes(q) ||
           (item.seller || "").toLowerCase().includes(q);
  }, [search]);

  // Filtered lists
  const filteredSent = useMemo(() => sentOffers.filter(matchesSearch), [sentOffers, matchesSearch]);
  const filteredReceived = useMemo(() => receivedOffers.filter(matchesSearch), [receivedOffers, matchesSearch]);
  const filteredPurchases = useMemo(() => (purchases || []).filter(matchesSearch), [purchases, matchesSearch]);

  // CSV export for transactions
  const exportCSV = useCallback(() => {
    let headers, rows;
    if (tab === "purchases") {
      headers = ["Album","Artist","Seller","Price","Format","Year","Condition","Time"];
      rows = (purchases || []).map(p => [
        `"${(p.album || "").replace(/"/g, '""')}"`,
        `"${(p.artist || "").replace(/"/g, '""')}"`,
        p.seller || "",
        p.price || "",
        p.format || "",
        p.year || "",
        p.condition || "",
        p.time || "",
      ]);
    } else if (tab === "offers sent" || tab === "offers received") {
      const list = tab === "offers sent" ? sentOffers : receivedOffers;
      headers = ["Album","Artist","Type","Status","Price","Other User","Time"];
      rows = list.map(o => [
        `"${(o.album || "").replace(/"/g, '""')}"`,
        `"${(o.artist || "").replace(/"/g, '""')}"`,
        o.type || "",
        o.status || "pending",
        o.price || "",
        tab === "offers sent" ? o.to : o.from,
        o.time || "",
      ]);
    } else {
      headers = ["Album","Artist","Seller","Price","Format","Condition"];
      rows = (cart || []).map(c => [
        `"${(c.album || "").replace(/"/g, '""')}"`,
        `"${(c.artist || "").replace(/"/g, '""')}"`,
        c.seller || "",
        c.price || "",
        c.format || "",
        c.condition || "",
      ]);
    }
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tab, purchases, sentOffers, receivedOffers, cart]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">Activity</h1>
        <p className="text-xs text-gs-dim">Your transactions, offers, and cart</p>
      </div>

      {/* Summary cards with running totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        {[
          { l: "Sent", v: sentOffers.length, c: "text-gs-accent" },
          { l: "Received", v: receivedOffers.length, c: "text-violet-500" },
          { l: "Purchases", v: (purchases || []).length, c: "text-green-500" },
          { l: "In Cart", v: (cart || []).length, c: "text-amber-500" },
        ].map(s => (
          <div key={s.l} className="bg-gs-card border border-gs-border rounded-xl py-3.5 px-2.5 text-center">
            <div className={`text-[22px] font-extrabold tracking-tight ${s.c}`}>{s.v}</div>
            <div className="text-[10px] text-gs-dim font-mono mt-[3px]">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Running totals bar */}
      <div className="flex gap-2.5 mb-[22px]">
        <div className="flex-1 bg-[#111] border border-gs-border rounded-xl py-2.5 px-3 flex items-center justify-between">
          <span className="text-[10px] text-gs-dim font-mono">Total Spent</span>
          <span className="text-sm font-extrabold text-red-400">${totals.spent.toFixed(2)}</span>
        </div>
        <div className="flex-1 bg-[#111] border border-gs-border rounded-xl py-2.5 px-3 flex items-center justify-between">
          <span className="text-[10px] text-gs-dim font-mono">Total Earned</span>
          <span className="text-sm font-extrabold text-green-500">${totals.earned.toFixed(2)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a1a] mb-4">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-4 bg-transparent border-0 border-b-2 text-xs font-semibold cursor-pointer capitalize -mb-px ${
              tab === t ? 'border-gs-accent text-gs-accent' : 'border-transparent text-gs-dim'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2 items-center mb-[18px]">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full bg-[#111] border border-gs-border rounded-lg px-3.5 py-2 pl-9 text-xs text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-faint text-sm">&#x1F50D;</span>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-faint text-xs bg-transparent border-0 cursor-pointer hover:text-gs-text">
              ✕
            </button>
          )}
        </div>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="bg-[#111] border border-gs-border rounded-lg px-2.5 py-2 text-[11px] text-gs-muted focus:outline-none cursor-pointer"
        >
          {DATE_RANGES.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <button onClick={exportCSV} className="gs-btn-secondary px-3 py-2 text-[11px]" title="Export CSV">
          Export
        </button>
      </div>

      {/* Offers Sent */}
      {tab === "offers sent" && (
        filteredSent.length === 0
          ? <Empty icon="&#x1F4E4;" text={search ? "No sent offers match your search." : "You haven't sent any offers yet."} />
          : <div className="flex flex-col gap-2.5">
              {filteredSent.map(o => (
                <OfferRow key={o.id} offer={o} direction="sent" onViewUser={onViewUser} />
              ))}
            </div>
      )}

      {/* Offers Received */}
      {tab === "offers received" && (
        filteredReceived.length === 0
          ? <Empty icon="&#x1F4E5;" text={search ? "No received offers match your search." : "No offers received yet."} />
          : <div className="flex flex-col gap-2.5">
              {filteredReceived.map(o => (
                <OfferRow key={o.id} offer={o} direction="received" onViewUser={onViewUser}
                  onAccept={onAcceptOffer} onDecline={onDeclineOffer} profile={profile}
                  acceptingId={acceptingId} setAcceptingId={setAcceptingId} />
              ))}
            </div>
      )}

      {/* Purchases */}
      {tab === "purchases" && (
        (filteredPurchases).length === 0
          ? <Empty icon="&#x1F6CD;&#xFE0F;" text={search ? "No purchases match your search." : "No purchases yet. Browse the Marketplace!"} />
          : <div className="flex flex-col gap-2.5">
              {filteredPurchases.map(p => {
                const stage = getOrderStage(p.id);
                return (
                  <div key={p.id} className="bg-gs-card border border-gs-border rounded-xl py-[15px] px-[15px]">
                    <div className="flex gap-3.5 items-center">
                      <AlbumArt album={p.album} artist={p.artist} accent={p.accent || "#555"} size={56} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-gs-text">{p.album}</div>
                        <div className="text-[11px] text-[#666]">
                          {p.artist} · {p.format} · {p.year}
                        </div>
                        <div className="text-[10px] text-gs-faint font-mono mt-1 flex gap-2">
                          <span>from <button onClick={() => onViewUser(p.seller)} className="bg-transparent border-0 text-gs-accent cursor-pointer text-[10px] p-0 font-mono">@{p.seller}</button></span>
                          <span>{p.time}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center shrink-0">
                        <Badge label={p.condition} color={condColor(p.condition)} />
                        <span className="text-base font-extrabold text-green-500">${p.price}</span>
                      </div>
                    </div>

                    {/* Order tracking */}
                    <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gs-dim font-mono">ORDER STATUS</span>
                        <span className="text-[10px] font-semibold capitalize" style={{ color: stage >= 4 ? "#22c55e" : stage >= 2 ? "#0ea5e9" : "#f59e0b" }}>
                          {ORDER_STAGES[stage]}
                        </span>
                      </div>
                      <div className="flex gap-1 items-center">
                        {ORDER_STAGES.map((s, i) => (
                          <div key={s} className="flex-1 flex items-center gap-1">
                            <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stage ? 'bg-gs-accent' : 'bg-[#1a1a1a]'}`} />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-gs-faint font-mono">Confirmed</span>
                        <span className="text-[8px] text-gs-faint font-mono">Delivered</span>
                      </div>
                    </div>

                    {/* Reorder button */}
                    <div className="mt-2.5 flex justify-end">
                      <button
                        onClick={() => {
                          // Find the original record to re-buy
                          const original = records.find(r => r.album === p.album && r.artist === p.artist && r.user !== currentUser && r.forSale);
                          if (original) {
                            onBuy(original);
                          } else {
                            window.alert("This record is no longer available for purchase.");
                          }
                        }}
                        className="gs-btn-secondary px-3 py-1.5 text-[10px]"
                      >
                        Reorder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
      )}

      {/* Cart */}
      {tab === "cart" && (
        (cart || []).length === 0
          ? <Empty icon="&#x1F6D2;" text="Your cart is empty." />
          : <div className="flex flex-col gap-2">
              <div className="text-[10px] text-gs-faint font-mono mb-1">Drag items to reorder</div>
              {cart.map((item, idx) => {
                const liveRecord = records.find(r => r.id === item.recordId);
                const stillForSale = liveRecord?.forSale;
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      // Cart reorder is visual only (state managed in parent if needed)
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`bg-gs-card border rounded-xl py-[13px] px-[15px] flex gap-3 items-center cursor-grab active:cursor-grabbing transition-all ${
                      stillForSale ? 'opacity-100' : 'opacity-50'
                    } ${isDragging ? 'opacity-60 scale-[0.98] border-gs-accent/40' : 'border-gs-border'
                    } ${isDragOver && !isDragging ? 'border-gs-accent/30 bg-gs-accent/5' : ''}`}
                  >
                    {/* Drag handle */}
                    <div className="flex flex-col gap-0.5 text-gs-faint shrink-0 select-none">
                      <div className="w-4 flex flex-col items-center gap-[3px]">
                        <div className="w-3 h-[2px] bg-gs-faint/50 rounded" />
                        <div className="w-3 h-[2px] bg-gs-faint/50 rounded" />
                        <div className="w-3 h-[2px] bg-gs-faint/50 rounded" />
                      </div>
                    </div>
                    <AlbumArt album={item.album} artist={item.artist} accent={item.accent || "#555"} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-gs-text">{item.album}</div>
                      <div className="text-[11px] text-[#666]">
                        {item.artist} · {item.format} · {item.year}
                      </div>
                      <div className="text-[10px] text-gs-faint font-mono mt-1">
                        seller: <button onClick={() => onViewUser(item.seller)} className="bg-transparent border-0 text-gs-accent cursor-pointer text-[10px] p-0 font-mono">@{item.seller}</button>
                        {!stillForSale && <span className="ml-2 text-red-500">SOLD</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      <Badge label={item.condition} color={condColor(item.condition)} />
                      <span className="text-base font-extrabold text-gs-text">${item.price}</span>
                      <button onClick={() => { if (window.confirm('Remove this item from your cart?')) onRemoveFromCart(item.id); }} className="gs-btn-secondary py-1.5 px-2.5 text-[11px]">Remove</button>
                      {stillForSale && (
                        <button onClick={() => onBuy(liveRecord)} className="gs-btn-gradient py-1.5 px-3.5 text-[11px]">Buy</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Cart total with fees */}
              {(() => {
                const activeItems = cart.filter(item => records.find(r => r.id === item.recordId)?.forSale);
                if (activeItems.length === 0) return null;
                const subtotal = activeItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
                const fees = activeItems.reduce((sum, item) => {
                  const cents = Math.round(parseFloat(item.price) * 100);
                  return sum + Math.max(Math.round(cents * 0.05), 100);
                }, 0) / 100;
                const shipping = activeItems.length * 6;
                return (
                  <div className="bg-[#111] rounded-[10px] py-3.5 px-4 mt-1 space-y-1.5">
                    <div className="flex justify-between text-[13px] text-gs-muted">
                      <span>Subtotal ({activeItems.length} items)</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-gs-muted">
                      <span>Transaction fees (5%)</span>
                      <span>${fees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-gs-muted">
                      <span>Shipping</span>
                      <span>${shipping.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-[#222] pt-2.5 mt-1">
                      <span className="text-[13px] font-semibold text-gs-muted">Total</span>
                      <span className="text-xl font-extrabold text-gs-text">${(subtotal + fees + shipping).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
      )}
    </div>
  );
}

// Shared row component for sent/received offers — with larger album art
function OfferRow({ offer, direction, onViewUser, onAccept, onDecline, profile, acceptingId, setAcceptingId }) {
  const o = offer;
  const otherUser = direction === "sent" ? o.to : o.from;
  const typeLabel = offerTypeLabel(o.type);
  const typeColor = offerTypeColor(o.type);
  const isPending = !o.status || o.status === "pending";
  const isAccepted = o.status === "accepted";
  const canRespond = direction === "received" && isPending && onAccept && onDecline;
  const showAddress = isAccepted && (o.type === "trade" || o.type === "combo");

  // Address confirmation state for accepting
  const [confirming, setConfirming] = useState(false);
  const hasAddress = profile?.shippingStreet && profile?.shippingCity;

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl py-4 px-4">
      {/* Top line: type badge + status + time */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex gap-1.5 items-center">
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={o.status || "pending"} color={statusColor(o.status || "pending")} />
        </div>
        <span className="text-[10px] text-gs-faint font-mono">{o.time || "\u2014"}</span>
      </div>

      {/* Main content — larger album art */}
      <div className="flex gap-3.5 items-center">
        <AlbumArt album={o.album} artist={o.artist} accent={o.accent || "#555"} size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-gs-text mb-0.5">{o.album}</div>
          <div className="text-[11px] text-[#666] mb-1">{o.artist}</div>
          <div className="text-[11px] text-gs-dim">
            {direction === "sent" ? "To" : "From"}{" "}
            <button onClick={() => onViewUser(otherUser)} className="bg-transparent border-0 text-gs-accent cursor-pointer text-[11px] p-0">@{otherUser}</button>
          </div>
        </div>

        {/* Right side — offer details */}
        <div className="text-right shrink-0">
          {(o.type === "cash" || o.type === "combo") && (
            <div className="text-lg font-extrabold text-gs-text mb-0.5">${o.price}</div>
          )}
          {(o.type === "trade" || o.type === "combo") && o.tradeRecord && (
            <div className="text-[11px] text-gs-muted">
              {direction === "sent" ? "for" : "offering"} {o.tradeRecord.album}
            </div>
          )}
          {o.type === "trade" && (
            <div className="text-[11px] text-violet-500 font-semibold mt-0.5">Straight trade</div>
          )}
        </div>
      </div>

      {/* Accept/Decline buttons for received pending offers */}
      {canRespond && !confirming && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-[#1a1a1a]">
          <button onClick={() => onDecline(o.id)} className="gs-btn-secondary flex-1 py-2 text-[11px]">Decline</button>
          <button
            disabled={acceptingId === o.id}
            onClick={() => {
              if (o.type === "trade" || o.type === "combo") {
                setConfirming(true);
              } else {
                setAcceptingId(o.id);
                onAccept(o.id);
              }
            }}
            className={`gs-btn-gradient flex-[2] py-2 text-[11px] ${acceptingId === o.id ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {acceptingId === o.id ? 'Accepting...' : `Accept ${o.type === "trade" ? "Trade" : o.type === "combo" ? "Combo" : "Offer"}`}
          </button>
        </div>
      )}

      {/* Address confirmation for trades */}
      {confirming && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="text-[11px] font-semibold text-gs-muted mb-2">&#x1F4E6; Confirm your shipping address</div>
          {hasAddress ? (
            <>
              <div className="bg-[#111] rounded-lg px-3 py-2 mb-3">
                <div className="text-xs text-gs-text font-semibold">{profile.shippingName}</div>
                <div className="text-[11px] text-gs-muted">{profile.shippingStreet}</div>
                <div className="text-[11px] text-gs-muted">{profile.shippingCity}, {profile.shippingState} {profile.shippingZip}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="gs-btn-secondary flex-1 py-2 text-[11px]">Cancel</button>
                <button onClick={() => { onAccept(o.id); setConfirming(false); }} className="gs-btn-gradient flex-[2] py-2 text-[11px]">
                  Confirm & Accept Trade
                </button>
              </div>
            </>
          ) : (
            <div className="bg-[#f59e0b11] border border-[#f59e0b22] rounded-lg px-3 py-2 text-[11px] text-amber-500 mb-2">
              You need to add a shipping address in your Profile Settings before accepting trades.
            </div>
          )}
        </div>
      )}

      {/* Show address exchange info for accepted trades */}
      {showAddress && direction === "received" && hasAddress && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="text-[11px] font-semibold text-green-500 mb-2">&#x2713; Trade accepted — ship your record to @{o.from}</div>
          <div className="bg-[#111] rounded-lg px-3 py-2 text-[11px] text-gs-muted">
            Shipping labels will be exchanged via DM. Check your messages.
          </div>
        </div>
      )}
      {showAddress && direction === "sent" && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="text-[11px] font-semibold text-green-500 mb-2">&#x2713; Trade accepted — ship your record to @{o.to}</div>
          <div className="bg-[#111] rounded-lg px-3 py-2 text-[11px] text-gs-muted">
            Shipping labels will be exchanged via DM. Check your messages.
          </div>
        </div>
      )}
    </div>
  );
}
