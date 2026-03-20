// Login / Signup screen — shown as modal overlay when guests try restricted actions.
// Matches GrooveStack's dark theme with Tailwind classes.
import { useState, useMemo } from 'react';
import { signUp, signIn, checkUsername } from '../utils/supabase';
import { USER_PROFILES } from '../constants';
import FormInput from './ui/FormInput';

/* ── Password strength helper ──────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { level: 2, label: 'Medium', color: 'bg-amber-500' };
  return { level: 3, label: 'Strong', color: 'bg-emerald-500' };
}

/* ── Classify auth errors for better UX feedback ───────────── */
function classifyError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'Incorrect email or password. Please double-check and try again.';
  if (m.includes('user not found') || m.includes('no user'))
    return 'No account found with that email. Need to sign up?';
  if (m.includes('email already') || m.includes('already registered'))
    return 'An account with that email already exists. Try logging in instead.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Network error. Check your connection and try again.';
  return msg || 'An unexpected error occurred.';
}

/* ── Eye icon (show/hide password) ─────────────────────────── */
function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Loading spinner ───────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block mr-1.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const toggleMode = () => {
    setMode(m => m === "login" ? "signup" : "login");
    setError("");
    setAnimKey(k => k + 1);
  };

  const validateUsername = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsername(clean);
    return clean;
  };

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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
      setError(classifyError(err.message));
    }
    setLoading(false);
  };

  /* Password field suffix — toggle visibility */
  const passwordToggle = (field) => {
    const isShow = field === 'confirm' ? showConfirm : showPassword;
    const toggle = field === 'confirm' ? setShowConfirm : setShowPassword;
    return (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => toggle(v => !v)}
        className="bg-transparent border-none cursor-pointer text-gs-dim hover:text-gs-muted transition-colors p-0 flex items-center pointer-events-auto"
        aria-label={isShow ? "Hide password" : "Show password"}
      >
        <EyeIcon open={isShow} />
      </button>
    );
  };

  return (
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
        {/* ── Animated header / branding ──────────────────────── */}
        <div className="pt-8 px-8 pb-2 text-center">
          <div className="inline-flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gs-accent/15 to-gs-indigo/15 border border-gs-accent/20 flex items-center justify-center">
              <div className="animate-spin-slow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                </svg>
              </div>
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

        {/* ── Form with smooth mode transitions ──────────────── */}
        <form onSubmit={handleSubmit} className="px-8 pb-6 pt-4">
          <div key={animKey} className="animate-mode-switch">
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-[10px] px-3.5 py-2.5 text-red-400 text-xs mb-4 leading-relaxed flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <FormInput label="EMAIL" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />

            {mode === "signup" && (
              <>
                <FormInput label="USERNAME" value={username} onChange={validateUsername} placeholder="your.handle" />
                <FormInput label="DISPLAY NAME" value={displayName} onChange={setDisplayName} placeholder="Your Name" />
              </>
            )}

            <FormInput
              label="PASSWORD"
              value={password}
              onChange={setPassword}
              placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
              type={showPassword ? "text" : "password"}
              suffix={passwordToggle('main')}
            />

            {/* Password strength indicator (signup only) */}
            {mode === "signup" && password && (
              <div className="-mt-2.5 mb-4">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : 'bg-[#222]'}`}
                    />
                  ))}
                </div>
                <span className={`text-[10px] font-medium ${strength.level === 1 ? 'text-red-400' : strength.level === 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {strength.label}
                </span>
              </div>
            )}

            {mode === "signup" && (
              <FormInput
                label="CONFIRM PASSWORD"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter password"
                type={showConfirm ? "text" : "password"}
                suffix={passwordToggle('confirm')}
              />
            )}

            {/* Remember me + forgot password (login only) */}
            {mode === "login" && (
              <div className="flex items-center justify-between mb-4 -mt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gs-border bg-gs-card accent-gs-accent cursor-pointer"
                  />
                  <span className="text-[12px] text-gs-dim group-hover:text-gs-muted transition-colors">Remember me</span>
                </label>
                <button
                  type="button"
                  className="bg-transparent border-none text-gs-accent text-[12px] font-medium cursor-pointer font-sans hover:underline p-0"
                  onClick={() => alert('Password reset coming soon!')}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* Submit button with spinner */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans flex items-center justify-center ${loading ? 'bg-[#1a1a1a] text-gs-dim opacity-60 cursor-not-allowed' : 'gs-btn-gradient text-white'}`}
          >
            {loading && <Spinner />}
            {loading
              ? (mode === "login" ? "Logging in..." : "Creating account...")
              : (mode === "login" ? "Log In" : "Create Account")
            }
          </button>

          {/* ── Social login placeholders ─────────────────────── */}
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gs-border" />
              <span className="text-[11px] text-gs-faint font-medium">or continue with</span>
              <div className="flex-1 h-px bg-gs-border" />
            </div>
            <div className="flex gap-2.5">
              {/* Google */}
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-dim text-[12px] font-semibold cursor-not-allowed opacity-50 relative group"
                title="Coming Soon"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#222] text-gs-muted text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Coming Soon
                </span>
              </button>
              {/* Apple */}
              <button
                type="button"
                disabled
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-dim text-[12px] font-semibold cursor-not-allowed opacity-50 relative group"
                title="Coming Soon"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#222] text-gs-muted text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Coming Soon
                </span>
              </button>
            </div>
          </div>

          {/* Toggle login/signup */}
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

          {/* ── Terms / Privacy (signup) ──────────────────────── */}
          {mode === "signup" && (
            <p className="text-center text-[11px] text-gs-faint mt-3 leading-relaxed">
              By creating an account you agree to our{' '}
              <button type="button" onClick={() => alert('Terms of Service coming soon.')} className="bg-transparent border-none text-gs-dim underline cursor-pointer font-sans text-[11px] p-0">
                Terms of Service
              </button>{' '}
              and{' '}
              <button type="button" onClick={() => alert('Privacy Policy coming soon.')} className="bg-transparent border-none text-gs-dim underline cursor-pointer font-sans text-[11px] p-0">
                Privacy Policy
              </button>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
