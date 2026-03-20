// 3-step purchase flow: shipping info → payment details → confirmation.
// Step 1 collects name and address; step 2 collects card details (digits only, auto-formatted).
// On confirm, calls onPurchase(record.id) in App.js which marks the record as no longer for sale.
// reset() clears all fields and returns to step 1 — called on both cancel and successful purchase.
import { useState } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import { condColor } from '../../utils/helpers';

export default function BuyModal({ open, onClose, record, onPurchase, onAddToCart }) {
  // step 1 = shipping, step 2 = payment, step 3 = confirmation
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [err, setErr] = useState("");

  const reset = () => { setStep(1); setName(""); setAddress(""); setCity(""); setCard(""); setExpiry(""); setCvv(""); setErr(""); };

  if (!record) return null;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Purchase Record" width="420px">
      <div className="flex gap-3.5 items-center bg-[#111] rounded-[10px] p-3.5 mb-5">
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div className="flex-1">
          <div className="text-sm font-bold text-gs-text">{record.album}</div>
          <div className="text-xs text-[#666] mt-0.5 flex items-center gap-1.5">
            {record.artist} · <Badge label={record.condition} color={condColor(record.condition)} />
          </div>
        </div>
        <div className="text-[22px] font-extrabold text-gs-text">${record.price}</div>
      </div>

      {step === 1 && (
        <>
          {err && <div className="bg-[#ef444422] border border-[#ef444444] rounded-lg px-3 py-2 text-[#f87171] text-xs mb-3.5">{err}</div>}
          <FormInput label="FULL NAME" value={name} onChange={setName} placeholder="Jane Smith" />
          <FormInput label="STREET ADDRESS" value={address} onChange={setAddress} placeholder="123 Vinyl Lane" />
          <FormInput label="CITY, STATE, ZIP" value={city} onChange={setCity} placeholder="Chicago, IL 60601" />
          <div className="flex gap-2.5">
            <button onClick={() => { reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Cancel</button>
            {onAddToCart && <button onClick={() => { onAddToCart(record); reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-[#f59e0b44] rounded-[10px] text-amber-500 text-[13px] font-semibold cursor-pointer">+ Cart</button>}
            <button onClick={() => { if (!name || !address || !city) { setErr("All fields required."); return; } setErr(""); setStep(2); }} className="flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">Continue →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bg-[#111] rounded-lg px-3.5 py-2.5 text-xs text-gs-muted mb-4">
            Shipping to: <span className="text-gs-text">{name}, {city}</span>
          </div>
          {err && <div className="bg-[#ef444422] border border-[#ef444444] rounded-lg px-3 py-2 text-[#f87171] text-xs mb-3.5">{err}</div>}
          <FormInput label="CARD NUMBER" value={card} onChange={v => setCard(v.replace(/\D/g, "").slice(0, 16))} placeholder="4242 4242 4242 4242" />
          <div className="grid grid-cols-2 gap-x-3.5">
            <FormInput label="EXPIRY" value={expiry} onChange={v => { let c = v.replace(/\D/g, "").slice(0, 4); if (c.length >= 2) c = c.slice(0, 2) + "/" + c.slice(2); setExpiry(c); }} placeholder="MM/YY" />
            <FormInput label="CVV" value={cvv} onChange={v => setCvv(v.replace(/\D/g, "").slice(0, 3))} placeholder="123" />
          </div>
          <div className="bg-[#111] rounded-[10px] p-3.5 mb-5">
            {[["Record", `$${record.price}`], ["Shipping", "$6.00"], ["Total", `$${(parseFloat(record.price) + 6).toFixed(2)}`]].map(([k, v], i) => (
              <div key={k} className={`flex justify-between ${i === 2 ? 'text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5' : 'text-[13px] font-normal text-gs-muted'} ${i < 2 ? 'mb-1.5' : ''}`}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setStep(1)} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">← Back</button>
            <button onClick={() => { if (!card || card.length < 12 || !expiry || !cvv) { setErr("Fill in all payment details."); return; } onPurchase(record.id); setStep(3); }} className="flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">Confirm Purchase</button>
          </div>
        </>
      )}

      {step === 3 && (
        <div className="text-center py-6">
          <div className="text-5xl mb-3.5">🎉</div>
          <div className="text-lg font-extrabold text-gs-text mb-2">Order Confirmed!</div>
          <p className="text-[13px] text-[#666] leading-[1.7] mb-6">
            <strong className="text-gs-text">{record.album}</strong> is on its way to {city}.
          </p>
          <button onClick={() => { reset(); onClose(); }} className="px-7 py-[11px] bg-gs-accent border-none rounded-[10px] text-black font-bold cursor-pointer text-[13px]">Done</button>
        </div>
      )}
    </Modal>
  );
}
