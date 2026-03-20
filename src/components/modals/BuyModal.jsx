// 2-step purchase flow: shipping info -> Stripe Checkout redirect.
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

// #22 — Shipping cost calculator (simplified distance-based estimation)
function calcShipping(sellerZip, buyerZip) {
  if (!sellerZip || !buyerZip) return 6;
  const sellerRegion = parseInt(sellerZip.toString().charAt(0), 10);
  const buyerRegion = parseInt(buyerZip.toString().charAt(0), 10);
  const diff = Math.abs(sellerRegion - buyerRegion);
  if (diff === 0) return 4.50;
  if (diff <= 2) return 6.00;
  if (diff <= 4) return 7.50;
  return 9.00;
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

  // #23 — Insurance option
  const [addInsurance, setAddInsurance] = useState(false);
  // #24 — Gift wrapping
  const [giftWrap, setGiftWrap] = useState(false);
  // #25 — Order notes
  const [orderNotes, setOrderNotes] = useState("");
  // #27 — Express checkout
  const [expressMode, setExpressMode] = useState(false);

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

  const reset = () => {
    setStep(1); setName(""); setStreet(""); setCity(""); setState(""); setZip(""); setErr("");
    setLoading(false); setPrefilled(false); setAddInsurance(false); setGiftWrap(false);
    setOrderNotes(""); setExpressMode(false);
  };

  if (!record) return null;

  const price = parseFloat(record.price);
  const fee = calcFee(record.price);
  const shipping = calcShipping(record.sellerZip, zip);
  const insuranceCost = addInsurance ? Math.max(2, Math.round(price * 0.03 * 100) / 100) : 0;
  const giftWrapCost = giftWrap ? 3.50 : 0;
  const total = price + fee + shipping + insuranceCost + giftWrapCost;

  // #26 — Detect saved payment method
  const hasSavedPayment = profile?.paymentMethod || profile?.stripeCustomerId;

  // #27 — Express checkout: skip address if saved, go straight to checkout
  const handleExpressCheckout = () => {
    if (profile?.shippingStreet && hasSavedPayment) {
      setName(profile.shippingName || '');
      setStreet(profile.shippingStreet || '');
      setCity(profile.shippingCity || '');
      setState(profile.shippingState || '');
      setZip(profile.shippingZip || '');
      setExpressMode(true);
      setStep(2);
    }
  };

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
          addInsurance,
          giftWrap,
          orderNotes: orderNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.url) {
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

      {/* #26 — Saved payment method indicator */}
      {hasSavedPayment && step === 1 && (
        <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg px-3 py-2 text-[11px] text-emerald-400 mb-3 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          Saved payment method on file
        </div>
      )}

      {/* #27 — Express checkout button */}
      {step === 1 && profile?.shippingStreet && hasSavedPayment && (
        <button
          onClick={handleExpressCheckout}
          className="w-full mb-4 p-3 rounded-[10px] bg-gradient-to-r from-gs-accent/10 to-gs-indigo/10 border border-gs-accent/20 text-gs-accent text-[13px] font-bold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Express Checkout
        </button>
      )}

      {step === 1 && (
        <>
          {err && <div className="bg-[#ef444422] border border-[#ef444444] rounded-lg px-3 py-2 text-[#f87171] text-xs mb-3.5">{err}</div>}
          {(profile?.shippingStreet) && (
            <div className="bg-[#0ea5e911] border border-[#0ea5e922] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-3">
              Pre-filled from your profile. Please confirm your address is correct.
            </div>
          )}
          <FormInput label="FULL NAME" value={name} onChange={setName} placeholder="Jane Smith" />
          <FormInput label="STREET ADDRESS" value={street} onChange={setStreet} placeholder="123 Vinyl Lane, Apt 4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FormInput label="CITY" value={city} onChange={setCity} placeholder="Chicago" />
            <FormInput label="STATE" value={state} onChange={setState} placeholder="IL" />
            <FormInput label="ZIP" value={zip} onChange={setZip} placeholder="60601" />
          </div>

          {/* #22 — Shipping estimate based on zip */}
          {zip.length >= 5 && (
            <div className="bg-[#111] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-3 flex justify-between items-center">
              <span>Estimated shipping</span>
              <span className="text-gs-text font-semibold">${shipping.toFixed(2)}</span>
            </div>
          )}

          {/* #23 — Insurance option */}
          <label className="flex items-center gap-2.5 mb-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={addInsurance}
              onChange={e => setAddInsurance(e.target.checked)}
              className="w-4 h-4 rounded border-gs-border accent-gs-accent cursor-pointer"
            />
            <span className="text-xs text-gs-muted group-hover:text-gs-text transition-colors">
              Shipping insurance (+${Math.max(2, Math.round(price * 0.03 * 100) / 100).toFixed(2)})
            </span>
            <span className="text-[10px] text-gs-faint ml-auto">Recommended</span>
          </label>

          {/* #24 — Gift wrapping option */}
          <label className="flex items-center gap-2.5 mb-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={giftWrap}
              onChange={e => setGiftWrap(e.target.checked)}
              className="w-4 h-4 rounded border-gs-border accent-gs-accent cursor-pointer"
            />
            <span className="text-xs text-gs-muted group-hover:text-gs-text transition-colors">
              Gift wrapping (+$3.50)
            </span>
          </label>

          {/* #25 — Order notes */}
          <div className="mb-3.5">
            <label className="text-[10px] font-bold text-gs-dim tracking-[0.08em] mb-1 block">SPECIAL INSTRUCTIONS (OPTIONAL)</label>
            <textarea
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              placeholder="Any notes for the seller..."
              maxLength={200}
              rows={2}
              className="w-full bg-[#111] border border-gs-border rounded-lg px-3 py-2 text-[#ccc] text-xs outline-none resize-none focus:border-gs-accent/20"
            />
            {orderNotes.length > 0 && (
              <div className="text-[10px] text-gs-faint text-right mt-0.5">{orderNotes.length}/200</div>
            )}
          </div>

          <div className="flex gap-2.5">
            <button onClick={() => { reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Cancel</button>
            {onAddToCart && <button onClick={() => { onAddToCart(record); reset(); onClose(); }} className="flex-1 p-[11px] bg-[#1a1a1a] border border-[#f59e0b44] rounded-[10px] text-amber-500 text-[13px] font-semibold cursor-pointer">+ Cart</button>}
            <button onClick={() => { if (!name || !street || !city || !state || !zip) { setErr("All address fields are required."); return; } setErr(""); setStep(2); }} className="flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">Continue</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="bg-[#111] rounded-lg px-3.5 py-2.5 text-xs text-gs-muted mb-4">
            Shipping to: <span className="text-gs-text">{name}, {street}, {city}, {state} {zip}</span>
            {expressMode && <span className="ml-1.5 text-gs-accent text-[10px] font-semibold">Express</span>}
          </div>
          {err && <div className="bg-[#ef444422] border border-[#ef444444] rounded-lg px-3 py-2 text-[#f87171] text-xs mb-3.5">{err}</div>}

          {/* Order breakdown */}
          <div className="bg-[#111] rounded-[10px] p-3.5 mb-5">
            {[
              ["Record", `$${price.toFixed(2)}`],
              ["Shipping", `$${shipping.toFixed(2)}`],
              ["Transaction fee (5%)", `$${fee.toFixed(2)}`],
              ...(addInsurance ? [["Shipping insurance", `$${insuranceCost.toFixed(2)}`]] : []),
              ...(giftWrap ? [["Gift wrapping", `$${giftWrapCost.toFixed(2)}`]] : []),
              ["Total", `$${total.toFixed(2)}`],
            ].map(([k, v], i, arr) => (
              <div key={k} className={`flex justify-between ${i === arr.length - 1 ? 'text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5' : 'text-[13px] text-gs-muted'} ${i < arr.length - 1 ? 'mb-1.5' : ''}`}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>

          {/* Options summary */}
          {(addInsurance || giftWrap || orderNotes) && (
            <div className="bg-[#111] rounded-lg px-3 py-2.5 mb-4 text-[11px] text-gs-muted">
              {addInsurance && <div className="flex items-center gap-1.5 mb-1"><span className="text-emerald-400">+</span> Shipping insurance included</div>}
              {giftWrap && <div className="flex items-center gap-1.5 mb-1"><span className="text-pink-400">+</span> Gift wrapping</div>}
              {orderNotes && <div className="flex items-center gap-1.5"><span className="text-gs-accent">+</span> Note: "{orderNotes.slice(0, 60)}{orderNotes.length > 60 ? '...' : ''}"</div>}
            </div>
          )}

          <div className="bg-[#0ea5e911] border border-[#0ea5e922] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-4">
            You'll be redirected to Stripe for secure payment
          </div>

          <div className="flex gap-2.5">
            <button onClick={() => setStep(1)} className="flex-1 p-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Back</button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className={`flex-[2] p-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer ${loading ? 'opacity-60' : ''}`}
            >
              {loading ? "Redirecting..." : `Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
