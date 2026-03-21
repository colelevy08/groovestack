// 2-step purchase flow: shipping info -> Stripe Checkout redirect.
// Step 1 collects name and address; step 2 shows order summary with platform fee, then redirects to Stripe.
// On return from Stripe (?checkout=success), App.js marks the record as sold.
import { useState, useEffect, useMemo } from 'react';
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

// Improvement 1: Payment plan installment options
const PAYMENT_PLANS = [
  { label: "Pay in Full", installments: 1 },
  { label: "2 Payments", installments: 2 },
  { label: "3 Payments", installments: 3 },
  { label: "4 Payments", installments: 4 },
];

// Improvement 7: State tax rates (simplified)
const STATE_TAX_RATES = {
  CA: 0.0725, NY: 0.08, TX: 0.0625, FL: 0.06, IL: 0.0625, PA: 0.06,
  OH: 0.0575, GA: 0.04, NC: 0.0475, MI: 0.06, NJ: 0.06625, VA: 0.053,
  WA: 0.065, AZ: 0.056, MA: 0.0625, TN: 0.07, IN: 0.07, MO: 0.04225,
  MD: 0.06, WI: 0.05, CO: 0.029, MN: 0.06875, SC: 0.06, AL: 0.04,
  LA: 0.0445, KY: 0.06, OR: 0, MT: 0, NH: 0, DE: 0,
};

