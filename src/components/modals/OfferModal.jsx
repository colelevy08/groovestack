// Modal for sending offers to users who have an album on their wishlist.
// Supports 3 offer types: Cash (price + shipping), Trade (swap records), or Combo (record + cash).
// The offerer always gives up the record matching the target's wishlist item.
// What they receive varies: cash, one of the target's records, or a record + cash.
import { useState, useMemo, useEffect } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import AlbumArt from '../ui/AlbumArt';
import Badge from '../ui/Badge';
import { condColor } from '../../utils/helpers';

// Rough value multipliers by condition grade for fair trade calculation
const COND_VALUES = { M: 1.0, NM: 0.85, "VG+": 0.7, VG: 0.55, "G+": 0.4, G: 0.28, F: 0.15, P: 0.08 };

// Improvement 1: Quick offer templates
const OFFER_TEMPLATES = [
  { label: "Low Ball", price: "15.00", shipping: "4.00" },
  { label: "Fair Offer", price: "30.00", shipping: "6.00" },
  { label: "Strong Offer", price: "50.00", shipping: "6.00" },
  { label: "Premium", price: "75.00", shipping: "0.00" },
];

// Improvement 4 (original): Simulated comparable sales
const COMPARABLE_SALES = [
  { price: "$28.00", condition: "VG+", date: "2 days ago", platform: "Discogs" },
  { price: "$35.00", condition: "NM", date: "1 week ago", platform: "eBay" },
  { price: "$22.50", condition: "VG", date: "3 days ago", platform: "Discogs" },
];

// Improvement 8 (original): Offer status timeline steps
const TIMELINE_STEPS = [
  { label: "Draft", icon: "\uD83D\uDCDD" },
  { label: "Sent", icon: "\uD83D\uDCE8" },
  { label: "Reviewed", icon: "\uD83D\uDC40" },
  { label: "Accepted", icon: "\u2713" },
];

// Improvement 11 (new): Offer message templates
const MESSAGE_TEMPLATES = [
  { label: "Polite Inquiry", text: "Hi! I noticed you're looking for this record. I have a copy in great condition and would love to work out a fair deal." },
  { label: "Quick & Direct", text: "I have this record available. Let me know if this offer works for you!" },
  { label: "Collector Pitch", text: "Fellow collector here -- this is a well-cared-for copy from my personal collection. I think you'll be happy with the condition." },
  { label: "Bundle Interest", text: "I have a few records you might be interested in. Would you be open to a bundle deal?" },
];

