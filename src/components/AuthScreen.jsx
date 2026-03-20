// Login / Signup screen — shown as modal overlay when guests try restricted actions.
// Matches GrooveStack's dark theme with Tailwind classes.
import { useState } from 'react';
import { signUp, signIn, checkUsername } from '../utils/supabase';
import { USER_PROFILES } from '../constants';
import FormInput from './ui/FormInput';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleMode = () => { setMode(m => m === "login" ? "signup" : "login"); setError(""); };
  const validateUsername = (val) => { const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, ""); setUsername(clean); return clean; };

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
        if (USER_PROFILES[username]) { setError(`@${username} is already taken.`); setLoading(false); return; }
        const available = await checkUsername(username);
        if (!available) { setError(`@${username} is already taken.`); setLoading(false); return; }
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
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="pt-8 px-8 pb-2 text-center">
          <div className="inline-flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-gs-accent/15 to-gs-indigo/15 border border-gs-accent/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-[22px] font-extrabold tracking-tight">
              <span className="text-gs-text">groove</span>
              <span className="gs-gradient-text">stack</span>
            </span>
          </div>
          <p className="text-[13px] text-gs-dim mt-2">
            {mode === "login" ? "Welcome back" : "Join the vinyl community"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-[10px] px-3.5 py-2.5 text-red-400 text-xs mb-4 leading-relaxed">
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
            className={`w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans ${loading ? 'bg-[#1a1a1a] text-gs-dim opacity-60 cursor-not-allowed' : 'gs-btn-gradient text-white'}`}
          >
            {loading
              ? (mode === "login" ? "Logging in..." : "Creating account...")
              : (mode === "login" ? "Log In" : "Create Account")
            }
          </button>

          <div className="text-center mt-5">
            <span className="text-[13px] text-gs-dim">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              type="button"
              onClick={toggleMode}
              className="bg-transparent border-none text-gs-accent text-[13px] font-semibold cursor-pointer font-sans hover:underline"
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
