// Modal for sending offers to users who have an album on their wishlist.
// Supports 3 offer types: Cash (price + shipping), Trade (swap records), or Combo (record + cash).
// The offerer always gives up the record matching the target's wishlist item.
// What they receive varies: cash, one of the target's records, or a record + cash.
import { useState } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import { condColor } from '../../utils/helpers';

export default function OfferModal({ open, onClose, target, records, onSubmit }) {
  const [offerType, setOfferType] = useState("cash");
  const [price, setPrice] = useState("");
  const [shipping, setShipping] = useState("6.00");
  const [selectedTradeRecord, setSelectedTradeRecord] = useState(null);
  const [err, setErr] = useState("");

  const reset = () => { setOfferType("cash"); setPrice(""); setShipping("6.00"); setSelectedTradeRecord(null); setErr(""); };

  if (!target) return null;

  const targetRecords = (records || []).filter(r => r.user === target.targetUser);
  const total = (parseFloat(price) || 0) + (parseFloat(shipping) || 0);

  const handleSubmit = () => {
    if (offerType === "cash" && (!price || parseFloat(price) <= 0)) { setErr("Enter a valid offer price."); return; }
    if (offerType === "trade" && !selectedTradeRecord) { setErr("Select a record to trade for."); return; }
    if (offerType === "combo" && !selectedTradeRecord) { setErr("Select a record to trade for."); return; }
    if (offerType === "combo" && (!price || parseFloat(price) <= 0)) { setErr("Enter additional cash amount."); return; }

    onSubmit({
      type: offerType,
      price: offerType !== "trade" ? price : "0",
      shipping: offerType !== "trade" ? shipping : "0",
      tradeRecord: offerType !== "cash" ? {
        id: selectedTradeRecord.id,
        album: selectedTradeRecord.album,
        artist: selectedTradeRecord.artist,
        condition: selectedTradeRecord.condition,
        accent: selectedTradeRecord.accent,
      } : null,
    });
    reset();
  };

  const typeLabels = [["cash", "Cash"], ["trade", "Trade"], ["combo", "Trade + Cash"]];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Make an Offer" width="460px">
      {/* What they want — wishlist item */}
      <div style={{ background: "#111", borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>THEY WANT</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{target.wishlistItem.album}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{target.wishlistItem.artist}</div>
          </div>
          <span style={{ fontSize: 11, color: "#0ea5e9", fontFamily: "'DM Mono',monospace" }}>@{target.targetUser}</span>
        </div>
      </div>

      {/* Your record being offered */}
      {target.offeredRecord && (
        <div style={{ background: "#111", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>YOUR RECORD</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <AlbumArt album={target.offeredRecord.album} artist={target.offeredRecord.artist} accent={target.offeredRecord.accent} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{target.offeredRecord.album}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{target.offeredRecord.artist}</div>
            </div>
            <Badge label={target.offeredRecord.condition} color={condColor(target.offeredRecord.condition)} />
          </div>
        </div>
      )}

      {/* Offer type tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {typeLabels.map(([val, label]) => (
          <button key={val} onClick={() => { setOfferType(val); setErr(""); }}
            style={{
              flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: offerType === val ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "#1a1a1a",
              color: offerType === val ? "#fff" : "#666",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12, marginBottom: 14 }}>{err}</div>}

      {/* Record picker — shown for trade and combo */}
      {offerType !== "cash" && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>
            PICK A RECORD FROM @{target.targetUser}
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid #1e1e1e", borderRadius: 10, padding: 8 }}>
            {targetRecords.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#444", fontSize: 12 }}>No records in their collection.</div>
            ) : targetRecords.map(r => {
              const selected = selectedTradeRecord?.id === r.id;
              return (
                <div key={r.id} onClick={() => setSelectedTradeRecord(r)}
                  style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "8px 10px",
                    borderRadius: 8, cursor: "pointer",
                    background: selected ? r.accent + "15" : "#0f0f0f",
                    border: `1px solid ${selected ? r.accent + "55" : "#1a1a1a"}`,
                    transition: "all 0.12s",
                  }}>
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.album}</div>
                    <div style={{ fontSize: 10, color: "#666" }}>{r.artist}</div>
                  </div>
                  <Badge label={r.condition} color={condColor(r.condition)} />
                  {selected && <span style={{ color: r.accent, fontSize: 14, flexShrink: 0 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cash fields — shown for cash and combo */}
      {offerType !== "trade" && (
        <>
          <FormInput label={offerType === "combo" ? "ADDITIONAL CASH (USD)" : "OFFER PRICE (USD)"} value={price} onChange={v => setPrice(v.replace(/[^\d.]/g, ""))} placeholder="25.00" />
          <FormInput label="SHIPPING & HANDLING (USD)" value={shipping} onChange={v => setShipping(v.replace(/[^\d.]/g, ""))} placeholder="6.00" />
        </>
      )}

      {/* Summary */}
      <div style={{ background: "#111", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        {offerType === "cash" && (
          [["Offer", `$${(parseFloat(price) || 0).toFixed(2)}`], ["Shipping", `$${(parseFloat(shipping) || 0).toFixed(2)}`], ["Total", `$${total.toFixed(2)}`]].map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: i === 2 ? 15 : 13, fontWeight: i === 2 ? 700 : 400, color: i === 2 ? "#f5f5f5" : "#888", borderTop: i === 2 ? "1px solid #222" : undefined, paddingTop: i === 2 ? 10 : undefined, marginTop: i === 2 ? 10 : 0, marginBottom: i < 2 ? 6 : 0 }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))
        )}
        {offerType === "trade" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>You give</span><span style={{ color: "#f5f5f5" }}>{target.wishlistItem.album}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>You get</span><span style={{ color: "#f5f5f5" }}>{selectedTradeRecord?.album || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#f5f5f5", borderTop: "1px solid #222", paddingTop: 10, marginTop: 10 }}>
              <span>Type</span><span>Straight trade</span>
            </div>
          </>
        )}
        {offerType === "combo" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>You give</span><span style={{ color: "#f5f5f5" }}>{target.wishlistItem.album}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>You get</span><span style={{ color: "#f5f5f5" }}>{selectedTradeRecord?.album || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>+ Cash</span><span>${(parseFloat(price) || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#888", marginBottom: 6 }}>
              <span>Shipping</span><span>${(parseFloat(shipping) || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: "#f5f5f5", borderTop: "1px solid #222", paddingTop: 10, marginTop: 10 }}>
              <span>Total cash</span><span>${total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => { reset(); onClose(); }} style={{ flex: 1, padding: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} style={{ flex: 2, padding: 11, background: "linear-gradient(135deg,#f59e0b,#ef4444)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {offerType === "cash" ? "Send Offer" : offerType === "trade" ? "Send Trade Offer" : "Send Combo Offer"}
        </button>
      </div>
    </Modal>
  );
}
