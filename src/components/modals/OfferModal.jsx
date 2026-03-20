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
      <div className="bg-[#111] rounded-[10px] p-3.5 mb-3">
        <div className="text-[11px] text-gs-dim font-mono mb-2">THEY WANT</div>
        <div className="flex gap-3 items-center">
          <div className="w-[38px] h-[38px] rounded-full bg-[#1a1a1a] flex items-center justify-center text-base shrink-0">✨</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gs-text">{target.wishlistItem.album}</div>
            <div className="text-xs text-[#666] mt-0.5">{target.wishlistItem.artist}</div>
          </div>
          <span className="text-[11px] text-gs-accent font-mono">@{target.targetUser}</span>
        </div>
      </div>

      {/* Your record being offered */}
      {target.offeredRecord && (
        <div className="bg-[#111] rounded-[10px] p-3.5 mb-4">
          <div className="text-[11px] text-gs-dim font-mono mb-2">YOUR RECORD</div>
          <div className="flex gap-3 items-center">
            <AlbumArt album={target.offeredRecord.album} artist={target.offeredRecord.artist} accent={target.offeredRecord.accent} size={38} />
            <div className="flex-1">
              <div className="text-sm font-bold text-gs-text">{target.offeredRecord.album}</div>
              <div className="text-xs text-[#666] mt-0.5">{target.offeredRecord.artist}</div>
            </div>
            <Badge label={target.offeredRecord.condition} color={condColor(target.offeredRecord.condition)} />
          </div>
        </div>
      )}

      {/* Offer type tabs */}
      <div className="flex gap-1.5 mb-4">
        {typeLabels.map(([val, label]) => (
          <button key={val} onClick={() => { setOfferType(val); setErr(""); }}
            className={`flex-1 py-2 px-1 rounded-lg border-none text-xs font-bold cursor-pointer ${
              offerType === val
                ? "gs-btn-gradient text-white"
                : "bg-[#1a1a1a] text-[#666]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <div className="bg-red-500/[0.13] border border-red-500/[0.27] rounded-lg px-3 py-2 text-red-400 text-xs mb-3.5">{err}</div>}

      {/* Record picker — shown for trade and combo */}
      {offerType !== "cash" && (
        <div className="mb-4">
          <div className="text-[11px] text-gs-dim font-mono mb-2">
            PICK A RECORD FROM @{target.targetUser}
          </div>
          <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1.5 border border-gs-border rounded-[10px] p-2">
            {targetRecords.length === 0 ? (
              <div className="p-5 text-center text-gs-faint text-xs">No records in their collection.</div>
            ) : targetRecords.map(r => {
              const selected = selectedTradeRecord?.id === r.id;
              return (
                <div key={r.id} onClick={() => setSelectedTradeRecord(r)}
                  className={`flex gap-2.5 items-center px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-[120ms] ${
                    selected ? "" : "bg-gs-card border border-[#1a1a1a]"
                  }`}
                  style={selected ? {
                    background: r.accent + "15",
                    border: `1px solid ${r.accent}55`,
                  } : undefined}
                >
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gs-text overflow-hidden text-ellipsis whitespace-nowrap">{r.album}</div>
                    <div className="text-[10px] text-[#666]">{r.artist}</div>
                  </div>
                  <Badge label={r.condition} color={condColor(r.condition)} />
                  {selected && <span className="text-sm shrink-0" style={{ color: r.accent }}>✓</span>}
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
      <div className="bg-[#111] rounded-[10px] p-3.5 mb-5">
        {offerType === "cash" && (
          [["Offer", `$${(parseFloat(price) || 0).toFixed(2)}`], ["Shipping", `$${(parseFloat(shipping) || 0).toFixed(2)}`], ["Total", `$${total.toFixed(2)}`]].map(([k, v], i) => (
            <div key={k} className={`flex justify-between ${
              i === 2 ? "text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5" : "text-[13px] font-normal text-gs-muted"
            } ${i < 2 ? "mb-1.5" : ""}`}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))
        )}
        {offerType === "trade" && (
          <>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You give</span><span className="text-gs-text">{target.wishlistItem.album}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You get</span><span className="text-gs-text">{selectedTradeRecord?.album || "—"}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5">
              <span>Type</span><span>Straight trade</span>
            </div>
          </>
        )}
        {offerType === "combo" && (
          <>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You give</span><span className="text-gs-text">{target.wishlistItem.album}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You get</span><span className="text-gs-text">{selectedTradeRecord?.album || "—"}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>+ Cash</span><span>${(parseFloat(price) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>Shipping</span><span>${(parseFloat(shipping) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5">
              <span>Total cash</span><span>${total.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2.5">
        <button onClick={() => { reset(); onClose(); }} className="flex-1 py-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Cancel</button>
        <button onClick={handleSubmit} className="flex-[2] py-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">
          {offerType === "cash" ? "Send Offer" : offerType === "trade" ? "Send Trade Offer" : "Send Combo Offer"}
        </button>
      </div>
    </Modal>
  );
}
