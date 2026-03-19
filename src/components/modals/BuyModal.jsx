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
      <div style={{ display: "flex", gap: 14, alignItems: "center", background: "#111", borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <AlbumArt album={record.album} artist={record.artist} accent={record.accent} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f5" }}>{record.album}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            {record.artist} · <Badge label={record.condition} color={condColor(record.condition)} />
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f5f5f5" }}>${record.price}</div>
      </div>

      {step === 1 && (
        <>
          {err && <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12, marginBottom: 14 }}>{err}</div>}
          <FormInput label="FULL NAME" value={name} onChange={setName} placeholder="Jane Smith" />
          <FormInput label="STREET ADDRESS" value={address} onChange={setAddress} placeholder="123 Vinyl Lane" />
          <FormInput label="CITY, STATE, ZIP" value={city} onChange={setCity} placeholder="Chicago, IL 60601" />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { reset(); onClose(); }} style={{ flex: 1, padding: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            {onAddToCart && <button onClick={() => { onAddToCart(record); reset(); onClose(); }} style={{ flex: 1, padding: 11, background: "#1a1a1a", border: "1px solid #f59e0b44", borderRadius: 10, color: "#f59e0b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Cart</button>}
            <button onClick={() => { if (!name || !address || !city) { setErr("All fields required."); return; } setErr(""); setStep(2); }} style={{ flex: 2, padding: 11, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Continue →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ background: "#111", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#888", marginBottom: 16 }}>
            Shipping to: <span style={{ color: "#f5f5f5" }}>{name}, {city}</span>
          </div>
          {err && <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, padding: "8px 12px", color: "#f87171", fontSize: 12, marginBottom: 14 }}>{err}</div>}
          <FormInput label="CARD NUMBER" value={card} onChange={v => setCard(v.replace(/\D/g, "").slice(0, 16))} placeholder="4242 4242 4242 4242" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <FormInput label="EXPIRY" value={expiry} onChange={v => { let c = v.replace(/\D/g, "").slice(0, 4); if (c.length >= 2) c = c.slice(0, 2) + "/" + c.slice(2); setExpiry(c); }} placeholder="MM/YY" />
            <FormInput label="CVV" value={cvv} onChange={v => setCvv(v.replace(/\D/g, "").slice(0, 3))} placeholder="123" />
          </div>
          <div style={{ background: "#111", borderRadius: 10, padding: 14, marginBottom: 20 }}>
            {[["Record", `$${record.price}`], ["Shipping", "$6.00"], ["Total", `$${(parseFloat(record.price) + 6).toFixed(2)}`]].map(([k, v], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: i === 2 ? 15 : 13, fontWeight: i === 2 ? 700 : 400, color: i === 2 ? "#f5f5f5" : "#888", borderTop: i === 2 ? "1px solid #222" : undefined, paddingTop: i === 2 ? 10 : undefined, marginTop: i === 2 ? 10 : 0, marginBottom: i < 2 ? 6 : 0 }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Back</button>
            <button onClick={() => { if (!card || card.length < 12 || !expiry || !cvv) { setErr("Fill in all payment details."); return; } onPurchase(record.id); setStep(3); }} style={{ flex: 2, padding: 11, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Confirm Purchase</button>
          </div>
        </>
      )}

      {step === 3 && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f5f5f5", marginBottom: 8 }}>Order Confirmed!</div>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, marginBottom: 24 }}>
            <strong style={{ color: "#f5f5f5" }}>{record.album}</strong> is on its way to {city}.
          </p>
          <button onClick={() => { reset(); onClose(); }} style={{ padding: "11px 28px", background: "#0ea5e9", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Done</button>
        </div>
      )}
    </Modal>
  );
}
