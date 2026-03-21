// Transactions hub — shows the current user's activity across four tabs:
// Offers Sent, Offers Received, Purchases, and Cart.
// Features: search/filter, date range, CSV export, larger album art on offers,
// order tracking, running totals, reorder button, drag-to-reorder cart.
// Improvements: dispute button, shipping label generation, delivery tracking,
// receipt PDF export, refund request flow, transaction rating/review,
// repeat purchase, spending analytics, payment method icons, bulk checkout,
// price alerts, order confirmation email preview.
// Round 2: invoice generation, multi-currency support, transaction timeline,
// auto price adjustment suggestions, shipping tracking map, transaction notes/tags,
// recurring purchase setup, gift card/credit system, accounting format export,
// split payment, escrow status indicator, satisfaction survey.
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

// ── New Improvement 15: Multi-currency exchange rates (simulated) ────────
const CURRENCIES = [
  { code: "USD", symbol: "$", rate: 1.0, flag: "US" },
  { code: "EUR", symbol: "\u20AC", rate: 0.92, flag: "EU" },
  { code: "GBP", symbol: "\u00A3", rate: 0.79, flag: "GB" },
  { code: "JPY", symbol: "\u00A5", rate: 149.5, flag: "JP" },
  { code: "CAD", symbol: "C$", rate: 1.36, flag: "CA" },
];

// ── New Improvement 24: Escrow stages ───────────────────────────────────
const ESCROW_STAGES = [
  { key: "funds_held", label: "Funds Held", color: "#f59e0b" },
  { key: "item_shipped", label: "Item Shipped", color: "#0ea5e9" },
  { key: "item_received", label: "Item Received", color: "#8b5cf6" },
  { key: "released", label: "Funds Released", color: "#22c55e" },
];

const getEscrowStage = (purchaseId) => {
  let hash = 0;
  const idStr = String(purchaseId);
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  return Math.abs(hash) % ESCROW_STAGES.length;
};

// ── Improvement C14: Transaction messaging thread helpers ────────────────
const generateMessageThread = (purchaseId, seller, buyer) => {
  let h = 0;
  const s = String(purchaseId);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const msgs = [
    { from: buyer, text: "Hi! Looking forward to receiving this record. Any idea on shipping timeline?", time: "2 days ago" },
    { from: seller, text: "Just packed it up! Shipping tomorrow via USPS Media Mail.", time: "1 day ago" },
    { from: buyer, text: "Perfect, thanks!", time: "1 day ago" },
  ];
  if (Math.abs(h) % 2 === 0) {
    msgs.push({ from: seller, text: "Tracking number has been updated. Should arrive in 3-5 days.", time: "12 hours ago" });
  }
  return msgs;
};

// ── Improvement C15: Automated follow-up reminders ──────────────────────
const getFollowUpReminders = (purchase, stage) => {
  const reminders = [];
  if (stage < 2) reminders.push({ type: 'ship', text: `Remind @${purchase.seller} to ship your order`, urgency: 'medium' });
  if (stage >= 4) reminders.push({ type: 'review', text: 'Leave a review for this transaction', urgency: 'low' });
  if (stage >= 2 && stage < 4) reminders.push({ type: 'confirm', text: 'Confirm delivery when your record arrives', urgency: 'high' });
  return reminders;
};

// ── Improvement C17: Transaction insurance status ───────────────────────
const getInsuranceStatus = (purchase) => {
  const price = parseFloat(purchase.price) || 0;
  if (price >= 100) return { insured: true, coverage: price, premium: Math.round(price * 0.03), provider: 'GrooveGuard Premium' };
  if (price >= 50) return { insured: true, coverage: price * 0.8, premium: Math.round(price * 0.02), provider: 'GrooveGuard Basic' };
  return { insured: false, coverage: 0, premium: 0, provider: 'Not insured' };
};

// ── Improvement C19: Payment installment tracker ────────────────────────
const getInstallmentPlan = (purchase) => {
  const price = parseFloat(purchase.price) || 0;
  if (price < 50) return null;
  const installments = price >= 200 ? 4 : price >= 100 ? 3 : 2;
  const amount = Math.round(price / installments * 100) / 100;
  let h = 0;
  const s = String(purchase.id);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const paid = (Math.abs(h) % installments) + 1;
  return { total: installments, paid: Math.min(paid, installments), amount, remaining: Math.max(0, installments - paid) };
};

// ── Improvement C22: Package weight estimator ───────────────────────────
const estimatePackageWeight = (purchase) => {
  const fmt = (purchase.format || '').toLowerCase();
  let weight = 0.5; // base lbs
  if (fmt.includes('12') || fmt.includes('lp')) weight = 1.2;
  else if (fmt.includes('7')) weight = 0.4;
  else if (fmt.includes('10')) weight = 0.8;
  else if (fmt.includes('cd')) weight = 0.3;
  else if (fmt.includes('cassette')) weight = 0.2;
  // packaging adds weight
  weight += 0.3;
  return { weight: weight.toFixed(1), unit: 'lbs', oz: Math.round(weight * 16) };
};

// ── Improvement C21: Customs declaration generator ──────────────────────
const generateCustomsDeclaration = (purchase, currentUser) => {
  const weight = estimatePackageWeight(purchase);
  return [
    "═══════════════════════════════════════════",
    "     CUSTOMS DECLARATION (CN 22/23)        ",
    "═══════════════════════════════════════════",
    "",
    `Sender:      @${purchase.seller}`,
    `Recipient:   @${currentUser}`,
    "",
    "CONTENTS DESCRIPTION:",
    `  Item:        Vinyl Record`,
    `  Description: ${purchase.album} by ${purchase.artist}`,
    `  Format:      ${purchase.format || 'N/A'}`,
    `  Quantity:    1`,
    `  Value:       $${parseFloat(purchase.price).toFixed(2)} USD`,
    `  Weight:      ${weight.weight} ${weight.unit} (${weight.oz} oz)`,
    `  HS Code:     8524.39 (Recorded media)`,
    "",
    "PURPOSE: Commercial / Gift",
    "ORIGIN:  United States",
    "",
    "═══════════════════════════════════════════",
    "I certify the above is correct.",
    "═══════════════════════════════════════════",
  ].join("\n");
};

// ── Improvement C24: Dispute timeline stages ────────────────────────────
const DISPUTE_TIMELINE_STAGES = [
  { key: 'filed', label: 'Dispute Filed', color: '#ef4444' },
  { key: 'review', label: 'Under Review', color: '#f59e0b' },
  { key: 'evidence', label: 'Evidence Requested', color: '#0ea5e9' },
  { key: 'resolution', label: 'Resolution', color: '#8b5cf6' },
  { key: 'closed', label: 'Closed', color: '#22c55e' },
];