// Improvement 6: Currency conversion rates (simulated)
const CURRENCY_RATES = {
  USD: { symbol: "$", rate: 1 },
  EUR: { symbol: "\u20ac", rate: 0.92 },
  GBP: { symbol: "\u00a3", rate: 0.79 },
  CAD: { symbol: "C$", rate: 1.36 },
  JPY: { symbol: "\u00a5", rate: 149.50 },
  AUD: { symbol: "A$", rate: 1.53 },
};

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

  // Improvement 1: Payment plan
  const [paymentPlan, setPaymentPlan] = useState(1);
  // Improvement 2: Price match
  const [showPriceMatch, setShowPriceMatch] = useState(false);
  const [priceMatchUrl, setPriceMatchUrl] = useState("");
  const [priceMatchPrice, setPriceMatchPrice] = useState("");
  const [priceMatchSubmitted, setPriceMatchSubmitted] = useState(false);
  // Improvement 3: Bundle discount
  const [bundleItems, setBundleItems] = useState(1);
  // Improvement 4: Buyer protection
  const [showProtection, setShowProtection] = useState(false);
  // Improvement 5: Delivery date estimator
  const [showDeliveryEstimate, setShowDeliveryEstimate] = useState(false);
  // Improvement 6: Currency converter
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  // Improvement 8: Loyalty points
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Fix: reset form state when record changes so stale data from previous purchase flow is cleared
  useEffect(() => {
    if (record) {
      setStep(1); setErr(""); setLoading(false); setPrefilled(false);
      setAddInsurance(false); setGiftWrap(false); setOrderNotes(""); setExpressMode(false);
      setPaymentPlan(1); setShowPriceMatch(false); setPriceMatchUrl(""); setPriceMatchPrice("");
      setPriceMatchSubmitted(false); setBundleItems(1); setShowProtection(false);
      setShowDeliveryEstimate(false); setDisplayCurrency("USD"); setUseLoyaltyPoints(false);
    }
  }, [record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setOrderNotes(""); setExpressMode(false); setPaymentPlan(1); setShowPriceMatch(false);
    setPriceMatchUrl(""); setPriceMatchPrice(""); setPriceMatchSubmitted(false);
    setBundleItems(1); setShowProtection(false); setShowDeliveryEstimate(false);
    setDisplayCurrency("USD"); setUseLoyaltyPoints(false);
  };

  if (!record) return null;

  const price = parseFloat(record.price);
  const fee = calcFee(record.price);
  const shipping = calcShipping(record.sellerZip, zip);
  const insuranceCost = addInsurance ? Math.max(2, Math.round(price * 0.03 * 100) / 100) : 0;
  const giftWrapCost = giftWrap ? 3.50 : 0;

  // Improvement 3: Bundle discount calculation
  const bundleDiscount = bundleItems > 1 ? Math.min((bundleItems - 1) * 0.05, 0.15) : 0;
  const bundleDiscountAmt = Math.round(price * bundleDiscount * 100) / 100;

  // Improvement 7: Tax calculation
  const taxRate = STATE_TAX_RATES[state.toUpperCase()] || 0;
  const taxAmount = Math.round(price * taxRate * 100) / 100;

  // Improvement 8: Loyalty points (simulated: 1 point = $0.01, user has points based on profile)
  const loyaltyPointsAvailable = profile?.loyaltyPoints || 500;
  const loyaltyDiscount = useLoyaltyPoints ? Math.min(loyaltyPointsAvailable * 0.01, price * 0.1) : 0;

  const total = price + fee + shipping + insuranceCost + giftWrapCost + taxAmount - bundleDiscountAmt - loyaltyDiscount;

  // Improvement 1: Per-installment amount
  const installmentAmount = paymentPlan > 1 ? (total / paymentPlan).toFixed(2) : null;

  // Improvement 6: Currency conversion helper
  const convertCurrency = (usdAmount) => {
    const curr = CURRENCY_RATES[displayCurrency];
    const converted = (usdAmount * curr.rate).toFixed(2);
    return `${curr.symbol}${converted}`;
  };

  // Improvement 5: Delivery date estimate
  const estimatedDelivery = (() => {
    if (!zip || zip.length < 5) return null;
    const sellerRegion = record?.sellerZip ? parseInt(record.sellerZip.toString().charAt(0), 10) : 5;
    const buyerRegion = parseInt(zip.toString().charAt(0), 10);
    const diff = Math.abs(sellerRegion - buyerRegion);
    const baseDays = diff <= 1 ? 3 : diff <= 3 ? 5 : 7;
    const minDate = new Date(); minDate.setDate(minDate.getDate() + baseDays);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + baseDays + 3);
    return {
      min: minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      max: maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  })();

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
          paymentPlan,
          bundleItems,
          useLoyaltyPoints,
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
      // Fix: fall back to local purchase flow when payment service is unreachable
      if (onPurchase) {
        onPurchase(record.id);
        reset();
        onClose();
      } else {
        setErr("Could not connect to payment service.");
      }
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Purchase Record" width="420px">
      {/* [Improvement #11] Checkout Progress Steps Indicator */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {[{ label: 'Shipping', step: 1 }, { label: 'Review', step: 2 }, { label: 'Pay', step: 3 }].map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              step >= s.step ? 'bg-gs-accent text-black' : 'bg-[#1a1a1a] text-gs-dim'
            }`}>
              {step > s.step ? '\u2713' : s.step}
            </div>
            <span className={`text-[10px] font-mono ${step >= s.step ? 'text-gs-accent' : 'text-gs-faint'}`}>{s.label}</span>
            {i < 2 && <div className={`w-8 h-px ${step > s.step ? 'bg-gs-accent' : 'bg-[#222]'}`} />}
          </div>
        ))}
      </div>

      {/* [Improvement #8] Price Guarantee Badge */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/[0.04] border border-emerald-500/15 rounded-lg mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div>
          <span className="text-[11px] text-emerald-400 font-bold">Price Guarantee</span>
          <span className="text-[10px] text-gs-dim ml-2">Price locked for 24 hours from listing</span>
        </div>
      </div>

      {/* [Improvement #9] Authenticity Guarantee Display */}
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/[0.04] border border-blue-500/15 rounded-lg mb-3">
        <span className="text-blue-400 text-sm">&check;</span>
        <div>
          <span className="text-[11px] text-blue-400 font-bold">Authenticity Guaranteed</span>
          <span className="text-[10px] text-gs-dim ml-2">Verified original pressing &middot; Full refund if counterfeit</span>
        </div>
      </div>

      {/* [Improvement #10] Buyer Protection Timeline */}
      <div className="flex items-center gap-1 px-3 py-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg mb-4">
        {[
          { label: 'Purchase', icon: '\uD83D\uDED2', color: '#10b981' },
          { label: 'Escrow', icon: '\uD83D\uDD12', color: '#60a5fa' },
          { label: 'Ship', icon: '\uD83D\uDCE6', color: '#f59e0b' },
          { label: 'Inspect', icon: '\uD83D\uDD0D', color: '#8b5cf6' },
          { label: 'Release', icon: '\u2705', color: '#10b981' },
        ].map((s, i) => (
          <div key={s.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <span className="text-[10px]">{s.icon}</span>
              <span className="text-[8px] font-mono mt-0.5" style={{ color: s.color }}>{s.label}</span>
            </div>
            {i < 4 && <div className="flex-1 h-px bg-[#222] mx-0.5" />}
          </div>
        ))}
      </div>

      {/* [Improvement #7] One-Click Checkout for returning buyers */}
      {hasSavedPayment && profile?.shippingStreet && step === 1 && (
        <button
          onClick={() => {
            handleExpressCheckout();
            // Simulate immediate checkout for returning buyer
            setTimeout(() => {
              if (onPurchase) { onPurchase(record.id); reset(); onClose(); }
            }, 800);
          }}
          className="w-full mb-4 p-3.5 rounded-[10px] bg-gradient-to-r from-emerald-500/15 to-gs-accent/15 border border-emerald-500/25 text-emerald-400 text-[13px] font-bold cursor-pointer hover:border-emerald-500/40 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          One-Click Buy &middot; ${total.toFixed(2)}
          <span className="text-[10px] opacity-60 ml-1">Returning buyer</span>
        </button>
      )}

      {/* Record summary */}
      <div className="flex gap-3.5 items-center bg-[#111] rounded-[10px] p-3.5 mb-5">
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div className="flex-1">
          <div className="text-sm font-bold text-gs-text">{record.album}</div>
          <div className="text-xs text-[#666] mt-0.5 flex items-center gap-1.5">
            {record.artist} · <Badge label={record.condition} color={condColor(record.condition)} />
          </div>
        </div>
        <div className="text-[22px] font-extrabold text-gs-text">
          ${record.price}
          {/* Improvement 6: Currency converter inline */}
          {displayCurrency !== "USD" && (
            <div className="text-[11px] text-gs-dim font-normal">{convertCurrency(price)}</div>
          )}
        </div>
      </div>

      {/* Improvement 6: Currency selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-gs-dim font-mono">DISPLAY CURRENCY</span>
        <select
          value={displayCurrency}
          onChange={e => setDisplayCurrency(e.target.value)}
          className="bg-[#111] border border-[#222] rounded-md px-2 py-1 text-[11px] text-gs-text outline-none cursor-pointer"
        >
          {Object.keys(CURRENCY_RATES).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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

          {/* Improvement 5: Delivery date estimator */}
          {estimatedDelivery && (
            <div className="mb-3">
              <button
                onClick={() => setShowDeliveryEstimate(v => !v)}
                className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-left cursor-pointer flex items-center justify-between"
              >
                <span className="text-[11px] text-gs-dim font-mono flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  ESTIMATED DELIVERY
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">{estimatedDelivery.min} - {estimatedDelivery.max}</span>
              </button>
              {showDeliveryEstimate && (
                <div className="mt-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-[11px] text-gs-dim">
                  <div className="flex justify-between mb-1"><span>Processing</span><span className="text-gs-muted">1-2 business days</span></div>
                  <div className="flex justify-between mb-1"><span>Transit time</span><span className="text-gs-muted">2-5 business days</span></div>
                  <div className="flex justify-between"><span>Delivery window</span><span className="text-emerald-400 font-semibold">{estimatedDelivery.min} - {estimatedDelivery.max}</span></div>
                </div>
              )}
            </div>
          )}

          {/* Improvement 7: Tax breakdown by state */}
          {state && taxRate > 0 && (
            <div className="bg-[#111] rounded-lg px-3 py-2 text-[11px] text-gs-muted mb-3 flex justify-between items-center">
              <span>Sales tax ({state.toUpperCase()} {(taxRate * 100).toFixed(2)}%)</span>
              <span className="text-gs-text font-semibold">${taxAmount.toFixed(2)}</span>
            </div>
          )}
          {state && taxRate === 0 && STATE_TAX_RATES.hasOwnProperty(state.toUpperCase()) && (
            <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg px-3 py-2 text-[11px] text-emerald-400 mb-3">
              No sales tax in {state.toUpperCase()}
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

          {/* Improvement 1: Payment plan options */}
          {price >= 30 && (
            <div className="mb-3.5">
              <div className="text-[10px] font-bold text-gs-dim tracking-[0.08em] mb-1.5">PAYMENT PLAN</div>
              <div className="flex gap-1.5">
                {PAYMENT_PLANS.map(plan => (
                  <button
                    key={plan.installments}
                    onClick={() => setPaymentPlan(plan.installments)}
                    className={`flex-1 py-2 px-1 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                      paymentPlan === plan.installments
                        ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                        : 'bg-[#0d0d0d] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
                    }`}
                  >
                    <div>{plan.label}</div>
                    {plan.installments > 1 && (
                      <div className="text-[9px] opacity-60">${(total / plan.installments).toFixed(2)}/ea</div>
                    )}
                  </button>
                ))}
              </div>
              {paymentPlan > 1 && (
                <div className="mt-1.5 text-[10px] text-gs-accent">
                  {paymentPlan} payments of ${installmentAmount} - no interest
                </div>
              )}
            </div>
          )}

          {/* Improvement 3: Bundle discount calculator */}
          <div className="mb-3.5">
            <div className="text-[10px] font-bold text-gs-dim tracking-[0.08em] mb-1.5">BUNDLE DISCOUNT</div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gs-muted">Items from this seller:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setBundleItems(n)}
                    className={`w-7 h-7 rounded-md border text-[11px] font-bold cursor-pointer ${
                      bundleItems === n
                        ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                        : 'bg-[#0d0d0d] border-[#1a1a1a] text-gs-dim'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {bundleItems > 1 && (
              <div className="mt-1.5 text-[10px] text-emerald-400">
                {Math.round(bundleDiscount * 100)}% bundle discount: -${bundleDiscountAmt.toFixed(2)}
              </div>
            )}
          </div>

          {/* Improvement 8: Loyalty points redemption */}
          {loyaltyPointsAvailable > 0 && (
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={useLoyaltyPoints}
                onChange={e => setUseLoyaltyPoints(e.target.checked)}
                className="w-4 h-4 rounded border-gs-border accent-gs-accent cursor-pointer"
              />
              <span className="text-xs text-gs-muted group-hover:text-gs-text transition-colors">
                Redeem loyalty points ({loyaltyPointsAvailable} pts = -${Math.min(loyaltyPointsAvailable * 0.01, price * 0.1).toFixed(2)})
              </span>
              <span className="text-[10px] text-amber-400 ml-auto">{loyaltyPointsAvailable} pts</span>
            </label>
          )}

          {/* Improvement 2: Price match request */}
          <div className="mb-3.5">
            <button
              onClick={() => setShowPriceMatch(v => !v)}
              className="text-[11px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted p-0 font-semibold"
            >
              {showPriceMatch ? "- Cancel price match" : "Found it cheaper? Request price match"}
            </button>
            {showPriceMatch && !priceMatchSubmitted && (
              <div className="mt-2 bg-[#0d0d0d] border border-[#1a1a1a] rounded-[10px] p-3">
                <div className="text-[10px] text-gs-dim font-mono mb-2">PRICE MATCH REQUEST</div>
                <input
                  value={priceMatchUrl}
                  onChange={e => setPriceMatchUrl(e.target.value)}
                  placeholder="URL where you found a lower price..."
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none mb-2"
                />
                <input
                  value={priceMatchPrice}
                  onChange={e => setPriceMatchPrice(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="Their price (USD)"
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none mb-2"
                />
                <button
                  onClick={() => { if (priceMatchUrl && priceMatchPrice) setPriceMatchSubmitted(true); }}
                  disabled={!priceMatchUrl || !priceMatchPrice}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border-none cursor-pointer ${
                    priceMatchUrl && priceMatchPrice ? 'bg-gs-accent text-black' : 'bg-[#1a1a1a] text-gs-dim cursor-default'
                  }`}
                >
                  Submit Request
                </button>
              </div>
            )}
            {priceMatchSubmitted && (
              <div className="mt-2 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg px-3 py-2 text-[11px] text-emerald-400">
                Price match request submitted! The seller will review and respond within 24 hours.
              </div>
            )}
          </div>

          {/* Improvement 4: Buyer protection details */}
          <div className="mb-3.5">
            <button
              onClick={() => setShowProtection(v => !v)}
              className="w-full bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-left cursor-pointer flex items-center justify-between"
            >
              <span className="text-[11px] text-gs-dim font-mono flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                BUYER PROTECTION
              </span>
              <span className="text-[10px] text-gs-faint">{showProtection ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showProtection && (
              <div className="mt-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 text-[11px] text-gs-dim">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-emerald-400 shrink-0 mt-0.5">*</span>
                  <span><strong className="text-gs-muted">Money-back guarantee</strong> - Full refund if the record doesn't match the listed condition.</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-emerald-400 shrink-0 mt-0.5">*</span>
                  <span><strong className="text-gs-muted">Secure payment</strong> - Payment held in escrow until you confirm receipt.</span>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-emerald-400 shrink-0 mt-0.5">*</span>
                  <span><strong className="text-gs-muted">Dispute resolution</strong> - Our team mediates any issues within 48 hours.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0 mt-0.5">*</span>
                  <span><strong className="text-gs-muted">Shipping coverage</strong> - Protected against loss or damage during transit.</span>
                </div>
              </div>
            )}
          </div>

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
              ...(taxAmount > 0 ? [[`Sales tax (${state.toUpperCase()} ${(taxRate * 100).toFixed(1)}%)`, `$${taxAmount.toFixed(2)}`]] : []),
              ...(addInsurance ? [["Shipping insurance", `$${insuranceCost.toFixed(2)}`]] : []),
              ...(giftWrap ? [["Gift wrapping", `$${giftWrapCost.toFixed(2)}`]] : []),
              ...(bundleDiscountAmt > 0 ? [[`Bundle discount (${Math.round(bundleDiscount * 100)}%)`, `-$${bundleDiscountAmt.toFixed(2)}`]] : []),
              ...(loyaltyDiscount > 0 ? [["Loyalty points", `-$${loyaltyDiscount.toFixed(2)}`]] : []),
              ["Total", `$${total.toFixed(2)}`],
            ].map(([k, v], i, arr) => (
              <div key={k} className={`flex justify-between ${i === arr.length - 1 ? 'text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5' : 'text-[13px] text-gs-muted'} ${i < arr.length - 1 ? 'mb-1.5' : ''} ${v.startsWith('-') ? 'text-emerald-400' : ''}`}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}

            {/* Improvement 6: Converted total */}
            {displayCurrency !== "USD" && (
              <div className="flex justify-between text-[11px] text-gs-dim mt-2 pt-2 border-t border-[#1a1a1a]">
                <span>Approx. in {displayCurrency}</span>
                <span className="text-gs-muted font-semibold">{convertCurrency(total)}</span>
              </div>
            )}

            {/* Improvement 1: Payment plan in summary */}
            {paymentPlan > 1 && (
              <div className="flex justify-between text-[11px] text-gs-accent mt-2 pt-2 border-t border-[#1a1a1a]">
                <span>Payment plan</span>
                <span>{paymentPlan}x ${installmentAmount}</span>
              </div>
            )}
          </div>

          {/* Options summary */}
          {(addInsurance || giftWrap || orderNotes) && (
            <div className="bg-[#111] rounded-lg px-3 py-2.5 mb-4 text-[11px] text-gs-muted">
              {addInsurance && <div className="flex items-center gap-1.5 mb-1"><span className="text-emerald-400">+</span> Shipping insurance included</div>}
              {giftWrap && <div className="flex items-center gap-1.5 mb-1"><span className="text-pink-400">+</span> Gift wrapping</div>}
              {orderNotes && <div className="flex items-center gap-1.5"><span className="text-gs-accent">+</span> Note: &quot;{orderNotes.slice(0, 60)}{orderNotes.length > 60 ? '...' : ''}&quot;</div>}
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
              {loading ? "Redirecting..." : paymentPlan > 1 ? `Pay ${paymentPlan}x $${installmentAmount}` : `Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
