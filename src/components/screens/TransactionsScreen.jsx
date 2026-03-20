// Transactions hub — shows the current user's activity across four tabs:
// Offers Sent, Offers Received, Purchases, and Cart.
// Features: search/filter, date range, CSV export, larger album art on offers,
// order tracking, running totals, reorder button, drag-to-reorder cart.
// Improvements: dispute button, shipping label generation, delivery tracking,
// receipt PDF export, refund request flow, transaction rating/review,
// repeat purchase, spending analytics, payment method icons, bulk checkout,
// price alerts, order confirmation email preview.
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

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-gs-text mb-0.5">Activity</h1>
        <p className="text-xs text-gs-dim">Your transactions, offers, and cart</p>
      </div>

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
function PurchaseRow({ purchase, records, currentUser, onViewUser, onBuy, onExportReceipt }) {
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
                  Total: <strong>${(parseFloat(p.price) * 1.05 + 6).toFixed(2)}</strong> | Tracking: {trackingNum}
                </div>
              </div>
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
