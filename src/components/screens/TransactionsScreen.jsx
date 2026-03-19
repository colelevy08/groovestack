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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em", color: "#f5f5f5", marginBottom: 2 }}>Activity</h1>
        <p style={{ fontSize: 12, color: "#555" }}>Your transactions, offers, and cart</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 22 }}>
        {[
          { l: "Sent", v: sentOffers.length, c: "#0ea5e9" },
          { l: "Received", v: receivedOffers.length, c: "#8b5cf6" },
          { l: "Purchases", v: (purchases || []).length, c: "#22c55e" },
          { l: "In Cart", v: (cart || []).length, c: "#f59e0b" },
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

      {/* Offers Sent */}
      {tab === "offers sent" && (
        sentOffers.length === 0
          ? <Empty icon="📤" text="You haven't sent any offers yet." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sentOffers.map(o => (
                <OfferRow key={o.id} offer={o} direction="sent" onViewUser={onViewUser} />
              ))}
            </div>
      )}

      {/* Offers Received */}
      {tab === "offers received" && (
        receivedOffers.length === 0
          ? <Empty icon="📥" text="No offers received yet." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {receivedOffers.map(o => (
                <OfferRow key={o.id} offer={o} direction="received" onViewUser={onViewUser} />
              ))}
            </div>
      )}

      {/* Purchases */}
      {tab === "purchases" && (
        (purchases || []).length === 0
          ? <Empty icon="🛍️" text="No purchases yet. Browse the Marketplace!" />
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {purchases.map(p => (
                <div key={p.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "13px 15px", display: "flex", gap: 12, alignItems: "center" }}>
                  <AlbumArt album={p.album} artist={p.artist} accent={p.accent || "#555"} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{p.album}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {p.artist} · {p.format} · {p.year}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", marginTop: 4, display: "flex", gap: 8 }}>
                      <span>from <button onClick={() => onViewUser(p.seller)} style={{ background: "none", border: "none", color: "#0ea5e9", cursor: "pointer", fontSize: 10, padding: 0, fontFamily: "'DM Mono',monospace" }}>@{p.seller}</button></span>
                      <span>{p.time}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <Badge label={p.condition} color={condColor(p.condition)} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#22c55e" }}>${p.price}</span>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Cart */}
      {tab === "cart" && (
        (cart || []).length === 0
          ? <Empty icon="🛒" text="Your cart is empty." />
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cart.map(item => {
                const liveRecord = records.find(r => r.id === item.recordId);
                const stillForSale = liveRecord?.forSale;
                return (
                  <div key={item.id} style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "13px 15px", display: "flex", gap: 12, alignItems: "center", opacity: stillForSale ? 1 : 0.5 }}>
                    <AlbumArt album={item.album} artist={item.artist} accent={item.accent || "#555"} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5" }}>{item.album}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {item.artist} · {item.format} · {item.year}
                      </div>
                      <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                        seller: <button onClick={() => onViewUser(item.seller)} style={{ background: "none", border: "none", color: "#0ea5e9", cursor: "pointer", fontSize: 10, padding: 0, fontFamily: "'DM Mono',monospace" }}>@{item.seller}</button>
                        {!stillForSale && <span style={{ marginLeft: 8, color: "#ef4444" }}>SOLD</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      <Badge label={item.condition} color={condColor(item.condition)} />
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#f5f5f5" }}>${item.price}</span>
                      <button onClick={() => onRemoveFromCart(item.id)} style={{ padding: "6px 10px", borderRadius: 7, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#666", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>Remove</button>
                      {stillForSale && (
                        <button onClick={() => onBuy(liveRecord)} style={{ padding: "6px 14px", borderRadius: 7, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Buy</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Cart total */}
              {cart.filter(item => records.find(r => r.id === item.recordId)?.forSale).length > 0 && (
                <div style={{ background: "#111", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#888" }}>Cart Total ({cart.filter(item => records.find(r => r.id === item.recordId)?.forSale).length} items)</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#f5f5f5" }}>
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
    <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
      {/* Top line: type badge + status + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Badge label={typeLabel} color={typeColor} />
          <Badge label={o.status || "pending"} color={statusColor(o.status || "pending")} />
        </div>
        <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono',monospace" }}>{o.time || "—"}</span>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {o.type === "trade" ? "🔄" : o.type === "combo" ? "🤝" : "💰"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f5f5f5", marginBottom: 2 }}>{o.album}</div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{o.artist}</div>
          <div style={{ fontSize: 11, color: "#555" }}>
            {direction === "sent" ? "To" : "From"}{" "}
            <button onClick={() => onViewUser(otherUser)} style={{ background: "none", border: "none", color: "#0ea5e9", cursor: "pointer", fontSize: 11, padding: 0 }}>@{otherUser}</button>
          </div>
        </div>

        {/* Right side — offer details */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {(o.type === "cash" || o.type === "combo") && (
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f5f5f5", marginBottom: 2 }}>${o.price}</div>
          )}
          {(o.type === "trade" || o.type === "combo") && o.tradeRecord && (
            <div style={{ fontSize: 11, color: "#888" }}>
              {direction === "sent" ? "for" : "offering"} {o.tradeRecord.album}
            </div>
          )}
          {o.type === "trade" && (
            <div style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600, marginTop: 2 }}>Straight trade</div>
          )}
        </div>
      </div>
    </div>
  );
}
