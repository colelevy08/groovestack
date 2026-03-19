// Login / Signup screen — shown when there's no active session.
// Matches GrooveStack's dark theme: #080808 bg, #0d0d0d card, DM Sans, gradient accents.
import { useState } from 'react';
import { signUp, signIn, checkUsername } from '../utils/supabase';
import { USER_PROFILES } from '../constants';
import FormInput from './ui/FormInput';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode(m => m === "login" ? "signup" : "login");
    setError("");
  };

  const validateUsername = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsername(clean);
    return clean;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!username.trim()) { setError("Username is required."); setLoading(false); return; }
        if (!displayName.trim()) { setError("Display name is required."); setLoading(false); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setLoading(false); return; }

        // Check against static profiles
        if (USER_PROFILES[username]) {
          setError(`@${username} is already taken.`);
          setLoading(false);
          return;
        }

        // Check against database
        const available = await checkUsername(username);
        if (!available) {
          setError(`@${username} is already taken.`);
          setLoading(false);
          return;
        }

        const { user } = await signUp({ email, password, username, displayName });
        onAuth(user);
      } else {
        const { user } = await signIn({ email, password });
        onAuth(user);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
      <div style={{ width: 420, maxWidth: "100%", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 18, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
        {/* Logo header */}
        <div style={{ padding: "32px 32px 8px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#0ea5e922,#6366f122)", border: "1px solid #0ea5e933", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em" }}>
              <span style={{ color: "#f5f5f5" }}>groove</span>
              <span style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>stack</span>
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "16px 32px 32px" }}>
          {error && (
            <div style={{ background: "#ef444418", border: "1px solid #ef444444", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          <FormInput label="EMAIL" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

          {mode === "signup" && (
            <>
              <FormInput label="USERNAME" value={username} onChange={validateUsername} placeholder="your.handle" />
              <FormInput label="DISPLAY NAME" value={displayName} onChange={setDisplayName} placeholder="Your Name" />
            </>
          )}

          <FormInput label="PASSWORD" value={password} onChange={setPassword} placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"} type="password" />

          {mode === "signup" && (
            <FormInput label="CONFIRM PASSWORD" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" type="password" />
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: 13, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#1a1a1a" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
              color: loading ? "#555" : "#fff",
              marginTop: 8, transition: "all 0.2s",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {loading
              ? (mode === "login" ? "Logging in..." : "Creating account...")
              : (mode === "login" ? "Log In" : "Create Account")
            }
          </button>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <span style={{ fontSize: 13, color: "#555" }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={toggleMode}
              style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
