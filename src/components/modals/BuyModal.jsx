// 2-step purchase flow: shipping info → Stripe Checkout redirect.
// Step 1 collects name and address; step 2 shows order summary with platform fee, then redirects to Stripe.
// On return from Stripe (?checkout=success), App.js marks the record as sold.
import { useState } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import { condColor } from '../../utils/helpers';
import { API_BASE } from '../../utils/api';
import { getToken } from '../../utils/supabase';

function calcFee(price) {
  const priceCents = Math.round(parseFloat(price) * 100);
  return Math.max(Math.round(priceCents * 0.05), 100) / 100;
}

export default function BuyModal({ open, onClose, record, onPurchase, onAddToCart, profile }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill from profile shipping address when modal opens
  if (open && !prefilled && profile) {
    if (profile.shippingName || profile.shippingStreet) {
      setName(profile.shippingName || '');
      setStreet(profile.shippingStreet || '');
      setCity(profile.shippingCity || '');
      setState(profile.shippingState || '');
      setZip(profile.shippingZip || '');
    }
    setPrefilled(true);
  }

  const reset = () => { setStep(1); setName(""); setStreet(""); setCity(""); setState(""); setZip(""); setErr(""); setLoading(false); setPrefilled(false); };

  if (!record) return null;

  const price = parseFloat(record.price);
  const fee = calcFee(record.price);
  const shipping = 6;
  const total = price + fee + shipping;

  const handleCheckout = async () => {
    setLoading(true);
    setErr("");
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/checkout/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recordId: record.id,
          album: record.album,
          artist: record.artist,
          price: record.price,
          condition: record.condition,
          seller: record.user,
          shippingName: name,
          shippingStreet: street,
          shippingCity: city,
          shippingState: state,
          shippingZip: zip,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        setErr(data.error || "Checkout unavailable. Please try again.");
        setLoading(false);
      }
    } catch {
      setErr("Could not connect to payment service.");
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Purchase Record" width="420px">
      {/* Record summary */}
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
          {(profile?.shippingStreet) && (
            <div className="bg-[#0ea5e911] border border-[#0ea5e922] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-3">
              ✓ Pre-filled from your profile. Please confirm your address is correct.
            </div>
          )}
          <FormInput label="FULL NAME" value={name} onChange={setName} placeholder="Jane Smith" />
          <FormInput label="STREET ADDRESS" value={street} onChange={setStreet} placeholder="123 Vinyl Lane, Apt 4" />
          <div className="grid grid-cols-3 gap-2.5">
            <FormInput label="CITY" value={city} onChange={setCity} placeholder="Chicago" />
            <FormInput label="STATE" value={state} onChange={setState} placeholder="IL" />
            <FormInput label="ZIP" value={zip} onChange={setZip} placeholder="60601" />
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => { reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Cancel</button>
            {onAddToCart && <button onClick={() => { onAddToCart(record); reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-[#f59e0b44] rounded-[10px] text-amber-500 text-[13px] font-semibold cursor-pointer">+ Cart</button>}
            <button onClick={() => { if (!name || !street || !city || !state || !zip) { setErr("All address fields are required."); return; } setErr(""); setStep(2); }} className="flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">Continue →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bg-[#111] rounded-lg px-3.5 py-2.5 text-xs text-gs-muted mb-4">
            Shipping to: <span className="text-gs-text">{name}, {street}, {city}, {state} {zip}</span>
          </div>
          {err && <div className="bg-[#ef444422] border border-[#ef444444] rounded-lg px-3 py-2 text-[#f87171] text-xs mb-3.5">{err}</div>}

          {/* Order breakdown */}
          <div className="bg-[#111] rounded-[10px] p-3.5 mb-5">
            {[
              ["Record", `$${price.toFixed(2)}`],
              ["Shipping", `$${shipping.toFixed(2)}`],
              ["Transaction fee (5%)", `$${fee.toFixed(2)}`],
              ["Total", `$${total.toFixed(2)}`],
            ].map(([k, v], i) => (
              <div key={k} className={`flex justify-between ${i === 3 ? 'text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5' : 'text-[13px] text-gs-muted'} ${i < 3 ? 'mb-1.5' : ''}`}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-[#0ea5e911] border border-[#0ea5e922] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-4">
            💳 You'll be redirected to Stripe for secure payment
          </div>

          <div className="flex gap-2.5">
            <button onClick={() => setStep(1)} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">← Back</button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className={`flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer ${loading ? 'opacity-60' : ''}`}
            >
              {loading ? "Redirecting…" : `Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
