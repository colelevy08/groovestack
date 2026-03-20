// Transactions hub — shows the current user's activity across four tabs:
// Offers Sent, Offers Received, Purchases, and Cart.
// Offers show type-specific icons and status badges. Cart items can be bought or removed.
import { useState } from 'react';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import Empty from '../ui/Empty';
import { condColor } from '../../utils/helpers';

const TABS = ["offers sent", "offers received", "purchases", "cart"];

// Maps offer type → display label and accent color
const offerTypeLabel = t => t === "trade" ? "Trade" : t === "combo" ? "Combo" : "Cash";
const offerTypeColor = t => t === "trade" ? "#8b5cf6" : t === "combo" ? "#f59e0b" : "#0ea5e9";

// Status badge colors for offers
const statusColor = s => s === "pending" ? "#f59e0b" : s === "accepted" ? "#22c55e" : s === "declined" ? "#ef4444" : "#555";

export default function TransactionsScreen({ offers, purchases, cart, currentUser, records, onBuy, onRemoveFromCart, onViewUser, onDetail }) {
  const [tab, setTab] = useState("offers sent");

  const sentOffers = (offers || []).filter(o => o.from === currentUser);
  const receivedOffers = (offers || []).filter(o => o.to === currentUser);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">Activity</h1>
        <p className="text-xs text-gs-dim">Your transactions, offers, and cart</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2.5 mb-[22px]">
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

      {/* Tabs */}
      <div className="flex border-b border-[#1a1a1a] mb-[18px]">
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

      {/* Offers Sent */}
      {tab === "offers sent" && (
        sentOffers.length === 0
          ? <Empty icon="📤" text="You haven't sent any offers yet." />
          : <div className="flex flex-col gap-2">
              {sentOffers.map(o => (
                <OfferRow key={o.id} offer={o} direction="sent" onViewUser={onViewUser} />
              ))}
            </div>
      )}

      {/* Offers Received */}
      {tab === "offers received" && (
        receivedOffers.length === 0
          ? <Empty icon="📥" text="No offers received yet." />
          : <div className="flex flex-col gap-2">
              {receivedOffers.map(o => (
                <OfferRow key={o.id} offer={o} direction="received" onViewUser={onViewUser} />
              ))}
            </div>
      )}

      {/* Purchases */}
      {tab === "purchases" && (
        (purchases || []).length === 0
          ? <Empty icon="🛍️" text="No purchases yet. Browse the Marketplace!" />
          : <div className="flex flex-col gap-2">
              {purchases.map(p => (
                <div key={p.id} className="bg-gs-card border border-gs-border rounded-xl py-[13px] px-[15px] flex gap-3 items-center">
                  <AlbumArt album={p.album} artist={p.artist} accent={p.accent || "#555"} size={40} />
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
              ))}
            </div>
      )}

      {/* Cart */}
      {tab === "cart" && (
        (cart || []).length === 0
          ? <Empty icon="🛒" text="Your cart is empty." />
          : <div className="flex flex-col gap-2">
              {cart.map(item => {
                const liveRecord = records.find(r => r.id === item.recordId);
                const stillForSale = liveRecord?.forSale;
                return (
                  <div key={item.id} className={`bg-gs-card border border-gs-border rounded-xl py-[13px] px-[15px] flex gap-3 items-center ${stillForSale ? 'opacity-100' : 'opacity-50'}`}>
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
                      <button onClick={() => onRemoveFromCart(item.id)} className="gs-btn-secondary py-1.5 px-2.5 text-[11px]">Remove</button>
                      {stillForSale && (
                        <button onClick={() => onBuy(liveRecord)} className="gs-btn-gradient py-1.5 px-3.5 text-[11px]">Buy</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Cart total */}
              {cart.filter(item => records.find(r => r.id === item.recordId)?.forSale).length > 0 && (
                <div className="bg-[#111] rounded-[10px] py-3.5 px-4 flex justify-between items-center mt-1">
                  <span className="text-[13px] text-gs-muted">Cart Total ({cart.filter(item => records.find(r => r.id === item.recordId)?.forSale).length} items)</span>
                  <span className="text-xl font-extrabold text-gs-text">
                    ${cart.filter(item => records.find(r => r.id === item.recordId)?.forSale).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
      )}
    </div>
  );
}

// Shared row component for sent/received offers
function OfferRow({ offer, direction, onViewUser }) {
  const o = offer;
  const otherUser = direction === "sent" ? o.to : o.from;
  const typeLabel = offerTypeLabel(o.type);
  const typeColor = offerTypeColor(o.type);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl py-3.5 px-4">
      {/* Top line: type badge + status + time */}
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex gap-1.5 items-center">
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={o.status || "pending"} color={statusColor(o.status || "pending")} />
        </div>
        <span className="text-[10px] text-gs-faint font-mono">{o.time || "—"}</span>
      </div>

      {/* Main content */}
      <div className="flex gap-3 items-center">
        <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-base shrink-0">
          {o.type === "trade" ? "🔄" : o.type === "combo" ? "🤝" : "💰"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-gs-text mb-0.5">{o.album}</div>
          <div className="text-[11px] text-[#666] mb-1">{o.artist}</div>
          <div className="text-[11px] text-gs-dim">
            {direction === "sent" ? "To" : "From"}{" "}
            <button onClick={() => onViewUser(otherUser)} className="bg-transparent border-0 text-gs-accent cursor-pointer text-[11px] p-0">@{otherUser}</button>
          </div>
        </div>

        {/* Right side — offer details */}
        <div className="text-right shrink-0">
          {(o.type === "cash" || o.type === "combo") && (
            <div className="text-base font-extrabold text-gs-text mb-0.5">${o.price}</div>
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
    </div>
  );
}
