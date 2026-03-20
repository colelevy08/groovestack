// Login / Signup screen — shown as modal overlay when guests try restricted actions.
// Matches GrooveStack's dark theme with Tailwind classes.
import { useState, useMemo, useEffect, useCallback } from 'react';
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

/* ── Password requirements checker ─────────────────────────── */
function getPasswordChecks(pw) {
  return [
    { label: 'At least 6 characters', met: pw.length >= 6 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'Number', met: /\d/.test(pw) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(pw) },
  ];
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

/* ── Mail icon for email field ─────────────────────────────── */
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/* ── Lock icon for password field ──────────────────────────── */
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ── Checkmark animation for signup success ────────────────── */
function SuccessCheckmark() {
  return (
    <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mb-4 animate-bounce-once">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <p className="text-emerald-400 text-sm font-semibold">Account created!</p>
    </div>
  );
}

/* ── Email validation helper ───────────────────────────────── */
function validateEmail(email) {
  if (!email) return '';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address.';
  return '';
}

/* ── Rate limit tracker ────────────────────────────────────── */
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export default function AuthScreen({ onAuth, onGuest }) {
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

  /* Improvement: Email inline validation */
  const [emailTouched, setEmailTouched] = useState(false);
  const emailError = emailTouched ? validateEmail(email) : '';

  /* Improvement: Caps lock warning */
  const [capsLockOn, setCapsLockOn] = useState(false);
  const handleKeyEvent = useCallback((e) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  }, []);

  /* Improvement: Signup success animation + countdown */
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [pendingUser, setPendingUser] = useState(null);

  /* Improvement: Terms of service checkbox */
  const [tosAccepted, setTosAccepted] = useState(false);

  /* Improvement: Forgot password flow */
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  /* Improvement: Rate limiting display */
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  /* Improvement: Welcome back message */
  const [lastEmail] = useState(() => {
    try { return localStorage.getItem('gs_last_email') || ''; } catch { return ''; }
  });

  /* Countdown timer for signup success redirect */
  useEffect(() => {
    if (!signupSuccess || !pendingUser) return;
    if (countdown <= 0) {
      onAuth(pendingUser);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [signupSuccess, countdown, pendingUser, onAuth]);

  /* Lockout countdown timer */
  useEffect(() => {
    if (lockoutEnd <= 0) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        setLockoutEnd(0);
        setAttempts(0);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  const toggleMode = () => {
    setMode(m => m === "login" ? "signup" : "login");
    setError("");
    setAnimKey(k => k + 1);
    setForgotMode(false);
    setForgotSent(false);
    setEmailTouched(false);
    setTosAccepted(false);
  };

  const validateUsername = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsername(clean);
    return clean;
  };

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);

  const handleForgotPassword = () => {
    setForgotMode(true);
    setForgotSent(false);
    setError("");
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!email || validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setForgotSent(true);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    /* Rate limiting check */
    if (lockoutEnd > 0 && Date.now() < lockoutEnd) {
      setError(`Too many attempts. Please wait ${lockoutRemaining}s.`);
      return;
    }

    /* Email validation */
    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailTouched(true);
      setError(emailErr);
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        if (!username.trim()) { setError("Username is required."); setLoading(false); return; }
        if (!displayName.trim()) { setError("Display name is required."); setLoading(false); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setLoading(false); return; }
        if (!tosAccepted) { setError("You must accept the Terms of Service."); setLoading(false); return; }
        if (USER_PROFILES[username]) { setError(`@${username} is already taken.`); setLoading(false); return; }
        const available = await checkUsername(username);
        if (!available) { setError(`@${username} is already taken.`); setLoading(false); return; }
        const { user } = await signUp({ email, password, username, displayName });
        /* Save email for welcome back */
        try { localStorage.setItem('gs_last_email', email); } catch { /* noop */ }
        setPendingUser(user);
        setSignupSuccess(true);
        setLoading(false);
        return;
      } else {
        const { user } = await signIn({ email, password });
        /* Save email for welcome back */
        try { localStorage.setItem('gs_last_email', email); } catch { /* noop */ }
        onAuth(user);
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutEnd(Date.now() + LOCKOUT_SECONDS * 1000);
        setError(`Too many failed attempts. Locked out for ${LOCKOUT_SECONDS}s.`);
      } else {
        setError(classifyError(err.message));
      }
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

  /* Signup success screen with countdown */
  if (signupSuccess) {
    return (
      <div className="flex items-center justify-center min-h-0 p-5">
        <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up">
          <SuccessCheckmark />
          <div className="px-8 pb-8 text-center">
            <p className="text-gs-muted text-sm">Logging you in{countdown > 0 ? ` in ${countdown}...` : '...'}</p>
          </div>
        </div>
      </div>
    );
  }

  /* Forgot password screen */
  if (forgotMode) {
    return (
      <div className="flex items-center justify-center min-h-0 p-5">
        {/* Improvement: Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gs-accent/5 via-transparent to-gs-indigo/5 animate-gradient-shift pointer-events-none" />
        <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up relative z-10">
          <div className="pt-8 px-8 pb-2 text-center">
            <div className="inline-flex items-center gap-2.5 mb-1.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gs-accent/15 to-gs-indigo/15 border border-gs-accent/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
            <p className="text-[15px] font-semibold text-gs-text mt-2">Reset Password</p>
            <p className="text-[13px] text-gs-dim mt-1">
              {forgotSent
                ? "Check your email for a reset link."
                : "Enter your email and we'll send a reset link."}
            </p>
          </div>
          {forgotSent ? (
            <div className="px-8 pb-8 pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <p className="text-gs-muted text-[13px] mb-4">
                If an account exists for <span className="text-gs-text font-medium">{email}</span>, you will receive a password reset email shortly.
              </p>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotSent(false); }}
                className="gs-btn-gradient py-2.5 px-6 border-none rounded-[10px] text-sm font-bold cursor-pointer font-sans text-white"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="px-8 pb-6 pt-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-[10px] px-3.5 py-2.5 text-red-400 text-xs mb-4 leading-relaxed flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              <FormInput
                label="EMAIL"
                value={email}
                onChange={(val) => { setEmail(val); setEmailTouched(true); }}
                placeholder="you@example.com"
                type="email"
                prefix={<MailIcon />}
                error={emailError}
              />
              <button
                type="submit"
                className="w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans flex items-center justify-center gs-btn-gradient text-white"
              >
                Send Reset Link
              </button>
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(""); }}
                  className="bg-transparent border-none text-gs-accent text-[13px] font-semibold cursor-pointer font-sans hover:underline"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-0 p-5 relative">
      {/* Improvement: Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gs-accent/5 via-transparent to-gs-indigo/5 animate-gradient-shift pointer-events-none" />

      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up relative z-10">
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
          {/* Improvement: Welcome back message with last email */}
          <p className="text-[13px] text-gs-dim mt-2">
            {mode === "login"
              ? (lastEmail ? `Welcome back` : "Welcome back")
              : "Join the vinyl community"}
          </p>
          {mode === "login" && lastEmail && (
            <p className="text-[11px] text-gs-faint mt-0.5">
              Last signed in as <span className="text-gs-muted font-medium">{lastEmail}</span>
            </p>
          )}
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

            {/* Improvement: Rate limiting lockout display */}
            {lockoutRemaining > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-[10px] px-3.5 py-2.5 text-amber-400 text-xs mb-4 leading-relaxed flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Too many attempts. Try again in {lockoutRemaining}s</span>
              </div>
            )}

            {/* Improvement: Email field with mail icon prefix */}
            <FormInput
              label="EMAIL"
              value={email}
              onChange={(val) => { setEmail(val); setEmailTouched(true); }}
              placeholder="you@example.com"
              type="email"
              prefix={<MailIcon />}
              error={emailError}
            />

            {mode === "signup" && (
              <>
                {/* Improvement: Username prefix icon */}
                <FormInput
                  label="USERNAME"
                  value={username}
                  onChange={validateUsername}
                  placeholder="your.handle"
                  prefix={<span className="text-gs-dim text-[13px] font-mono">@</span>}
                />
                <FormInput label="DISPLAY NAME" value={displayName} onChange={setDisplayName} placeholder="Your Name" />
              </>
            )}

            {/* Improvement: Password field with lock icon prefix */}
            <div onKeyUp={handleKeyEvent} onKeyDown={handleKeyEvent}>
              <FormInput
                label="PASSWORD"
                value={password}
                onChange={setPassword}
                placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                type={showPassword ? "text" : "password"}
                prefix={<LockIcon />}
                suffix={passwordToggle('main')}
              />
            </div>

            {/* Improvement: Caps lock warning */}
            {capsLockOn && (
              <div className="-mt-2.5 mb-3 flex items-center gap-1.5 text-amber-400 text-[11px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Caps Lock is on
              </div>
            )}

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

            {/* Improvement: Password requirements checklist (signup only) */}
            {mode === "signup" && password && (
              <div className="-mt-2 mb-4 grid grid-cols-2 gap-x-3 gap-y-1">
                {passwordChecks.map(({ label, met }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={met ? '#10b981' : '#555'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      {met ? <polyline points="20 6 9 17 4 12" /> : <line x1="18" y1="6" x2="6" y2="18" />}
                    </svg>
                    <span className={`text-[10px] ${met ? 'text-emerald-400' : 'text-gs-faint'}`}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {mode === "signup" && (
              <div onKeyUp={handleKeyEvent} onKeyDown={handleKeyEvent}>
                <FormInput
                  label="CONFIRM PASSWORD"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter password"
                  type={showConfirm ? "text" : "password"}
                  prefix={<LockIcon />}
                  suffix={passwordToggle('confirm')}
                />
              </div>
            )}

            {/* Improvement: Terms of service checkbox (signup only) */}
            {mode === "signup" && (
              <div className="flex items-start gap-2 mb-4 -mt-1">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={e => setTosAccepted(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gs-border bg-gs-card accent-gs-accent cursor-pointer mt-0.5"
                  id="tos-checkbox"
                />
                <label htmlFor="tos-checkbox" className="text-[11px] text-gs-dim cursor-pointer leading-relaxed">
                  I agree to the{' '}
                  <button type="button" onClick={() => alert('Terms of Service coming soon.')} className="bg-transparent border-none text-gs-accent underline cursor-pointer font-sans text-[11px] p-0">
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button type="button" onClick={() => alert('Privacy Policy coming soon.')} className="bg-transparent border-none text-gs-accent underline cursor-pointer font-sans text-[11px] p-0">
                    Privacy Policy
                  </button>
                </label>
              </div>
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
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Improvement: Login attempt counter */}
            {mode === "login" && attempts > 0 && attempts < MAX_ATTEMPTS && lockoutRemaining <= 0 && (
              <p className="text-[10px] text-gs-faint text-center mb-2">
                {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining before temporary lockout
              </p>
            )}
          </div>

          {/* Submit button with spinner */}
          <button
            type="submit"
            disabled={loading || lockoutRemaining > 0}
            className={`w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans flex items-center justify-center ${(loading || lockoutRemaining > 0) ? 'bg-[#1a1a1a] text-gs-dim opacity-60 cursor-not-allowed' : 'gs-btn-gradient text-white'}`}
          >
            {loading && <Spinner />}
            {loading
              ? (mode === "login" ? "Logging in..." : "Creating account...")
              : (mode === "login" ? "Log In" : "Create Account")
            }
          </button>

          {/* Improvement: Continue as guest option */}
          {onGuest && (
            <button
              type="button"
              onClick={onGuest}
              className="w-full py-2.5 mt-2 bg-transparent border border-gs-border rounded-[10px] text-gs-dim text-[13px] font-medium cursor-pointer font-sans hover:bg-[#111] hover:text-gs-muted transition-all duration-150"
            >
              Continue as Guest
            </button>
          )}

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
        </form>
      </div>
    </div>
  );
}