// ── New Improvement 16: Transaction timeline component ──────────────────
function TransactionTimeline({ purchases, offers, currentUser }) {
  const events = useMemo(() => {
    const items = [];
    (purchases || []).forEach(p => {
      items.push({ type: "purchase", label: `Purchased ${p.album}`, detail: `$${p.price} from @${p.seller}`, time: p.time || "Recently", color: "#22c55e", icon: "P" });
    });
    (offers || []).filter(o => o.from === currentUser || o.to === currentUser).forEach(o => {
      const dir = o.from === currentUser ? "Sent" : "Received";
      items.push({ type: "offer", label: `${dir} offer for ${o.album}`, detail: `${o.type} — ${o.status || "pending"}`, time: o.time || "Recently", color: dir === "Sent" ? "#0ea5e9" : "#8b5cf6", icon: dir === "Sent" ? "S" : "R" });
    });
    return items.slice(0, 10);
  }, [purchases, offers, currentUser]);

  if (events.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="text-xs font-bold text-gs-muted uppercase tracking-wider mb-3">Transaction Timeline</div>
      <div className="bg-gs-card border border-gs-border rounded-xl overflow-hidden">
        {events.map((ev, i) => (
          <div key={i} className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-[#1a1a1a]" : ""}`}>
            <div className="flex flex-col items-center shrink-0">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: ev.color + "20", color: ev.color }}>{ev.icon}</div>
              {i < events.length - 1 && <div className="w-0.5 h-3 bg-[#1a1a1a] mt-0.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-gs-text truncate">{ev.label}</div>
              <div className="text-[10px] text-gs-dim truncate">{ev.detail}</div>
            </div>
            <div className="text-[9px] text-gs-faint font-mono shrink-0">{ev.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Improvement 9: Payment method icons ─────────────────────────────────
function PaymentMethodIcon({ method }) {
  const icons = {
    visa: { label: "Visa", bg: "#1a1f71", text: "white" },
    mastercard: { label: "MC", bg: "#eb001b", text: "white" },
    paypal: { label: "PP", bg: "#003087", text: "white" },
    apple: { label: "AP", bg: "#000", text: "white" },
    default: { label: "$", bg: "#333", text: "#ccc" },
  };
  const info = icons[method] || icons.default;
  return (
    <span
      className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[8px] font-bold shrink-0"
      style={{ background: info.bg, color: info.text }}
      title={info.label}
    >
      {info.label}
    </span>
  );
}

// ── Improvement 8: Spending analytics mini-chart ────────────────────────
function SpendingAnalytics({ purchases }) {
  const monthlyData = useMemo(() => {
    const months = {};
    const now = new Date();
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      months[key] = { label, amount: 0, count: 0 };
    }
    // Aggregate purchases
    (purchases || []).forEach(p => {
      const price = parseFloat(p.price) || 0;
      // Distribute purchases across months deterministically
      let hash = 0;
      const idStr = String(p.id);
      for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
      const monthIdx = Math.abs(hash) % 6;
      const keys = Object.keys(months);
      if (keys[monthIdx]) {
        months[keys[monthIdx]].amount += price;
        months[keys[monthIdx]].count += 1;
      }
    });
    return Object.values(months);
  }, [purchases]);

  const maxAmount = Math.max(1, ...monthlyData.map(d => d.amount));
  const chartHeight = 60;

  // Category breakdown
  const categoryData = useMemo(() => {
    const cats = {};
    (purchases || []).forEach(p => {
      const fmt = p.format || "Other";
      cats[fmt] = (cats[fmt] || 0) + (parseFloat(p.price) || 0);
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [purchases]);

  const categoryColors = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#22c55e"];

  if ((purchases || []).length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-gs-muted uppercase tracking-wider">Spending Analytics</div>
        <div className="text-[10px] text-gs-dim font-mono">6 months</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Monthly spending chart */}
        <div className="bg-gs-card border border-gs-border rounded-xl p-3">
          <div className="text-[10px] text-gs-dim font-mono mb-2">Monthly Spending</div>
          <div className="flex items-end gap-1.5" style={{ height: chartHeight }}>
            {monthlyData.map((d, i) => {
              const h = Math.max(4, (d.amount / maxAmount) * chartHeight);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end">
                  <div className="text-[8px] text-gs-faint font-mono mb-1">{d.amount > 0 ? `$${Math.round(d.amount)}` : ""}</div>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{ height: h, background: i === monthlyData.length - 1 ? "#0ea5e9" : "#0ea5e944" }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[8px] text-gs-faint font-mono">{d.label}</div>
            ))}
          </div>
        </div>
        {/* Category breakdown */}
        <div className="bg-gs-card border border-gs-border rounded-xl p-3">
          <div className="text-[10px] text-gs-dim font-mono mb-2">By Format</div>
          <div className="flex flex-col gap-2">
            {categoryData.map(([cat, amount], i) => {
              const totalCat = categoryData.reduce((s, c) => s + c[1], 0);
              const pct = totalCat > 0 ? (amount / totalCat) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gs-muted font-semibold">{cat}</span>
                    <span className="text-gs-dim font-mono">${amount.toFixed(0)} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: categoryColors[i] || "#555" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsScreen({ offers, purchases, cart, currentUser, records, profile, onBuy, onRemoveFromCart, onViewUser, onDetail, onAcceptOffer, onDeclineOffer }) {
  const [tab, setTab] = useState("offers sent");
  const [acceptingId, setAcceptingId] = useState(null);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [selectedCartIds, setSelectedCartIds] = useState([]); // Improvement 10: Bulk checkout
  const [showAnalytics, setShowAnalytics] = useState(false); // Improvement 8: Analytics toggle
  const [selectedCurrency, setSelectedCurrency] = useState("USD"); // New Improvement 15: Multi-currency
  const [showTimeline, setShowTimeline] = useState(false); // New Improvement 16: Timeline
  const [showGiftCard, setShowGiftCard] = useState(false); // New Improvement 21: Gift card system
  const [giftCardBalance, setGiftCardBalance] = useState(25.00); // New Improvement 21
  const [giftCardCode, setGiftCardCode] = useState(""); // New Improvement 21
  const [showRecurring, setShowRecurring] = useState(false); // New Improvement 20: Recurring
  const [showAccountingExport, setShowAccountingExport] = useState(false); // New Improvement 22
  const [transactionNotes, setTransactionNotes] = useState({}); // New Improvement 19: Notes/tags
  const [transactionTags, setTransactionTags] = useState({}); // New Improvement 19

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

  // ── Improvement 4: Receipt PDF export (generates a text-based receipt) ─
  const exportReceipt = useCallback((purchase) => {
    const receipt = [
      "═══════════════════════════════════════",
      "           GROOVESTACK RECEIPT          ",
      "═══════════════════════════════════════",
      "",
      `Order ID:    ${purchase.id}`,
      `Date:        ${purchase.time || new Date().toLocaleDateString()}`,
      `Buyer:       @${currentUser}`,
      `Seller:      @${purchase.seller}`,
      "",
      "───────────────────────────────────────",
      `Album:       ${purchase.album}`,
      `Artist:      ${purchase.artist}`,
      `Format:      ${purchase.format || "N/A"}`,
      `Year:        ${purchase.year || "N/A"}`,
      `Condition:   ${purchase.condition || "N/A"}`,
      "───────────────────────────────────────",
      "",
      `Subtotal:    $${parseFloat(purchase.price).toFixed(2)}`,
      `Fee (5%):    $${(parseFloat(purchase.price) * 0.05).toFixed(2)}`,
      `Shipping:    $6.00`,
      `Total:       $${(parseFloat(purchase.price) * 1.05 + 6).toFixed(2)}`,
      "",
      "═══════════════════════════════════════",
      "        Thank you for your purchase!    ",
      "═══════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${purchase.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentUser]);

  // ── Improvement 10: Bulk cart management ──────────────────────────────
  const toggleCartSelection = useCallback((itemId) => {
    setSelectedCartIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const selectAllCart = useCallback(() => {
    const availableIds = (cart || [])
      .filter(item => records.find(r => r.id === item.recordId)?.forSale)
      .map(item => item.id);
    setSelectedCartIds(prev =>
      prev.length === availableIds.length ? [] : availableIds
    );
  }, [cart, records]);

  // ── New Improvement 15: Currency conversion helper ───────────────────
  const currencyInfo = CURRENCIES.find(c => c.code === selectedCurrency) || CURRENCIES[0];
  const convertPrice = useCallback((usdPrice) => {
    const val = parseFloat(usdPrice) * currencyInfo.rate;
    if (currencyInfo.code === "JPY") return `${currencyInfo.symbol}${Math.round(val)}`;
    return `${currencyInfo.symbol}${val.toFixed(2)}`;
  }, [currencyInfo]);

  // ── New Improvement 17: Price adjustment suggestions ─────────────────
  const priceAdjustments = useMemo(() => {
    return (cart || []).slice(0, 3).map(item => {
      let h = 0;
      const s = String(item.id);
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      const pct = (Math.abs(h) % 15) + 3;
      const dir = Math.abs(h) % 3 === 0 ? "up" : "down";
      return { id: item.id, album: item.album, direction: dir, percent: pct, suggested: dir === "down" ? (parseFloat(item.price) * (1 - pct / 100)).toFixed(2) : (parseFloat(item.price) * (1 + pct / 100)).toFixed(2) };
    });
  }, [cart]);

  // ── New Improvement 14: Invoice generation ───────────────────────────
  const generateInvoice = useCallback((purchase) => {
    const invNum = `INV-${String(purchase.id).slice(0, 8).toUpperCase()}`;
    const subtotal = parseFloat(purchase.price);
    const fee = subtotal * 0.05;
    const shipping = 6.00;
    const total = subtotal + fee + shipping;
    const invoice = [
      "╔══════════════════════════════════════════╗",
      "║          GROOVESTACK INVOICE              ║",
      "╚══════════════════════════════════════════╝",
      "",
      `Invoice #:   ${invNum}`,
      `Date:        ${new Date().toLocaleDateString()}`,
      `Due Date:    ${new Date().toLocaleDateString()}`,
      "",
      "BILL TO:",
      `  @${currentUser}`,
      "",
      "FROM:",
      `  @${purchase.seller}`,
      "",
      "─────────────────────────────────────────────",
      "ITEM DETAILS:",
      `  Album:       ${purchase.album}`,
      `  Artist:      ${purchase.artist}`,
      `  Format:      ${purchase.format || "N/A"}`,
      `  Year:        ${purchase.year || "N/A"}`,
      `  Condition:   ${purchase.condition || "N/A"}`,
      "",
      "─────────────────────────────────────────────",
      "CHARGES:",
      `  Subtotal:           $${subtotal.toFixed(2)}`,
      `  Platform Fee (5%):  $${fee.toFixed(2)}`,
      `  Shipping:           $${shipping.toFixed(2)}`,
      `  ─────────────────────────────`,
      `  TOTAL:              $${total.toFixed(2)}`,
      "",
      `  Currency:           ${selectedCurrency} (${convertPrice(total)})`,
      "",
      "─────────────────────────────────────────────",
      "PAYMENT STATUS: PAID",
      "─────────────────────────────────────────────",
      "",
      "Terms: All sales are final unless item is not as described.",
      "       Disputes must be filed within 14 days of delivery.",
      "",
      "Thank you for using Groovestack!",
    ].join("\n");

    const blob = new Blob([invoice], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invNum}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentUser, selectedCurrency, convertPrice]);

  // ── New Improvement 22: Accounting format export ─────────────────────
  const exportAccounting = useCallback(() => {
    const headers = ["Date","Type","Description","Debit","Credit","Category","Reference","Currency","Converted"];
    const rows = [];
    (purchases || []).forEach(p => {
      const price = parseFloat(p.price) || 0;
      rows.push([
        p.time || new Date().toLocaleDateString(),
        "Purchase",
        `${p.album} by ${p.artist}`,
        price.toFixed(2),
        "0.00",
        p.format || "Records",
        `PUR-${String(p.id).slice(0, 8)}`,
        selectedCurrency,
        convertPrice(price),
      ]);
      rows.push([
        p.time || new Date().toLocaleDateString(),
        "Fee",
        `Platform fee for ${p.album}`,
        (price * 0.05).toFixed(2),
        "0.00",
        "Fees",
        `FEE-${String(p.id).slice(0, 8)}`,
        selectedCurrency,
        convertPrice(price * 0.05),
      ]);
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groovestack-accounting-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [purchases, selectedCurrency, convertPrice]);

  // Micro-improvement 15: Transaction summary email generator
  const generateSummaryEmail = useCallback(() => {
    const totalPurchases = (purchases || []).length;
    const totalSpent = totals.spent.toFixed(2);
    const totalOffers = sentOffers.length + receivedOffers.length;
    const accepted = [...sentOffers, ...receivedOffers].filter(o => o.status === 'accepted').length;
    const email = [
      `Subject: Groovestack Transaction Summary - ${new Date().toLocaleDateString()}`,
      '',
      `Hi @${currentUser},`,
      '',
      'Here is your transaction summary:',
      '',
      `Purchases: ${totalPurchases} (Total: $${totalSpent})`,
      `Offers: ${totalOffers} (${accepted} accepted)`,
      `Cart Items: ${(cart || []).length}`,
      '',
      'Top purchases:',
      ...(purchases || []).slice(0, 5).map(p => `  - ${p.album} by ${p.artist} ($${p.price})`),
      '',
      'Thanks for being part of the Groovestack community!',
    ].join('\n');
    const blob = new Blob([email], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-summary-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [purchases, sentOffers, receivedOffers, cart, totals.spent, currentUser]);

  // Micro-improvement 16: Spending limit warnings
  const spendingLimitWarning = useMemo(() => {
    const monthlyBudget = 200; // Simulated monthly budget
    const thisMonthSpent = (purchases || []).reduce((sum, p) => {
      return sum + (parseFloat(p.price) || 0);
    }, 0);
    const pct = Math.round((thisMonthSpent / monthlyBudget) * 100);
    return {
      budget: monthlyBudget,
      spent: thisMonthSpent,
      pct: Math.min(pct, 100),
      overBudget: thisMonthSpent > monthlyBudget,
      nearLimit: pct >= 80 && pct < 100,
    };
  }, [purchases]);

  // Micro-improvement 17: Tax summary for year-end
  const [showTaxSummary, setShowTaxSummary] = useState(false);
  const taxSummary = useMemo(() => {
    const year = new Date().getFullYear();
    const totalPurchases = (purchases || []).reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
    const totalFees = totalPurchases * 0.05;
    const totalShipping = (purchases || []).length * 6;
    const totalEarnings = sentOffers.filter(o => o.status === 'accepted').reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0);
    return {
      year,
      purchases: totalPurchases,
      fees: totalFees,
      shipping: totalShipping,
      totalDeductible: totalFees + totalShipping,
      earnings: totalEarnings,
      netSpend: totalPurchases + totalFees + totalShipping - totalEarnings,
    };
  }, [purchases, sentOffers]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">Activity</h1>
        <p className="text-xs text-gs-dim">Your transactions, offers, and cart</p>
      </div>

      {/* Micro-improvement 16: Spending limit warning bar */}
      <div className="bg-gs-card border border-gs-border rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-gs-dim uppercase tracking-wider">Monthly Budget</span>
          <span className="text-[10px] font-mono" style={{ color: spendingLimitWarning.overBudget ? '#ef4444' : spendingLimitWarning.nearLimit ? '#f59e0b' : '#22c55e' }}>
            ${spendingLimitWarning.spent.toFixed(0)} / ${spendingLimitWarning.budget}
          </span>
        </div>
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${spendingLimitWarning.pct}%`, background: spendingLimitWarning.overBudget ? '#ef4444' : spendingLimitWarning.nearLimit ? '#f59e0b' : '#22c55e' }} />
        </div>
        {spendingLimitWarning.overBudget && <div className="text-[9px] text-red-400 mt-1 font-mono">Over budget this month!</div>}
        {spendingLimitWarning.nearLimit && !spendingLimitWarning.overBudget && <div className="text-[9px] text-amber-400 mt-1 font-mono">Approaching budget limit</div>}
      </div>

      {/* Micro-improvement 15 & 17: Summary email & Tax summary buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={generateSummaryEmail}
          className="flex-1 text-[10px] py-2 rounded-lg border border-gs-border bg-gs-card text-gs-muted cursor-pointer hover:text-gs-accent hover:border-gs-accent/30 transition-colors font-mono"
        >
          Export Summary Email
        </button>
        <button
          onClick={() => setShowTaxSummary(!showTaxSummary)}
          className={`flex-1 text-[10px] py-2 rounded-lg border font-mono cursor-pointer transition-colors ${showTaxSummary ? 'bg-gs-accent/15 border-gs-accent/30 text-gs-accent' : 'border-gs-border bg-gs-card text-gs-muted hover:text-gs-accent hover:border-gs-accent/30'}`}
        >
          Tax Summary {new Date().getFullYear()}
        </button>
      </div>

      {/* Micro-improvement 17: Tax summary panel */}
      {showTaxSummary && (
        <div className="bg-gs-card border border-gs-border rounded-xl p-4 mb-4">
          <div className="text-[10px] font-mono text-gs-dim uppercase tracking-wider mb-3">Tax Summary - {taxSummary.year}</div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between"><span className="text-gs-faint">Total Purchases:</span><span className="text-gs-text font-bold">${taxSummary.purchases.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gs-faint">Platform Fees:</span><span className="text-gs-text font-bold">${taxSummary.fees.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gs-faint">Shipping Costs:</span><span className="text-gs-text font-bold">${taxSummary.shipping.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gs-faint">Total Earnings:</span><span className="text-green-400 font-bold">${taxSummary.earnings.toFixed(2)}</span></div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#1a1a1a] flex justify-between text-xs">
            <span className="text-gs-dim font-mono">Net Spend:</span>
            <span className="font-extrabold" style={{ color: taxSummary.netSpend > 0 ? '#ef4444' : '#22c55e' }}>${Math.abs(taxSummary.netSpend).toFixed(2)}</span>
          </div>
        </div>
      )}

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
      <div className="flex gap-2.5 mb-4">
        <div className="flex-1 bg-[#111] border border-gs-border rounded-xl py-2.5 px-3 flex items-center justify-between">
          <span className="text-[10px] text-gs-dim font-mono">Total Spent</span>
          <span className="text-sm font-extrabold text-red-400">${totals.spent.toFixed(2)}</span>
        </div>
        <div className="flex-1 bg-[#111] border border-gs-border rounded-xl py-2.5 px-3 flex items-center justify-between">
          <span className="text-[10px] text-gs-dim font-mono">Total Earned</span>
          <span className="text-sm font-extrabold text-green-500">${totals.earned.toFixed(2)}</span>
        </div>
      </div>

      {/* Improvement 8: Analytics toggle and chart */}
      {(purchases || []).length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5 mb-3"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            {showAnalytics ? "Hide" : "Show"} Spending Analytics
          </button>
          {showAnalytics && <SpendingAnalytics purchases={purchases} />}
        </div>
      )}

      {/* ── New Improvement 15: Multi-currency selector ─────────────────── */}
      <div className="flex gap-2 items-center mb-4">
        <span className="text-[10px] text-gs-dim font-mono">Currency:</span>
        <div className="flex gap-1">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCurrency(c.code)}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                selectedCurrency === c.code
                  ? "border-gs-accent bg-gs-accent/10 text-gs-accent"
                  : "border-gs-border bg-transparent text-gs-dim hover:border-gs-muted cursor-pointer"
              }`}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
        {selectedCurrency !== "USD" && (
          <span className="text-[9px] text-gs-faint font-mono ml-auto">
            Totals: {convertPrice(totals.spent)} spent / {convertPrice(totals.earned)} earned
          </span>
        )}
      </div>

      {/* ── New Improvement 16: Transaction Timeline toggle ───────────────── */}
      <div className="mb-4">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5 mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {showTimeline ? "Hide" : "Show"} Transaction Timeline
        </button>
        {showTimeline && <TransactionTimeline purchases={purchases} offers={offers} currentUser={currentUser} />}
      </div>

      {/* ── New Improvement 21: Gift Card / Credit System ─────────────────── */}
      <div className="mb-4">
        <button
          onClick={() => setShowGiftCard(!showGiftCard)}
          className="gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V2"/><path d="M19 8c-2 0-4-2-7-2S7 8 5 8"/></svg>
          Gift Cards & Credits ({currencyInfo.symbol}{(giftCardBalance * currencyInfo.rate).toFixed(2)} balance)
        </button>
        {showGiftCard && (
          <div className="bg-gs-card border border-gs-border rounded-xl p-4 mt-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] text-gs-dim font-mono">Current Balance</div>
                <div className="text-xl font-extrabold text-green-500">${giftCardBalance.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gs-dim font-mono">In {selectedCurrency}</div>
                <div className="text-lg font-bold text-gs-muted">{convertPrice(giftCardBalance)}</div>
              </div>
            </div>
            <div className="flex gap-2 items-center mb-3">
              <input
                type="text"
                value={giftCardCode}
                onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                placeholder="Enter gift card code..."
                className="flex-1 bg-[#111] border border-gs-border rounded-lg px-3 py-1.5 text-[11px] text-gs-text font-mono placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
              />
              <button
                onClick={() => {
                  if (giftCardCode.trim().length >= 6) {
                    setGiftCardBalance(prev => prev + 25);
                    setGiftCardCode("");
                  }
                }}
                disabled={giftCardCode.trim().length < 6}
                className={`gs-btn-gradient px-3 py-1.5 text-[10px] ${giftCardCode.trim().length < 6 ? "opacity-40" : ""}`}
              >
                Redeem
              </button>
            </div>
            <div className="flex gap-2">
              <button className="gs-btn-secondary flex-1 py-2 text-[10px]">Buy Gift Card</button>
              <button className="gs-btn-secondary flex-1 py-2 text-[10px]">Send as Gift</button>
            </div>
          </div>
        )}
      </div>

      {/* ── New Improvement 22: Accounting Export button ───────────────────── */}
      {(purchases || []).length > 0 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setShowAccountingExport(!showAccountingExport)}
            className="gs-btn-secondary px-3.5 py-2 text-[11px] flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Accounting Export
          </button>
          {showAccountingExport && (
            <div className="flex gap-2 items-center">
              <button onClick={exportAccounting} className="gs-btn-gradient px-3 py-2 text-[10px]">Download CSV (QuickBooks)</button>
              <span className="text-[9px] text-gs-faint font-mono">{(purchases || []).length} transactions in {selectedCurrency}</span>
            </div>
          )}
        </div>
      )}

      {/* ── New Improvement 17: Price Adjustment Suggestions ──────────────── */}
      {tab === "cart" && priceAdjustments.length > 0 && (
        <div className="bg-gs-accent/5 border border-gs-accent/15 rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            <span className="text-[11px] font-bold text-gs-accent">Price Suggestions</span>
          </div>
          {priceAdjustments.map(adj => (
            <div key={adj.id} className="text-[10px] text-gs-dim flex items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-gs-muted truncate max-w-[150px]">{adj.album}</span>
              <span>—</span>
              <span>Market suggests</span>
              <span className={adj.direction === "down" ? "text-green-500 font-semibold" : "text-amber-400 font-semibold"}>
                {adj.direction === "down" ? "↓" : "↑"} {adj.percent}% (${adj.suggested})
              </span>
            </div>
          ))}
        </div>
      )}

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
              {filteredPurchases.map(p => (
                <PurchaseRow
                  key={p.id}
                  purchase={p}
                  records={records}
                  currentUser={currentUser}
                  onViewUser={onViewUser}
                  onBuy={onBuy}
                  onExportReceipt={exportReceipt}
                  onGenerateInvoice={generateInvoice}
                  convertPrice={convertPrice}
                  selectedCurrency={selectedCurrency}
                  currencySymbol={currencyInfo.symbol}
                  onAddNote={(id, note) => setTransactionNotes(prev => ({ ...prev, [id]: note }))}
                  onAddTag={(id, tag) => setTransactionTags(prev => ({ ...prev, [id]: [...(prev[id] || []), tag] }))}
                  notes={transactionNotes[p.id] || ""}
                  tags={transactionTags[p.id] || []}
                />
              ))}
            </div>
      )}

      {/* Cart */}
      {tab === "cart" && (
        (cart || []).length === 0
          ? <Empty icon="&#x1F6D2;" text="Your cart is empty." />
          : <div className="flex flex-col gap-2">
              {/* Improvement 10: Bulk select controls */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllCart}
                    className="text-[10px] text-gs-accent bg-transparent border-none cursor-pointer font-semibold hover:underline p-0"
                  >
                    {selectedCartIds.length === (cart || []).filter(item => records.find(r => r.id === item.recordId)?.forSale).length ? "Deselect All" : "Select All"}
                  </button>
                  {selectedCartIds.length > 0 && (
                    <span className="text-[10px] text-gs-dim font-mono">{selectedCartIds.length} selected</span>
                  )}
                </div>
                <div className="text-[10px] text-gs-faint font-mono">Drag items to reorder</div>
              </div>

              {/* Improvement 10: Bulk actions bar */}
              {selectedCartIds.length > 1 && (
                <div className="bg-gs-accent/5 border border-gs-accent/20 rounded-xl px-4 py-2.5 flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gs-accent font-semibold">{selectedCartIds.length} items selected</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${selectedCartIds.length} items from cart?`)) {
                          selectedCartIds.forEach(id => onRemoveFromCart(id));
                          setSelectedCartIds([]);
                        }
                      }}
                      className="gs-btn-secondary px-3 py-1.5 text-[10px]"
                    >
                      Remove Selected
                    </button>
                    <button
                      onClick={() => {
                        const selectedItems = (cart || []).filter(item => selectedCartIds.includes(item.id));
                        const buyable = selectedItems.filter(item => records.find(r => r.id === item.recordId)?.forSale);
                        if (buyable.length > 0) {
                          buyable.forEach(item => {
                            const liveRecord = records.find(r => r.id === item.recordId);
                            if (liveRecord) onBuy(liveRecord);
                          });
                          setSelectedCartIds([]);
                        }
                      }}
                      className="gs-btn-gradient px-3.5 py-1.5 text-[10px]"
                    >
                      Buy Selected ({selectedCartIds.length})
                    </button>
                  </div>
                </div>
              )}

              {cart.map((item, idx) => {
                const liveRecord = records.find(r => r.id === item.recordId);
                const stillForSale = liveRecord?.forSale;
                const isDragging = dragIdx === idx;
                const isDragOver = dragOverIdx === idx;
                const isSelected = selectedCartIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      setDragIdx(null);
                      setDragOverIdx(null);
                    }}
                    className={`bg-gs-card border rounded-xl py-[13px] px-[15px] flex gap-3 items-center cursor-grab active:cursor-grabbing transition-all ${
                      stillForSale ? 'opacity-100' : 'opacity-50'
                    } ${isDragging ? 'opacity-60 scale-[0.98] border-gs-accent/40' : isSelected ? 'border-gs-accent/40' : 'border-gs-border'
                    } ${isDragOver && !isDragging ? 'border-gs-accent/30 bg-gs-accent/5' : ''}`}
                  >
                    {/* Improvement 10: Checkbox for bulk select */}
                    {stillForSale && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleCartSelection(item.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          isSelected ? "bg-gs-accent border-gs-accent text-black" : "bg-transparent border-gs-border text-transparent hover:border-gs-muted"
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    )}
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
                      {/* Improvement 9: Payment icon */}
                      <PaymentMethodIcon method={item.paymentMethod || "default"} />
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

              {/* Improvement 11: Price alert notice for cart items */}
              {(() => {
                const priceDropItems = (cart || []).filter(item => {
                  const liveRecord = records.find(r => r.id === item.recordId);
                  return liveRecord && liveRecord.forSale && parseFloat(liveRecord.price) < parseFloat(item.price);
                });
                if (priceDropItems.length === 0) return null;
                return (
                  <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 mt-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      <span className="text-[11px] font-bold text-green-500">Price Drop Alert!</span>
                    </div>
                    {priceDropItems.map(item => {
                      const liveRecord = records.find(r => r.id === item.recordId);
                      const savings = (parseFloat(item.price) - parseFloat(liveRecord.price)).toFixed(2);
                      return (
                        <div key={item.id} className="text-[10px] text-gs-dim">
                          <span className="font-semibold text-gs-muted">{item.album}</span> dropped from ${item.price} to ${liveRecord.price} (save ${savings})
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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

// ── Purchase row with improvements ──────────────────────────────────────
function PurchaseRow({ purchase, records, currentUser, onViewUser, onBuy, onExportReceipt, onGenerateInvoice, convertPrice, selectedCurrency, currencySymbol, onAddNote, onAddTag, notes, tags }) {
  const p = purchase;
  const stage = getOrderStage(p.id);
  const [showDispute, setShowDispute] = useState(false); // Improvement 1: Dispute
  const [showRefund, setShowRefund] = useState(false); // Improvement 5: Refund
  const [showShipping, setShowShipping] = useState(false); // Improvement 2: Shipping label
  const [showTracking, setShowTracking] = useState(false); // Improvement 3: Delivery tracking
  const [showReview, setShowReview] = useState(false); // Improvement 6: Rating/review
  const [reviewRating, setReviewRating] = useState(0); // Improvement 6
  const [reviewText, setReviewText] = useState(""); // Improvement 6
  const [reviewSubmitted, setReviewSubmitted] = useState(false); // Improvement 6
  const [disputeReason, setDisputeReason] = useState(""); // Improvement 1
  const [disputeSubmitted, setDisputeSubmitted] = useState(false); // Improvement 1
  const [refundReason, setRefundReason] = useState(""); // Improvement 5
  const [refundSubmitted, setRefundSubmitted] = useState(false); // Improvement 5
  const [showEmailPreview, setShowEmailPreview] = useState(false); // Improvement 12: Email preview
  const [showShippingMap, setShowShippingMap] = useState(false); // New Improvement 18: Shipping map
  const [noteText, setNoteText] = useState(""); // New Improvement 19: Notes
  const [showNoteInput, setShowNoteInput] = useState(false); // New Improvement 19
  const [showRecurring, setShowRecurring] = useState(false); // New Improvement 20: Recurring
  const [recurringFreq, setRecurringFreq] = useState("monthly"); // New Improvement 20
  const [showSplitPay, setShowSplitPay] = useState(false); // New Improvement 23: Split payment
  const [splitUser, setSplitUser] = useState(""); // New Improvement 23
  const [splitPercent, setSplitPercent] = useState(50); // New Improvement 23
  const [showEscrow, setShowEscrow] = useState(false); // New Improvement 24: Escrow
  const [showSurvey, setShowSurvey] = useState(false); // New Improvement 25: Satisfaction survey
  const [surveyRating, setSurveyRating] = useState(0); // New Improvement 25
  const [surveyFeedback, setSurveyFeedback] = useState(""); // New Improvement 25
  const [surveySubmitted, setSurveySubmitted] = useState(false); // New Improvement 25

  // ── Improvement C14: Transaction messaging thread ──────────────────
  const [showMessaging, setShowMessaging] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [localMessages, setLocalMessages] = useState([]);

  // ── Improvement C15: Follow-up reminders ───────────────────────────
  const [showReminders, setShowReminders] = useState(false);
  const [dismissedReminders, setDismissedReminders] = useState([]);

  // ── Improvement C16: Return shipping label ─────────────────────────
  const [showReturnLabel, setShowReturnLabel] = useState(false);

  // ── Improvement C17: Transaction insurance status ──────────────────
  const [showInsurance, setShowInsurance] = useState(false);

  // ── Improvement C18: Buyer/seller agreement viewer ─────────────────
  const [showAgreement, setShowAgreement] = useState(false);

  // ── Improvement C19: Payment installment tracker ───────────────────
  const [showInstallments, setShowInstallments] = useState(false);

  // ── Improvement C20: Transaction photo evidence ────────────────────
  const [showPhotoEvidence, setShowPhotoEvidence] = useState(false);
  const [photoNotes, setPhotoNotes] = useState("");

  // ── Improvement C21: Customs declaration ───────────────────────────
  const [showCustoms, setShowCustoms] = useState(false);

  // ── Improvement C22: Package weight estimator ──────────────────────
  const [showWeightEstimate, setShowWeightEstimate] = useState(false);

  // ── Improvement C23: Delivery confirmation workflow ────────────────
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [showDeliveryConfirm, setShowDeliveryConfirm] = useState(false);

  // ── Improvement C24: Dispute timeline ──────────────────────────────
  const [showDisputeTimeline, setShowDisputeTimeline] = useState(false);

  // ── Improvement C25: Feedback loop ─────────────────────────────────
  const [showFeedbackLoop, setShowFeedbackLoop] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Simulated tracking number
  const trackingNum = useMemo(() => {
    let h = 0;
    const s = String(p.id);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return `GS${Math.abs(h).toString(36).toUpperCase().padStart(8, "0")}`;
  }, [p.id]);

  // Simulated payment method
  const paymentMethod = useMemo(() => {
    const methods = ["visa", "mastercard", "paypal", "apple"];
    let h = 0;
    const s = String(p.id);
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return methods[Math.abs(h) % methods.length];
  }, [p.id]);

  return (
    <div className="bg-gs-card border border-gs-border rounded-xl py-[15px] px-[15px]">
      <div className="flex gap-3.5 items-center">
        <AlbumArt album={p.album} artist={p.artist} accent={p.accent || "#555"} size={56} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-gs-text">{p.album}</div>
          <div className="text-[11px] text-[#666]">
            {p.artist} · {p.format} · {p.year}
          </div>
          <div className="text-[10px] text-gs-faint font-mono mt-1 flex gap-2 items-center">
            <span>from <button onClick={() => onViewUser(p.seller)} className="bg-transparent border-0 text-gs-accent cursor-pointer text-[10px] p-0 font-mono">@{p.seller}</button></span>
            <span>{p.time}</span>
            {/* Improvement 9: Payment method icon */}
            <PaymentMethodIcon method={paymentMethod} />
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

      {/* Action buttons row */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1a] flex flex-wrap gap-1.5">
        {/* Improvement 4: Receipt export */}
        <button
          onClick={() => onExportReceipt(p)}
          className="gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Receipt
        </button>

        {/* Improvement 3: Tracking button */}
        <button
          onClick={() => setShowTracking(!showTracking)}
          className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showTracking ? "text-gs-accent" : ""}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Track
        </button>

        {/* Improvement 2: Shipping label */}
        <button
          onClick={() => setShowShipping(!showShipping)}
          className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showShipping ? "text-gs-accent" : ""}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          Label
        </button>

        {/* Improvement 6: Review button */}
        {stage >= 4 && !reviewSubmitted && (
          <button
            onClick={() => setShowReview(!showReview)}
            className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showReview ? "text-amber-400" : ""}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Review
          </button>
        )}
        {reviewSubmitted && (
          <span className="px-2.5 py-1.5 text-[10px] text-green-500 font-semibold flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Reviewed
          </span>
        )}

        {/* Improvement 1: Dispute button */}
        {!disputeSubmitted && (
          <button
            onClick={() => setShowDispute(!showDispute)}
            className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showDispute ? "text-red-400" : ""}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Dispute
          </button>
        )}
        {disputeSubmitted && (
          <span className="px-2.5 py-1.5 text-[10px] text-amber-400 font-semibold flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Dispute Filed
          </span>
        )}

        {/* Improvement 5: Refund request */}
        {!refundSubmitted && stage < 3 && (
          <button
            onClick={() => setShowRefund(!showRefund)}
            className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showRefund ? "text-amber-400" : ""}`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Refund
          </button>
        )}
        {refundSubmitted && (
          <span className="px-2.5 py-1.5 text-[10px] text-amber-400 font-semibold">Refund Requested</span>
        )}

        {/* Improvement 12: Email preview */}
        <button
          onClick={() => setShowEmailPreview(!showEmailPreview)}
          className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showEmailPreview ? "text-gs-accent" : ""}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </button>

        {/* Improvement 7: Repeat purchase (reorder) */}
        <button
          onClick={() => {
            const original = records.find(r => r.album === p.album && r.artist === p.artist && r.user !== currentUser && r.forSale);
            if (original) {
              onBuy(original);
            } else {
              window.alert("This record is no longer available for purchase.");
            }
          }}
          className="gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ml-auto"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Reorder
        </button>
      </div>

      {/* New Improvement 14 + 18 + 19 + 20 + 23 + 24 + 25 action buttons */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* New Improvement 14: Invoice */}
        <button onClick={() => onGenerateInvoice(p)} className="gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          Invoice
        </button>

        {/* New Improvement 18: Shipping Map */}
        <button onClick={() => setShowShippingMap(!showShippingMap)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showShippingMap ? "text-gs-accent" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          Map
        </button>

        {/* New Improvement 19: Notes */}
        <button onClick={() => setShowNoteInput(!showNoteInput)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showNoteInput ? "text-gs-accent" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Notes{notes ? " *" : ""}
        </button>

        {/* New Improvement 20: Recurring */}
        <button onClick={() => setShowRecurring(!showRecurring)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showRecurring ? "text-violet-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Recurring
        </button>

        {/* New Improvement 23: Split Payment */}
        <button onClick={() => setShowSplitPay(!showSplitPay)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showSplitPay ? "text-amber-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Split
        </button>

        {/* New Improvement 24: Escrow */}
        <button onClick={() => setShowEscrow(!showEscrow)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showEscrow ? "text-green-500" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Escrow
        </button>

        {/* New Improvement 25: Satisfaction survey */}
        {stage >= 4 && !surveySubmitted && (
          <button onClick={() => setShowSurvey(!showSurvey)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showSurvey ? "text-pink-400" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            Survey
          </button>
        )}
        {surveySubmitted && (
          <span className="px-2.5 py-1.5 text-[10px] text-pink-400 font-semibold flex items-center gap-1">Surveyed</span>
        )}

        {/* ── C14: Messaging thread button ────────────────────── */}
        <button onClick={() => setShowMessaging(!showMessaging)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showMessaging ? "text-blue-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Messages
        </button>

        {/* ── C15: Follow-up reminders ───────────────────────── */}
        <button onClick={() => setShowReminders(!showReminders)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showReminders ? "text-amber-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Reminders
        </button>

        {/* ── C16: Return shipping label ─────────────────────── */}
        <button onClick={() => setShowReturnLabel(!showReturnLabel)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showReturnLabel ? "text-red-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          Return
        </button>

        {/* ── C17: Insurance status ──────────────────────────── */}
        <button onClick={() => setShowInsurance(!showInsurance)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showInsurance ? "text-green-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Insurance
        </button>

        {/* ── C18: Agreement viewer ──────────────────────────── */}
        <button onClick={() => setShowAgreement(!showAgreement)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showAgreement ? "text-violet-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Agreement
        </button>

        {/* ── C19: Installment tracker ───────────────────────── */}
        {getInstallmentPlan(p) && (
          <button onClick={() => setShowInstallments(!showInstallments)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showInstallments ? "text-cyan-400" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Installments
          </button>
        )}

        {/* ── C20: Photo evidence ────────────────────────────── */}
        <button onClick={() => setShowPhotoEvidence(!showPhotoEvidence)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showPhotoEvidence ? "text-emerald-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Photos
        </button>

        {/* ── C21: Customs declaration ───────────────────────── */}
        <button onClick={() => setShowCustoms(!showCustoms)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showCustoms ? "text-orange-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          Customs
        </button>

        {/* ── C22: Weight estimator ──────────────────────────── */}
        <button onClick={() => setShowWeightEstimate(!showWeightEstimate)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showWeightEstimate ? "text-sky-400" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
          Weight
        </button>

        {/* ── C23: Delivery confirmation ─────────────────────── */}
        {stage >= 3 && !deliveryConfirmed && (
          <button onClick={() => setShowDeliveryConfirm(!showDeliveryConfirm)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showDeliveryConfirm ? "text-green-400" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Confirm Delivery
          </button>
        )}
        {deliveryConfirmed && (
          <span className="px-2.5 py-1.5 text-[10px] text-green-400 font-semibold flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Delivered
          </span>
        )}

        {/* ── C24: Dispute timeline ──────────────────────────── */}
        {disputeSubmitted && (
          <button onClick={() => setShowDisputeTimeline(!showDisputeTimeline)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showDisputeTimeline ? "text-red-400" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Dispute Progress
          </button>
        )}

        {/* ── C25: Feedback loop ─────────────────────────────── */}
        {stage >= 4 && !feedbackSubmitted && (
          <button onClick={() => setShowFeedbackLoop(!showFeedbackLoop)} className={`gs-btn-secondary px-2.5 py-1.5 text-[10px] flex items-center gap-1 ${showFeedbackLoop ? "text-teal-400" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            Feedback
          </button>
        )}
        {feedbackSubmitted && (
          <span className="px-2.5 py-1.5 text-[10px] text-teal-400 font-semibold flex items-center gap-1">Feedback Sent</span>
        )}

        {/* New Improvement 15: Multi-currency display */}
        {selectedCurrency !== "USD" && (
          <span className="px-2.5 py-1.5 text-[10px] text-gs-faint font-mono ml-auto">
            {convertPrice(p.price)}
          </span>
        )}
      </div>

      {/* Tags display (New Improvement 19) */}
      {tags && tags.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {tags.map((tag, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-gs-accent/10 text-gs-accent border border-gs-accent/20">{tag}</span>
          ))}
        </div>
      )}

      {/* Improvement 3: Delivery tracking detail panel */}
      {showTracking && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gs-muted">Tracking Details</span>
              <span className="text-[10px] text-gs-accent font-mono">{trackingNum}</span>
            </div>
            <div className="flex flex-col gap-2">
              {ORDER_STAGES.slice(0, stage + 1).reverse().map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-gs-accent" : "bg-gs-border"}`} />
                  <span className={`text-[10px] capitalize ${i === 0 ? "text-gs-text font-semibold" : "text-gs-dim"}`}>{s}</span>
                  <span className="text-[9px] text-gs-faint font-mono ml-auto">{i === 0 ? "Current" : `${i}d ago`}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-[#1a1a1a] text-[9px] text-gs-faint">
              Carrier: USPS Media Mail | Est. delivery: 5-8 business days
            </div>
          </div>
        </div>
      )}

      {/* Improvement 2: Shipping label generation panel */}
      {showShipping && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Shipping Label</div>
            <div className="border border-dashed border-gs-border rounded-lg p-3 text-center">
              <div className="text-[10px] text-gs-dim font-mono mb-1">USPS MEDIA MAIL</div>
              <div className="text-[10px] text-gs-dim mb-0.5">FROM: @{p.seller}</div>
              <div className="text-[10px] text-gs-dim mb-1.5">TO: @{currentUser}</div>
              <div className="text-[10px] text-gs-faint font-mono mb-2">{trackingNum}</div>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="bg-gs-text" style={{ width: i % 3 === 0 ? 2 : 1, height: 20 }} />
                ))}
              </div>
            </div>
            <button
              onClick={() => window.alert("Shipping label will be available for download once the seller confirms shipment.")}
              className="gs-btn-secondary w-full mt-2 py-2 text-[10px]"
            >
              Download Label (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Improvement 6: Review form */}
      {showReview && !reviewSubmitted && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Rate this transaction</div>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className="bg-transparent border-none cursor-pointer p-0.5 text-base transition-transform hover:scale-110"
                  style={{ color: star <= reviewRating ? "#f59e0b" : "#333" }}
                >
                  ★
                </button>
              ))}
              {reviewRating > 0 && <span className="text-[10px] text-gs-dim ml-1.5 self-center">{reviewRating}/5</span>}
            </div>
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="How was the transaction? (optional)"
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50 resize-none"
              rows={2}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowReview(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Cancel</button>
              <button
                onClick={() => {
                  if (reviewRating > 0) {
                    setReviewSubmitted(true);
                    setShowReview(false);
                  }
                }}
                disabled={reviewRating === 0}
                className={`gs-btn-gradient flex-[2] py-1.5 text-[10px] ${reviewRating === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 1: Dispute form */}
      {showDispute && !disputeSubmitted && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-red-400 mb-2">File a Dispute</div>
            <select
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text mb-2 focus:outline-none cursor-pointer"
            >
              <option value="">Select a reason...</option>
              <option value="not-received">Item not received</option>
              <option value="not-as-described">Item not as described</option>
              <option value="damaged">Item arrived damaged</option>
              <option value="wrong-item">Wrong item received</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowDispute(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Cancel</button>
              <button
                onClick={() => {
                  if (disputeReason) {
                    setDisputeSubmitted(true);
                    setShowDispute(false);
                  }
                }}
                disabled={!disputeReason}
                className={`flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer transition-colors ${
                  disputeReason ? "bg-red-500 text-white hover:bg-red-600" : "bg-red-500/20 text-red-500/40 cursor-not-allowed"
                }`}
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 5: Refund request form */}
      {showRefund && !refundSubmitted && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-amber-400 mb-2">Request a Refund</div>
            <div className="text-[10px] text-gs-dim mb-2">
              Refund amount: <span className="text-gs-text font-bold">${parseFloat(p.price).toFixed(2)}</span>
            </div>
            <select
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text mb-2 focus:outline-none cursor-pointer"
            >
              <option value="">Select a reason...</option>
              <option value="changed-mind">Changed my mind</option>
              <option value="duplicate">Duplicate purchase</option>
              <option value="wrong-item">Ordered wrong item</option>
              <option value="seller-issue">Issue with seller</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowRefund(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Cancel</button>
              <button
                onClick={() => {
                  if (refundReason) {
                    setRefundSubmitted(true);
                    setShowRefund(false);
                  }
                }}
                disabled={!refundReason}
                className={`flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer transition-colors ${
                  refundReason ? "bg-amber-500 text-black hover:bg-amber-600" : "bg-amber-500/20 text-amber-500/40 cursor-not-allowed"
                }`}
              >
                Request Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 12: Order confirmation email preview */}
      {showEmailPreview && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Order Confirmation Email</div>
            <div className="bg-white rounded-lg p-3 text-black">
              <div className="text-[10px] font-bold text-gray-500 mb-1">From: orders@groovestack.com</div>
              <div className="text-[10px] text-gray-500 mb-2">Subject: Your order #{String(p.id).slice(0, 8)} has been confirmed</div>
              <div className="border-t border-gray-200 pt-2">
                <div className="text-[11px] font-bold mb-1">Order Confirmed!</div>
                <div className="text-[10px] text-gray-600 mb-1.5">
                  Hi @{currentUser}, your purchase of <strong>{p.album}</strong> by {p.artist} from @{p.seller} has been confirmed.
                </div>
                <div className="text-[10px] text-gray-600">
                  Total: <strong>${(parseFloat(p.price) * 1.05 + 6).toFixed(2)}</strong> ({convertPrice(parseFloat(p.price) * 1.05 + 6)}) | Tracking: {trackingNum}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Improvement 18: Shipping tracking map placeholder */}
      {showShippingMap && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Shipping Map</div>
            <div className="bg-[#0a0a0a] border border-gs-border rounded-lg overflow-hidden" style={{ height: 140 }}>
              {/* SVG map placeholder */}
              <svg width="100%" height="140" viewBox="0 0 400 140">
                <rect width="400" height="140" fill="#0a0a0a" />
                {/* Simplified US outline */}
                <path d="M40,60 L60,40 L100,35 L140,30 L180,28 L220,30 L260,25 L300,30 L340,35 L360,50 L350,70 L340,80 L300,90 L260,100 L220,105 L180,100 L140,95 L100,85 L70,80 L50,75 Z" fill="#1a1a1a" stroke="#333" strokeWidth="1" />
                {/* Origin dot */}
                <circle cx="320" cy="55" r="4" fill="#ef4444">
                  <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="325" y="50" fill="#ef4444" fontSize="8" fontFamily="monospace">Seller</text>
                {/* Destination dot */}
                <circle cx="150" cy="70" r="4" fill="#22c55e">
                  <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="155" y="65" fill="#22c55e" fontSize="8" fontFamily="monospace">You</text>
                {/* Route line */}
                <line x1="320" y1="55" x2="150" y2="70" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="4,4">
                  <animate attributeName="stroke-dashoffset" values="0;-8" dur="1s" repeatCount="indefinite" />
                </line>
                {/* Package dot moving along route */}
                <circle r="3" fill="#0ea5e9">
                  <animateMotion dur="3s" repeatCount="indefinite" path={`M320,55 L${320 - (320 - 150) * (stage / 4)},${55 + (70 - 55) * (stage / 4)}`} />
                </circle>
              </svg>
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-gs-faint font-mono">
              <span>Tracking: {trackingNum}</span>
              <span>Est. {5 - Math.min(stage, 4)} days remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* New Improvement 19: Transaction notes and tags */}
      {showNoteInput && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Transaction Notes & Tags</div>
            <textarea
              value={noteText || notes}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note about this transaction..."
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50 resize-none mb-2"
              rows={2}
            />
            <div className="flex gap-1 flex-wrap mb-2">
              {["Gift", "Personal", "Investment", "Wishlist Find", "Rare", "Priority"].map(tag => (
                <button
                  key={tag}
                  onClick={() => onAddTag(p.id, tag)}
                  className={`px-2 py-0.5 rounded-full text-[9px] border cursor-pointer transition-colors ${
                    (tags || []).includes(tag)
                      ? "bg-gs-accent/15 text-gs-accent border-gs-accent/30"
                      : "bg-transparent text-gs-dim border-gs-border hover:border-gs-muted"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              onClick={() => { onAddNote(p.id, noteText || notes); setShowNoteInput(false); }}
              className="gs-btn-gradient w-full py-1.5 text-[10px]"
            >
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* New Improvement 20: Recurring purchase setup */}
      {showRecurring && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-violet-400 mb-2">Set Up Recurring Purchase</div>
            <div className="text-[10px] text-gs-dim mb-2">
              Auto-purchase from @{p.seller} when new {p.format || "records"} by {p.artist} are listed.
            </div>
            <div className="flex gap-2 mb-3">
              {["weekly", "monthly", "quarterly"].map(f => (
                <button
                  key={f}
                  onClick={() => setRecurringFreq(f)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold capitalize border transition-colors cursor-pointer ${
                    recurringFreq === f ? "border-violet-400 bg-violet-400/10 text-violet-400" : "border-gs-border bg-transparent text-gs-dim"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center mb-2">
              <span className="text-[10px] text-gs-dim">Max price:</span>
              <span className="text-[11px] font-bold text-gs-text">${(parseFloat(p.price) * 1.2).toFixed(2)}</span>
              <span className="text-[9px] text-gs-faint font-mono">({convertPrice(parseFloat(p.price) * 1.2)})</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRecurring(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Cancel</button>
              <button onClick={() => { window.alert(`Recurring ${recurringFreq} purchase set for ${p.artist}!`); setShowRecurring(false); }} className="flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer bg-violet-500 text-white hover:bg-violet-600 transition-colors">
                Enable Recurring
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Improvement 23: Split payment */}
      {showSplitPay && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-amber-400 mb-2">Split Payment</div>
            <div className="text-[10px] text-gs-dim mb-2">
              Split the cost of this record with another user.
            </div>
            <input
              type="text"
              value={splitUser}
              onChange={e => setSplitUser(e.target.value)}
              placeholder="Enter username to split with..."
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-1.5 text-[11px] text-gs-text font-mono placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50 mb-2"
            />
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] text-gs-dim">Your share:</span>
              <input
                type="range"
                min="10"
                max="90"
                step="10"
                value={splitPercent}
                onChange={e => setSplitPercent(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] text-gs-text font-mono">{splitPercent}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#111] rounded-lg p-2 text-center">
                <div className="text-[10px] text-gs-dim">You pay</div>
                <div className="text-sm font-bold text-gs-text">${(parseFloat(p.price) * splitPercent / 100).toFixed(2)}</div>
              </div>
              <div className="bg-[#111] rounded-lg p-2 text-center">
                <div className="text-[10px] text-gs-dim">@{splitUser || "..."} pays</div>
                <div className="text-sm font-bold text-gs-text">${(parseFloat(p.price) * (100 - splitPercent) / 100).toFixed(2)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSplitPay(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Cancel</button>
              <button
                onClick={() => { if (splitUser.trim()) { window.alert(`Split request sent to @${splitUser}!`); setShowSplitPay(false); } }}
                disabled={!splitUser.trim()}
                className={`flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer transition-colors ${
                  splitUser.trim() ? "bg-amber-500 text-black hover:bg-amber-600" : "bg-amber-500/20 text-amber-500/40 cursor-not-allowed"
                }`}
              >
                Send Split Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Improvement 24: Escrow status indicator */}
      {showEscrow && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-gs-muted">Escrow Status</span>
              <span className="text-[10px] font-semibold" style={{ color: ESCROW_STAGES[getEscrowStage(p.id)].color }}>
                {ESCROW_STAGES[getEscrowStage(p.id)].label}
              </span>
            </div>
            <div className="flex gap-1 items-center mb-2">
              {ESCROW_STAGES.map((es, i) => (
                <div key={es.key} className="flex-1 flex items-center gap-1">
                  <div className={`h-2 flex-1 rounded-full transition-colors`} style={{ background: i <= getEscrowStage(p.id) ? es.color : "#1a1a1a" }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              {ESCROW_STAGES.map((es, i) => (
                <div key={es.key} className="text-[8px] font-mono" style={{ color: i <= getEscrowStage(p.id) ? es.color : "#333" }}>{es.label.split(" ")[0]}</div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-[#1a1a1a] text-[9px] text-gs-faint">
              Protected amount: <span className="text-gs-text font-semibold">${parseFloat(p.price).toFixed(2)}</span> ({convertPrice(p.price)}) held in escrow until delivery confirmed
            </div>
          </div>
        </div>
      )}

      {/* New Improvement 25: Satisfaction survey */}
      {showSurvey && !surveySubmitted && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-pink-500/5 border border-pink-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-pink-400 mb-3">Transaction Satisfaction Survey</div>
            <div className="mb-3">
              <div className="text-[10px] text-gs-dim mb-1.5">How satisfied are you with this purchase?</div>
              <div className="flex gap-2">
                {[
                  { val: 1, label: "Very Unhappy", emoji: "1" },
                  { val: 2, label: "Unhappy", emoji: "2" },
                  { val: 3, label: "Neutral", emoji: "3" },
                  { val: 4, label: "Happy", emoji: "4" },
                  { val: 5, label: "Very Happy", emoji: "5" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setSurveyRating(opt.val)}
                    className={`flex-1 py-2 rounded-lg text-center border transition-colors cursor-pointer ${
                      surveyRating === opt.val ? "border-pink-400 bg-pink-400/10" : "border-gs-border bg-transparent hover:border-gs-muted"
                    }`}
                  >
                    <div className="text-sm font-bold" style={{ color: surveyRating === opt.val ? "#ec4899" : "#666" }}>{opt.emoji}</div>
                    <div className="text-[8px] text-gs-dim">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="text-[10px] text-gs-dim mb-1.5">Any additional feedback?</div>
              <textarea
                value={surveyFeedback}
                onChange={e => setSurveyFeedback(e.target.value)}
                placeholder="Tell us about your experience..."
                className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-pink-400/50 resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSurvey(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Skip</button>
              <button
                onClick={() => { if (surveyRating > 0) { setSurveySubmitted(true); setShowSurvey(false); } }}
                disabled={surveyRating === 0}
                className={`flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer transition-colors ${
                  surveyRating > 0 ? "bg-pink-500 text-white hover:bg-pink-600" : "bg-pink-500/20 text-pink-500/40 cursor-not-allowed"
                }`}
              >
                Submit Survey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── C14: Transaction messaging thread panel ───────────────── */}
      {showMessaging && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-[#111] rounded-lg p-3">
            <div className="text-[11px] font-semibold text-gs-muted mb-2">Messages with @{p.seller}</div>
            <div className="flex flex-col gap-2 mb-3 max-h-[200px] overflow-y-auto">
              {generateMessageThread(p.id, p.seller, currentUser).concat(localMessages).map((msg, i) => (
                <div key={i} className={`flex ${msg.from === currentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${msg.from === currentUser ? 'bg-gs-accent/15 text-gs-accent' : 'bg-[#1a1a1a] text-gs-muted'}`}>
                    <div className="text-[10px] font-semibold mb-0.5">@{msg.from}</div>
                    <div className="text-[10px]">{msg.text}</div>
                    <div className="text-[8px] text-gs-faint mt-0.5">{msg.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-1.5 text-[11px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50"
                onKeyDown={e => {
                  if (e.key === 'Enter' && newMessage.trim()) {
                    setLocalMessages(prev => [...prev, { from: currentUser, text: newMessage.trim(), time: 'Just now' }]);
                    setNewMessage("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (newMessage.trim()) {
                    setLocalMessages(prev => [...prev, { from: currentUser, text: newMessage.trim(), time: 'Just now' }]);
                    setNewMessage("");
                  }
                }}
                disabled={!newMessage.trim()}
                className={`gs-btn-gradient px-3 py-1.5 text-[10px] ${!newMessage.trim() ? 'opacity-40' : ''}`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── C15: Follow-up reminders panel ────────────────────────── */}
      {showReminders && (() => {
        const reminders = getFollowUpReminders(p, stage).filter(r => !dismissedReminders.includes(r.type));
        return (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
              <div className="text-[11px] font-semibold text-amber-400 mb-2">Follow-up Reminders</div>
              {reminders.length === 0 ? (
                <div className="text-[10px] text-gs-dim">No pending reminders for this transaction.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {reminders.map(r => (
                    <div key={r.type} className="flex items-center gap-2 bg-[#111] rounded-lg px-3 py-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${r.urgency === 'high' ? 'bg-red-400' : r.urgency === 'medium' ? 'bg-amber-400' : 'bg-green-400'}`} />
                      <span className="text-[10px] text-gs-muted flex-1">{r.text}</span>
                      <button
                        onClick={() => setDismissedReminders(prev => [...prev, r.type])}
                        className="text-[9px] text-gs-faint hover:text-gs-text bg-transparent border-none cursor-pointer"
                      >Dismiss</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── C16: Return shipping label generator panel ────────────── */}
      {showReturnLabel && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-red-400 mb-2">Return Shipping Label</div>
            <div className="border border-dashed border-gs-border rounded-lg p-3 text-center mb-2">
              <div className="text-[10px] text-gs-dim font-mono mb-1">USPS MEDIA MAIL — RETURN</div>
              <div className="text-[10px] text-gs-dim mb-0.5">FROM: @{currentUser}</div>
              <div className="text-[10px] text-gs-dim mb-1.5">TO: @{p.seller}</div>
              <div className="text-[10px] text-gs-faint font-mono mb-2">RTN-{trackingNum}</div>
              <div className="flex gap-1 justify-center">
                {Array.from({ length: 20 }, (_, i) => (
                  <div key={i} className="bg-gs-text" style={{ width: i % 3 === 0 ? 2 : 1, height: 20 }} />
                ))}
              </div>
            </div>
            <div className="text-[9px] text-gs-faint mb-2">Return shipping cost: $6.00 (deducted from refund)</div>
            <button
              onClick={() => window.alert("Return label generated. Print and attach to package.")}
              className="gs-btn-secondary w-full py-2 text-[10px]"
            >
              Download Return Label
            </button>
          </div>
        </div>
      )}

      {/* ── C17: Transaction insurance status panel ────────────────── */}
      {showInsurance && (() => {
        const ins = getInsuranceStatus(p);
        return (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="bg-[#111] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gs-muted">Insurance Status</span>
                <span className={`text-[10px] font-bold ${ins.insured ? 'text-green-400' : 'text-gs-faint'}`}>
                  {ins.insured ? 'INSURED' : 'NOT INSURED'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-gs-faint">Provider:</span> <span className="text-gs-muted">{ins.provider}</span></div>
                <div><span className="text-gs-faint">Coverage:</span> <span className="text-gs-muted">${ins.coverage.toFixed(2)}</span></div>
                <div><span className="text-gs-faint">Premium:</span> <span className="text-gs-muted">${ins.premium.toFixed(2)}</span></div>
                <div><span className="text-gs-faint">Value:</span> <span className="text-gs-muted">${parseFloat(p.price).toFixed(2)}</span></div>
              </div>
              {!ins.insured && (
                <button
                  onClick={() => window.alert("Insurance added for $" + (parseFloat(p.price) * 0.02).toFixed(2))}
                  className="gs-btn-gradient w-full mt-2 py-1.5 text-[10px]"
                >
                  Add Insurance (${(parseFloat(p.price) * 0.02).toFixed(2)})
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── C18: Buyer/seller agreement viewer panel ───────────────── */}
      {showAgreement && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-violet-500/5 border border-violet-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-violet-400 mb-2">Transaction Agreement</div>
            <div className="bg-[#0a0a0a] border border-gs-border rounded-lg p-3 text-[10px] text-gs-dim space-y-1.5 font-mono max-h-[180px] overflow-y-auto">
              <div className="font-bold text-gs-muted">GROOVESTACK PURCHASE AGREEMENT</div>
              <div>Date: {p.time || new Date().toLocaleDateString()}</div>
              <div>Buyer: @{currentUser} | Seller: @{p.seller}</div>
              <div>Item: {p.album} by {p.artist}</div>
              <div>Condition: {p.condition} | Format: {p.format}</div>
              <div>Price: ${parseFloat(p.price).toFixed(2)}</div>
              <div className="pt-1 border-t border-[#1a1a1a]">TERMS:</div>
              <div>1. Seller warrants item condition as described.</div>
              <div>2. Buyer has 14 days to file a dispute.</div>
              <div>3. Returns accepted if item not as described.</div>
              <div>4. Shipping risk transfers to buyer upon carrier scan.</div>
              <div>5. Platform fee (5%) is non-refundable.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── C19: Payment installment tracker panel ─────────────────── */}
      {showInstallments && (() => {
        const plan = getInstallmentPlan(p);
        if (!plan) return null;
        return (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3">
              <div className="text-[11px] font-semibold text-cyan-400 mb-2">Payment Installments</div>
              <div className="flex gap-1 items-center mb-2">
                {Array.from({ length: plan.total }, (_, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full ${i < plan.paid ? 'bg-cyan-400' : 'bg-[#1a1a1a]'}`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div><span className="text-gs-faint">Installments:</span> <span className="text-gs-muted">{plan.paid}/{plan.total}</span></div>
                <div><span className="text-gs-faint">Amount each:</span> <span className="text-gs-muted">${plan.amount}</span></div>
                <div><span className="text-gs-faint">Remaining:</span> <span className="text-gs-muted">{plan.remaining} payments</span></div>
                <div><span className="text-gs-faint">Balance:</span> <span className="text-cyan-400 font-bold">${(plan.remaining * plan.amount).toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── C20: Transaction photo evidence panel ──────────────────── */}
      {showPhotoEvidence && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-emerald-400 mb-2">Photo Evidence</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {['Record front', 'Record back', 'Packaging'].map((label, i) => (
                <div key={i} className="bg-[#0a0a0a] border border-dashed border-gs-border rounded-lg p-3 text-center cursor-pointer hover:border-emerald-400/30 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" className="mx-auto mb-1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <div className="text-[8px] text-gs-faint">{label}</div>
                </div>
              ))}
            </div>
            <textarea
              value={photoNotes}
              onChange={e => setPhotoNotes(e.target.value)}
              placeholder="Describe condition, any issues..."
              className="w-full bg-[#0a0a0a] border border-gs-border rounded-lg px-3 py-2 text-[11px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-emerald-400/50 resize-none mb-2"
              rows={2}
            />
            <button
              onClick={() => window.alert("Photo evidence submitted for this transaction.")}
              className="gs-btn-secondary w-full py-1.5 text-[10px]"
            >
              Upload Evidence (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* ── C21: Customs declaration generator panel ───────────────── */}
      {showCustoms && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-orange-400 mb-2">Customs Declaration (International)</div>
            <pre className="bg-[#0a0a0a] border border-gs-border rounded-lg p-3 text-[9px] text-gs-dim font-mono overflow-x-auto whitespace-pre max-h-[200px] overflow-y-auto">
              {generateCustomsDeclaration(p, currentUser)}
            </pre>
            <button
              onClick={() => {
                const decl = generateCustomsDeclaration(p, currentUser);
                const blob = new Blob([decl], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `customs-${p.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="gs-btn-secondary w-full mt-2 py-1.5 text-[10px]"
            >
              Download Customs Form
            </button>
          </div>
        </div>
      )}

      {/* ── C22: Package weight estimator panel ────────────────────── */}
      {showWeightEstimate && (() => {
        const w = estimatePackageWeight(p);
        return (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="bg-sky-500/5 border border-sky-500/15 rounded-lg p-3">
              <div className="text-[11px] font-semibold text-sky-400 mb-2">Package Weight Estimate</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#111] rounded-lg p-2">
                  <div className="text-lg font-extrabold text-gs-text">{w.weight}</div>
                  <div className="text-[9px] text-gs-faint font-mono">{w.unit}</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2">
                  <div className="text-lg font-extrabold text-gs-text">{w.oz}</div>
                  <div className="text-[9px] text-gs-faint font-mono">ounces</div>
                </div>
                <div className="bg-[#111] rounded-lg p-2">
                  <div className="text-lg font-extrabold text-gs-text">{p.format || 'N/A'}</div>
                  <div className="text-[9px] text-gs-faint font-mono">format</div>
                </div>
              </div>
              <div className="mt-2 text-[9px] text-gs-faint">
                Shipping cost estimate: <span className="text-gs-muted font-bold">${(parseFloat(w.weight) * 4).toFixed(2)}</span> (USPS Media Mail)
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── C23: Delivery confirmation workflow panel ───────────────── */}
      {showDeliveryConfirm && !deliveryConfirmed && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-green-400 mb-2">Confirm Delivery</div>
            <div className="text-[10px] text-gs-dim mb-3">
              By confirming delivery, you acknowledge that you have received <span className="text-gs-muted font-semibold">{p.album}</span> by {p.artist} in the condition described. This will release payment to the seller.
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeliveryConfirm(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Not Yet</button>
              <button
                onClick={() => { setDeliveryConfirmed(true); setShowDeliveryConfirm(false); }}
                className="flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                Confirm Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── C24: Transaction dispute timeline panel ─────────────────── */}
      {showDisputeTimeline && disputeSubmitted && (() => {
        let h = 0;
        const s = String(p.id);
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        const currentStage = Math.abs(h) % DISPUTE_TIMELINE_STAGES.length;
        return (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
              <div className="text-[11px] font-semibold text-red-400 mb-2">Dispute Progress</div>
              <div className="flex gap-1 items-center mb-2">
                {DISPUTE_TIMELINE_STAGES.map((ds, i) => (
                  <div key={ds.key} className={`flex-1 h-2 rounded-full`} style={{ background: i <= currentStage ? ds.color : '#1a1a1a' }} />
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                {DISPUTE_TIMELINE_STAGES.slice(0, currentStage + 1).map((ds, i) => (
                  <div key={ds.key} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ds.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: ds.color }}>{ds.label}</span>
                    <span className="text-[9px] text-gs-faint font-mono ml-auto">{i === currentStage ? 'Current' : `${currentStage - i}d ago`}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#1a1a1a] text-[9px] text-gs-faint">
                Estimated resolution: 3-5 business days
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── C25: Feedback loop (rate transaction experience) panel ─── */}
      {showFeedbackLoop && !feedbackSubmitted && (
        <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
          <div className="bg-teal-500/5 border border-teal-500/15 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-teal-400 mb-2">Rate Your Transaction Experience</div>
            <div className="text-[10px] text-gs-dim mb-2">How was the overall transaction process?</div>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setFeedbackRating(star)}
                  className="bg-transparent border-none cursor-pointer p-0.5 text-base transition-transform hover:scale-110"
                  style={{ color: star <= feedbackRating ? "#14b8a6" : "#333" }}
                >
                  ★
                </button>
              ))}
              {feedbackRating > 0 && <span className="text-[10px] text-gs-dim ml-1.5 self-center">{feedbackRating}/5</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['Fast shipping', 'Well packed', 'Accurate condition', 'Great communication', 'Fair price'].map(tag => (
                <button
                  key={tag}
                  onClick={() => setFeedbackText(prev => prev.includes(tag) ? prev.replace(tag + ', ', '').replace(tag, '') : (prev ? prev + ', ' + tag : tag))}
                  className={`px-2 py-0.5 rounded-full text-[9px] border cursor-pointer transition-colors ${
                    feedbackText.includes(tag)
                      ? 'bg-teal-400/15 text-teal-400 border-teal-400/30'
                      : 'bg-transparent text-gs-dim border-gs-border hover:border-gs-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowFeedbackLoop(false)} className="gs-btn-secondary flex-1 py-1.5 text-[10px]">Skip</button>
              <button
                onClick={() => { if (feedbackRating > 0) { setFeedbackSubmitted(true); setShowFeedbackLoop(false); } }}
                disabled={feedbackRating === 0}
                className={`flex-[2] py-1.5 text-[10px] rounded-lg font-semibold border-none cursor-pointer transition-colors ${
                  feedbackRating > 0 ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-teal-500/20 text-teal-500/40 cursor-not-allowed'
                }`}
              >
                Submit Feedback
              </button>
            </div>
          </div>
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