export default function OfferModal({ open, onClose, target, records, onSubmit }) {
  const [offerType, setOfferType] = useState("cash");
  const [price, setPrice] = useState("");
  const [shipping, setShipping] = useState("6.00");
  const [selectedTradeRecord, setSelectedTradeRecord] = useState(null);
  const [err, setErr] = useState("");
  // Improvement 2: Counter-offer flow
  const [isCounterOffer, setIsCounterOffer] = useState(false);
  const [counterMessage, setCounterMessage] = useState("");
  // Improvement 3: Offer expiration
  const [expiresIn, setExpiresIn] = useState("48");
  // Improvement 5: Bundle offer note
  const [bundleNote, setBundleNote] = useState("");
  const [showBundleNote, setShowBundleNote] = useState(false);
  // Improvement 6: Offer history
  const [showHistory, setShowHistory] = useState(false);
  // Improvement 7: Photo requirement for high-value
  const [photoAcknowledged, setPhotoAcknowledged] = useState(false);
  // Improvement 4: Comparable sales toggle
  const [showComps, setShowComps] = useState(false);
  // Improvement 3: Expiration countdown display
  const [timelineStep] = useState(0);

  // Improvement 9 (new): Multi-item bundle offer
  const [bundleMode, setBundleMode] = useState(false);
  const [bundleRecords, setBundleRecords] = useState([]);
  // Improvement 10 (new): Trade + cash combination
  const [tradeCashAmount, setTradeCashAmount] = useState("");
  // Improvement 11 (new): Offer message
  const [offerMessage, setOfferMessage] = useState("");
  const [showMessageTemplates, setShowMessageTemplates] = useState(false);
  // Improvement 12 (new): Fair market value comparison chart
  const [showFMVChart, setShowFMVChart] = useState(false);
  // Improvement 13 (new): Offer success probability
  const [showProbability, setShowProbability] = useState(true);

  const reset = () => {
    setOfferType("cash");
    setPrice("");
    setShipping("6.00");
    setSelectedTradeRecord(null);
    setErr("");
    setIsCounterOffer(false);
    setCounterMessage("");
    setExpiresIn("48");
    setBundleNote("");
    setShowBundleNote(false);
    setShowHistory(false);
    setPhotoAcknowledged(false);
    setShowComps(false);
    setBundleMode(false);
    setBundleRecords([]);
    setTradeCashAmount("");
    setOfferMessage("");
    setShowMessageTemplates(false);
    setShowFMVChart(false);
  };

  // Improvement 7: Check if offer is high-value (over $60)
  const isHighValue = useMemo(() => {
    const p = parseFloat(price) || 0;
    return p >= 60;
  }, [price]);

  // Reset photo acknowledgment when price drops below threshold
  useEffect(() => {
    if (!isHighValue) setPhotoAcknowledged(false);
  }, [isHighValue]);

  // Fair trade indicator — compare condition values
  const fairTrade = useMemo(() => {
    if (!selectedTradeRecord || !target?.offeredRecord) return null;
    const myVal = COND_VALUES[target.offeredRecord.condition] || 0.5;
    const theirVal = COND_VALUES[selectedTradeRecord.condition] || 0.5;
    const ratio = myVal / theirVal;
    if (ratio >= 0.8 && ratio <= 1.2) return { label: "Fair Trade", color: "#10b981", icon: "\u2713" };
    if (ratio > 1.2) return { label: "You're giving more value", color: "#f59e0b", icon: "\u26A0" };
    return { label: "You're getting more value", color: "#60a5fa", icon: "\u2605" };
  }, [selectedTradeRecord, target?.offeredRecord]);

  // Improvement 7 (FMV): Fair market value estimate based on condition
  const fmvEstimate = useMemo(() => {
    if (!target?.offeredRecord) return null;
    const condMult = COND_VALUES[target.offeredRecord.condition] || 0.5;
    const basePrice = 40; // Simulated base
    const low = (basePrice * condMult * 0.75).toFixed(2);
    const high = (basePrice * condMult * 1.25).toFixed(2);
    return { low, high, mid: ((parseFloat(low) + parseFloat(high)) / 2).toFixed(2) };
  }, [target?.offeredRecord]);

  // Improvement 13 (new): Calculate offer success probability
  const successProbability = useMemo(() => {
    if (!fmvEstimate) return null;
    const offerAmt = parseFloat(price) || 0;
    const fmvMid = parseFloat(fmvEstimate.mid);
    if (offerAmt <= 0 || fmvMid <= 0) return null;

    const ratio = offerAmt / fmvMid;
    let probability;
    if (ratio >= 1.2) probability = 95;
    else if (ratio >= 1.0) probability = 80;
    else if (ratio >= 0.85) probability = 60;
    else if (ratio >= 0.7) probability = 40;
    else if (ratio >= 0.5) probability = 20;
    else probability = 10;

    // Bonuses
    if (offerMessage.trim()) probability = Math.min(probability + 5, 99);
    if (shipping === "0.00" || shipping === "0") probability = Math.min(probability + 5, 99);

    let color, label;
    if (probability >= 70) { color = "#10b981"; label = "High"; }
    else if (probability >= 40) { color = "#f59e0b"; label = "Medium"; }
    else { color = "#ef4444"; label = "Low"; }

    return { probability, color, label };
  }, [price, fmvEstimate, offerMessage, shipping]);

  if (!target) return null;

  const targetRecords = (records || []).filter(r => r.user === target.targetUser);
  const total = (parseFloat(price) || 0) + (parseFloat(shipping) || 0);

  // Improvement 9: Toggle bundle record selection
  const toggleBundleRecord = (record) => {
    setBundleRecords(prev => {
      const exists = prev.find(r => r.id === record.id);
      if (exists) return prev.filter(r => r.id !== record.id);
      return [...prev, record];
    });
  };

  const handleSubmit = () => {
    if (offerType === "cash" && (!price || parseFloat(price) <= 0)) { setErr("Enter a valid offer price."); return; }
    if (offerType === "trade" && !selectedTradeRecord) { setErr("Select a record to trade for."); return; }
    if (offerType === "combo" && !selectedTradeRecord) { setErr("Select a record to trade for."); return; }
    if (offerType === "combo" && (!price || parseFloat(price) <= 0)) { setErr("Enter additional cash amount."); return; }
    // Improvement 7: Block high-value offers without photo acknowledgment
    if (isHighValue && !photoAcknowledged) { setErr("Please confirm condition photos for high-value offers."); return; }
    // Improvement 9: Bundle validation
    if (bundleMode && bundleRecords.length === 0) { setErr("Select at least one record for the bundle offer."); return; }

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
      isCounterOffer,
      counterMessage: isCounterOffer ? counterMessage : "",
      expiresIn,
      bundleNote: showBundleNote ? bundleNote : "",
      bundleRecords: bundleMode ? bundleRecords.map(r => ({ id: r.id, album: r.album, artist: r.artist })) : [],
      tradeCashAmount: tradeCashAmount || "0",
      offerMessage: offerMessage.trim(),
    });
    reset();
  };

  const typeLabels = [["cash", "Cash"], ["trade", "Trade"], ["combo", "Trade + Cash"]];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={isCounterOffer ? "Counter Offer" : "Make an Offer"} width="480px">

      {/* Improvement 8: Offer status timeline */}
      <div className="flex items-center justify-between mb-4 px-2">
        {TIMELINE_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${i <= timelineStep ? 'bg-gs-accent text-black font-bold' : 'bg-[#1a1a1a] text-gs-dim'}`}>
                {step.icon}
              </div>
              <span className={`text-[9px] mt-1 ${i <= timelineStep ? 'text-gs-accent' : 'text-gs-faint'}`}>{step.label}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1.5 ${i < timelineStep ? 'bg-gs-accent' : 'bg-[#222]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* What they want — wishlist item */}
      <div className="bg-[#111] rounded-[10px] p-3.5 mb-3">
        <div className="text-[11px] text-gs-dim font-mono mb-2">THEY WANT</div>
        <div className="flex gap-3 items-center">
          <div className="w-[38px] h-[38px] rounded-full bg-[#1a1a1a] flex items-center justify-center text-base shrink-0">{"\u2728"}</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gs-text truncate">{target.wishlistItem.album}</div>
            <div className="text-xs text-[#666] mt-0.5 truncate">{target.wishlistItem.artist}</div>
          </div>
          <span className="text-[11px] text-gs-accent font-mono">@{target.targetUser}</span>
        </div>
      </div>

      {/* Your record being offered */}
      {target.offeredRecord && (
        <div className="bg-[#111] rounded-[10px] p-3.5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-gs-dim font-mono">YOUR RECORD</div>
            {/* Improvement 7 (FMV): Fair market value indicator */}
            {fmvEstimate && (
              <div className="text-[10px] text-gs-dim">
                FMV: <span className="text-emerald-400 font-semibold">${fmvEstimate.low} - ${fmvEstimate.high}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 items-center">
            <AlbumArt album={target.offeredRecord.album} artist={target.offeredRecord.artist} accent={target.offeredRecord.accent} size={38} />
            <div className="flex-1">
              <div className="text-sm font-bold text-gs-text truncate">{target.offeredRecord.album}</div>
              <div className="text-xs text-[#666] mt-0.5 truncate">{target.offeredRecord.artist}</div>
            </div>
            <Badge label={target.offeredRecord.condition} color={condColor(target.offeredRecord.condition)} />
          </div>
        </div>
      )}

      {/* Improvement 12 (new): Fair market value comparison chart */}
      <button
        onClick={() => setShowFMVChart(v => !v)}
        className="w-full mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-left cursor-pointer flex items-center justify-between"
      >
        <span className="text-[11px] text-gs-dim font-mono">FMV COMPARISON CHART</span>
        <span className="text-[10px] text-gs-faint">{showFMVChart ? '\u25B2' : '\u25BC'}</span>
      </button>
      {showFMVChart && (
        <div className="mb-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-[10px] p-3">
          <div className="text-[10px] text-gs-dim font-mono mb-2">PRICE BY CONDITION GRADE</div>
          {Object.entries(COND_VALUES).map(([grade, mult]) => {
            const basePrice = 40;
            const gradePrice = (basePrice * mult).toFixed(2);
            const barWidth = Math.round(mult * 100);
            return (
              <div key={grade} className="flex items-center gap-2 mb-1.5">
                <div className="w-8 text-right">
                  <Badge label={grade} color={condColor(grade)} />
                </div>
                <div className="flex-1 h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gs-accent/60 to-gs-accent"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[10px] text-gs-muted font-mono w-12 text-right">${gradePrice}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Improvement 4 (original): Comparable sales toggle and display */}
      <button
        onClick={() => setShowComps(v => !v)}
        className="w-full mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 text-left cursor-pointer flex items-center justify-between"
      >
        <span className="text-[11px] text-gs-dim font-mono">COMPARABLE SALES</span>
        <span className="text-[10px] text-gs-faint">{showComps ? '\u25B2' : '\u25BC'}</span>
      </button>
      {showComps && (
        <div className="mb-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-[10px] p-3">
          {COMPARABLE_SALES.map((sale, i) => (
            <div key={i} className={`flex items-center justify-between py-1.5 ${i < COMPARABLE_SALES.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-emerald-400 font-bold">{sale.price}</span>
                <Badge label={sale.condition} color={condColor(sale.condition)} />
              </div>
              <div className="text-[10px] text-gs-dim">
                {sale.platform} · {sale.date}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Improvement 2: Counter-offer toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setIsCounterOffer(v => !v)}
          className={`text-[11px] px-3 py-1.5 rounded-lg border cursor-pointer font-semibold ${
            isCounterOffer ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-transparent border-[#222] text-gs-dim hover:text-gs-muted'
          }`}
        >
          {isCounterOffer ? "\u2713 Counter-Offer Mode" : "Counter-Offer?"}
        </button>
        {/* Improvement 6: Show offer history */}
        <button
          onClick={() => setShowHistory(v => !v)}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#222] bg-transparent text-gs-dim cursor-pointer hover:text-gs-muted font-semibold"
        >
          Offer History
        </button>
        {/* Improvement 9 (new): Bundle mode toggle */}
        <button
          onClick={() => setBundleMode(v => !v)}
          className={`text-[11px] px-3 py-1.5 rounded-lg border cursor-pointer font-semibold ${
            bundleMode ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-transparent border-[#222] text-gs-dim hover:text-gs-muted'
          }`}
        >
          {bundleMode ? "\u2713 Bundle Offer" : "Bundle"}
        </button>
      </div>

      {/* Improvement 2: Counter-offer message */}
      {isCounterOffer && (
        <div className="mb-4 bg-amber-500/[0.05] border border-amber-500/20 rounded-[10px] p-3">
          <div className="text-[10px] text-amber-400 font-mono mb-2">COUNTER-OFFER MESSAGE</div>
          <textarea
            value={counterMessage}
            onChange={e => setCounterMessage(e.target.value)}
            placeholder="Explain why you're countering (e.g., 'I think $X is more fair because...')"
            className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none font-sans resize-none h-[60px]"
          />
        </div>
      )}

      {/* Improvement 6: Offer history panel */}
      {showHistory && (
        <div className="mb-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-[10px] p-3">
          <div className="text-[10px] text-gs-dim font-mono mb-2">OFFER HISTORY WITH @{target.targetUser}</div>
          <div className="text-[11px] text-gs-faint py-3 text-center">
            No previous offers with this user.
          </div>
        </div>
      )}

      {/* Improvement 9 (new): Multi-item bundle offer picker */}
      {bundleMode && (
        <div className="mb-4 bg-purple-500/[0.03] border border-purple-500/15 rounded-[10px] p-3">
          <div className="text-[10px] text-purple-400 font-mono mb-2">BUNDLE OFFER — SELECT MULTIPLE RECORDS</div>
          <div className="max-h-[150px] overflow-y-auto flex flex-col gap-1">
            {targetRecords.length === 0 ? (
              <div className="p-3 text-center text-gs-faint text-xs">No records available from this user.</div>
            ) : targetRecords.map(r => {
              const isSelected = bundleRecords.some(br => br.id === r.id);
              return (
                <div
                  key={r.id}
                  onClick={() => toggleBundleRecord(r)}
                  className={`flex gap-2 items-center px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-[#111] border border-[#1a1a1a] hover:border-[#333]'
                  }`}
                >
                  <AlbumArt album={r.album} artist={r.artist} accent={r.accent} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-gs-text truncate">{r.album}</div>
                    <div className="text-[9px] text-[#666]">{r.artist}</div>
                  </div>
                  <Badge label={r.condition} color={condColor(r.condition)} />
                  {isSelected && <span className="text-purple-400 text-xs">{"\u2713"}</span>}
                </div>
              );
            })}
          </div>
          {bundleRecords.length > 0 && (
            <div className="mt-2 text-[10px] text-purple-400">{bundleRecords.length} record{bundleRecords.length !== 1 ? 's' : ''} selected for bundle</div>
          )}
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

      {/* Improvement 1: Quick offer templates (cash mode only) */}
      {offerType !== "trade" && (
        <div className="flex gap-1.5 mb-3">
          {OFFER_TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              onClick={() => { setPrice(tpl.price); setShipping(tpl.shipping); }}
              className={`flex-1 py-1.5 px-1 rounded-lg border text-[10px] font-semibold cursor-pointer transition-colors ${
                price === tpl.price && shipping === tpl.shipping
                  ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                  : 'bg-[#0d0d0d] border-[#1a1a1a] text-gs-dim hover:text-gs-muted'
              }`}
            >
              <div>{tpl.label}</div>
              <div className="text-[9px] opacity-60">${tpl.price}</div>
            </button>
          ))}
        </div>
      )}

      {err && <div className="bg-red-500/[0.13] border border-red-500/[0.27] rounded-lg px-3 py-2 text-red-400 text-xs mb-3.5">{err}</div>}

      {/* Improvement 13 (new): Offer success probability indicator */}
      {showProbability && successProbability && offerType === "cash" && (
        <div className="mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gs-dim font-mono">OFFER SUCCESS PROBABILITY</span>
            <button onClick={() => setShowProbability(false)} className="text-[9px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted">hide</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${successProbability.probability}%`, backgroundColor: successProbability.color }}
              />
            </div>
            <span className="text-[12px] font-bold" style={{ color: successProbability.color }}>
              {successProbability.probability}%
            </span>
          </div>
          <div className="text-[10px] mt-1" style={{ color: successProbability.color }}>
            {successProbability.label} chance of acceptance
            {successProbability.probability < 50 && " — consider increasing your offer"}
          </div>
        </div>
      )}

      {/* Combo split view — cash + trade side by side */}
      {offerType === "combo" && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#0d0d0d] rounded-[10px] p-3 border border-[#1a1a1a]">
            <div className="text-[10px] text-gs-dim font-mono mb-2 tracking-wider">RECORD SWAP</div>
            {selectedTradeRecord ? (
              <div className="flex gap-2 items-center">
                <AlbumArt album={selectedTradeRecord.album} artist={selectedTradeRecord.artist} accent={selectedTradeRecord.accent} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-gs-text truncate">{selectedTradeRecord.album}</div>
                  <Badge label={selectedTradeRecord.condition} color={condColor(selectedTradeRecord.condition)} />
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-gs-faint">Pick a record below</div>
            )}
          </div>
          <div className="bg-[#0d0d0d] rounded-[10px] p-3 border border-[#1a1a1a]">
            <div className="text-[10px] text-gs-dim font-mono mb-2 tracking-wider">+ CASH</div>
            <div className="text-lg font-bold text-emerald-400">${(parseFloat(price) || 0).toFixed(2)}</div>
            <div className="text-[10px] text-gs-dim">+ ${(parseFloat(shipping) || 0).toFixed(2)} shipping</div>
          </div>
        </div>
      )}

      {/* Improvement 10 (new): Trade + cash combination */}
      {offerType === "trade" && selectedTradeRecord && (
        <div className="mb-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gs-dim font-mono">ADD CASH TO SWEETEN THE TRADE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gs-muted">+$</span>
            <input
              value={tradeCashAmount}
              onChange={e => setTradeCashAmount(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0.00"
              className="flex-1 bg-[#111] border border-[#222] rounded-md px-2 py-1.5 text-[12px] text-gs-text outline-none"
            />
            <span className="text-[10px] text-gs-dim">optional cash bonus</span>
          </div>
          {tradeCashAmount && parseFloat(tradeCashAmount) > 0 && (
            <div className="mt-1.5 text-[10px] text-emerald-400">
              Trade + ${parseFloat(tradeCashAmount).toFixed(2)} cash
            </div>
          )}
        </div>
      )}

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
                  {selected && <span className="text-sm shrink-0" style={{ color: r.accent }}>{"\u2713"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Condition comparison side-by-side for trades */}
      {offerType !== "cash" && selectedTradeRecord && target.offeredRecord && (
        <div className="mb-4 bg-[#0d0d0d] rounded-[10px] p-3.5 border border-[#1a1a1a]">
          <div className="text-[10px] text-gs-dim font-mono mb-2.5 tracking-wider">CONDITION COMPARISON</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-[10px] text-gs-faint mb-1.5">YOUR RECORD</div>
              <Badge label={target.offeredRecord.condition} color={condColor(target.offeredRecord.condition)} />
              <div className="text-[10px] text-gs-dim mt-1">{target.offeredRecord.album}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gs-faint mb-1.5">THEIR RECORD</div>
              <Badge label={selectedTradeRecord.condition} color={condColor(selectedTradeRecord.condition)} />
              <div className="text-[10px] text-gs-dim mt-1">{selectedTradeRecord.album}</div>
            </div>
          </div>
          {/* Fair trade indicator */}
          {fairTrade && (
            <div
              className="flex items-center justify-center gap-1.5 mt-3 pt-2.5 border-t border-[#1a1a1a] text-[11px] font-semibold"
              style={{ color: fairTrade.color }}
            >
              <span>{fairTrade.icon}</span>
              <span>{fairTrade.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Cash fields — shown for cash and combo */}
      {offerType !== "trade" && (
        <>
          <FormInput label={offerType === "combo" ? "ADDITIONAL CASH (USD)" : "OFFER PRICE (USD)"} value={price} onChange={v => setPrice(v.replace(/[^\d.]/g, ""))} placeholder="25.00" />
          <FormInput label="SHIPPING & HANDLING (USD)" value={shipping} onChange={v => setShipping(v.replace(/[^\d.]/g, ""))} placeholder="6.00" />
        </>
      )}

      {/* Improvement 7: Condition photo requirement for high-value offers */}
      {isHighValue && offerType !== "trade" && (
        <div className="mb-4 bg-amber-500/[0.06] border border-amber-500/20 rounded-[10px] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-sm">{"\uD83D\uDCF8"}</span>
            <span className="text-[11px] text-amber-400 font-semibold">High-Value Offer — Photo Recommended</span>
          </div>
          <div className="text-[11px] text-gs-dim mb-2">
            For offers over $60, buyers typically expect condition photos. Confirm you can provide them.
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={photoAcknowledged}
              onChange={e => setPhotoAcknowledged(e.target.checked)}
              className="accent-amber-400"
            />
            <span className="text-[11px] text-gs-muted">I can provide condition photos upon request</span>
          </label>
        </div>
      )}

      {/* Improvement 3: Offer expiration */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] text-gs-dim font-mono">EXPIRES IN</span>
        <select
          value={expiresIn}
          onChange={e => setExpiresIn(e.target.value)}
          className="bg-[#111] border border-[#222] rounded-md px-2 py-1 text-[11px] text-gs-text outline-none cursor-pointer"
        >
          <option value="24">24 hours</option>
          <option value="48">48 hours</option>
          <option value="72">72 hours</option>
          <option value="168">7 days</option>
          <option value="0">No expiration</option>
        </select>
      </div>

      {/* Improvement 11 (new): Offer message with templates */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gs-dim font-mono">MESSAGE TO SELLER (OPTIONAL)</span>
          <button
            onClick={() => setShowMessageTemplates(v => !v)}
            className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline"
          >
            {showMessageTemplates ? "Hide templates" : "Use template"}
          </button>
        </div>
        {showMessageTemplates && (
          <div className="mb-2 flex flex-col gap-1">
            {MESSAGE_TEMPLATES.map(tpl => (
              <button
                key={tpl.label}
                onClick={() => { setOfferMessage(tpl.text); setShowMessageTemplates(false); }}
                className={`text-left px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  offerMessage === tpl.text
                    ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent'
                    : 'bg-[#0d0d0d] border-[#1a1a1a] text-gs-dim hover:text-gs-muted hover:border-[#333]'
                }`}
              >
                <div className="text-[11px] font-semibold">{tpl.label}</div>
                <div className="text-[10px] opacity-60 truncate">{tpl.text}</div>
              </button>
            ))}
          </div>
        )}
        <textarea
          value={offerMessage}
          onChange={e => setOfferMessage(e.target.value)}
          placeholder="Add a personal message to increase your chances..."
          maxLength={300}
          className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none font-sans resize-none h-[50px]"
        />
        {offerMessage.length > 0 && (
          <div className="text-[10px] text-gs-faint text-right mt-0.5">{offerMessage.length}/300</div>
        )}
      </div>

      {/* Improvement 5: Bundle note */}
      <div className="mb-4">
        <button
          onClick={() => setShowBundleNote(v => !v)}
          className="text-[11px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted p-0 font-semibold"
        >
          {showBundleNote ? "- Remove bundle note" : "+ Add bundle / note"}
        </button>
        {showBundleNote && (
          <textarea
            value={bundleNote}
            onChange={e => setBundleNote(e.target.value)}
            placeholder="E.g., 'I have 3 more records you might like -- open to a bundle deal?'"
            className="w-full mt-2 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text outline-none font-sans resize-none h-[50px]"
          />
        )}
      </div>

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
              <span>You get</span><span className="text-gs-text">{selectedTradeRecord?.album || "\u2014"}</span>
            </div>
            {/* Improvement 10: Trade + cash in summary */}
            {tradeCashAmount && parseFloat(tradeCashAmount) > 0 && (
              <div className="flex justify-between text-[13px] text-emerald-400 mb-1.5">
                <span>+ Cash bonus</span><span>${parseFloat(tradeCashAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>Shipping (each party)</span><span>$6.00</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>Transaction fee (5%)</span><span>$0.00</span>
            </div>
            <div className="flex justify-between text-[15px] font-bold text-gs-text border-t border-[#222] pt-2.5 mt-2.5">
              <span>Type</span><span>{tradeCashAmount && parseFloat(tradeCashAmount) > 0 ? "Trade + Cash" : "Straight trade"}</span>
            </div>
          </>
        )}
        {offerType === "combo" && (
          <>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You give</span><span className="text-gs-text">{target.wishlistItem.album}</span>
            </div>
            <div className="flex justify-between text-[13px] text-gs-muted mb-1.5">
              <span>You get</span><span className="text-gs-text">{selectedTradeRecord?.album || "\u2014"}</span>
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

        {/* Improvement 9: Bundle records in summary */}
        {bundleMode && bundleRecords.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
            <div className="text-[10px] text-purple-400 font-mono mb-1">BUNDLE ({bundleRecords.length} records)</div>
            {bundleRecords.map(r => (
              <div key={r.id} className="text-[11px] text-gs-dim">{r.album} - {r.artist}</div>
            ))}
          </div>
        )}

        {/* Improvement 3: Expiration display in summary */}
        {expiresIn !== "0" && (
          <div className="flex justify-between text-[11px] text-gs-dim mt-2 pt-2 border-t border-[#1a1a1a]">
            <span>Expires</span>
            <span>{expiresIn}h after sent</span>
          </div>
        )}
      </div>

      <div className="flex gap-2.5">
        <button onClick={() => { reset(); onClose(); }} className="flex-1 py-[11px] bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-muted text-[13px] font-semibold cursor-pointer">Cancel</button>
        <button onClick={handleSubmit} className="flex-[2] py-[11px] gs-btn-gradient border-none rounded-[10px] text-white text-[13px] font-bold cursor-pointer">
          {isCounterOffer ? "Send Counter" : offerType === "cash" ? "Send Offer" : offerType === "trade" ? "Send Trade Offer" : "Send Combo Offer"}
        </button>
      </div>
    </Modal>
  );
}
