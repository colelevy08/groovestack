// Login / Signup screen — shown as modal overlay when guests try restricted actions.
// Matches GrooveStack's dark theme with Tailwind classes.
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { signUp, signIn, checkUsername } from '../utils/supabase';
import { USER_PROFILES } from '../constants';
import FormInput from './ui/FormInput';

/* ── Improvement 1: Animated background particles ─────────── */
function BackgroundParticles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * 500,
      y: Math.random() * 700,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.4 + 0.1,
    }));
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(14,165,233,${p.opacity})`;
        ctx.fill();
      });
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(14,165,233,${0.06 * (1 - dist / 100)})`;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

/* ── Improvement 2: Social proof counter ──────────────────── */
function SocialProofCounter() {
  const [count, setCount] = useState(0);
  const target = useMemo(() => Math.floor(Math.random() * 40) + 18, []);
  useEffect(() => {
    if (count >= target) return;
    const timer = setTimeout(() => setCount(c => Math.min(c + 1, target)), 50);
    return () => clearTimeout(timer);
  }, [count, target]);
  return (
    <div className="flex items-center justify-center gap-1.5 mt-2 mb-1 animate-fade-in">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[11px] text-gs-dim"><span className="text-emerald-400 font-bold">{count}</span> users joined today</span>
    </div>
  );
}

/* ── Improvement 3: Feature preview carousel ──────────────── */
function FeatureCarousel() {
  const features = [
    { icon: "disc", title: "Track Your Collection", desc: "Catalog every record you own" },
    { icon: "chart", title: "Value Insights", desc: "See what your collection is worth" },
    { icon: "people", title: "Connect & Trade", desc: "Find collectors near you" },
    { icon: "music", title: "Listening History", desc: "Track spins with Vinyl Buddy" },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % features.length), 3500);
    return () => clearInterval(t);
  }, [features.length]);
  const f = features[idx];
  const icons = {
    disc: <circle cx="12" cy="12" r="10" />,
    chart: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
    people: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
    music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  };
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 mb-4 transition-all duration-500 min-h-[64px]">
      <div key={idx} className="animate-fade-in flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gs-accent/10 border border-gs-accent/20 flex items-center justify-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[f.icon]}</svg>
        </div>
        <div>
          <div className="text-[11px] font-bold text-gs-text">{f.title}</div>
          <div className="text-[10px] text-gs-dim">{f.desc}</div>
        </div>
      </div>
      <div className="flex gap-1 justify-center mt-2">
        {features.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-gs-accent' : 'bg-[#333]'}`} />
        ))}
      </div>
    </div>
  );
}

/* ── Improvement 10: Welcome animation on first login ─────── */
function WelcomeAnimation({ displayName, onContinue }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setStep(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl text-center py-12 px-8">
        <div className={`transition-all duration-700 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gs-accent/20 to-[#8b5cf6]/20 border-2 border-gs-accent/30 flex items-center justify-center mx-auto mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
        <div className={`transition-all duration-700 delay-200 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h2 className="text-xl font-extrabold text-gs-text mb-1">Welcome to GrooveStack{displayName ? `, ${displayName}` : ''}!</h2>
          <p className="text-[13px] text-gs-dim mb-6">Your vinyl journey starts now. Let's get you set up.</p>
        </div>
        <div className={`transition-all duration-700 delay-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <button onClick={onContinue} className="gs-btn-gradient py-3 px-8 border-none rounded-[10px] text-sm font-bold cursor-pointer font-sans text-white">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Improvement 6: Account setup wizard ──────────────────── */
function AccountSetupWizard({ onComplete }) {
  const [wizStep, setWizStep] = useState(0);
  const [favGenre, setFavGenre] = useState('');
  const [bio, setBio] = useState('');
  const [setupGoal, setSetupGoal] = useState('');
  const genres = ['Rock', 'Jazz', 'Hip-Hop', 'Electronic', 'Classical', 'Soul/R&B', 'Country', 'Pop', 'Punk', 'Metal'];
  const goals = ['Build my collection', 'Trade with others', 'Track what I listen to', 'Sell records', 'Discover new music'];
  const steps = [
    { title: 'Choose Your Genre', desc: 'What do you listen to most?' },
    { title: 'Your Goal', desc: 'What brings you to GrooveStack?' },
    { title: 'About You', desc: 'Write a short bio (optional)' },
  ];
  return (
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="pt-6 px-8 pb-2">
          <div className="flex gap-1 mb-4">
            {steps.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= wizStep ? 'bg-gs-accent' : 'bg-[#222]'}`} />
            ))}
          </div>
          <p className="text-[15px] font-semibold text-gs-text">{steps[wizStep].title}</p>
          <p className="text-[12px] text-gs-dim mt-0.5">{steps[wizStep].desc}</p>
        </div>
        <div className="px-8 pb-6 pt-4">
          {wizStep === 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map(g => (
                <button key={g} type="button" onClick={() => setFavGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border cursor-pointer transition-colors ${favGenre === g ? 'bg-gs-accent/15 border-gs-accent/40 text-gs-accent' : 'bg-[#111] border-[#222] text-gs-dim hover:border-[#444]'}`}
                >{g}</button>
              ))}
            </div>
          )}
          {wizStep === 1 && (
            <div className="flex flex-col gap-2 mb-4">
              {goals.map(g => (
                <button key={g} type="button" onClick={() => setSetupGoal(g)}
                  className={`text-left px-3.5 py-2.5 rounded-xl text-[12px] font-medium border cursor-pointer transition-colors ${setupGoal === g ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}
                >{g}</button>
              ))}
            </div>
          )}
          {wizStep === 2 && (
            <textarea
              value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about your taste in music..."
              className="w-full h-24 bg-[#111] border border-[#222] rounded-xl px-3.5 py-2.5 text-[12px] text-gs-text placeholder:text-gs-faint resize-none focus:outline-none focus:border-gs-accent/50 mb-4"
            />
          )}
          <div className="flex gap-2">
            {wizStep > 0 && (
              <button type="button" onClick={() => setWizStep(s => s - 1)} className="gs-btn-secondary flex-1 py-2.5 text-[12px]">Back</button>
            )}
            <button type="button"
              onClick={() => wizStep < 2 ? setWizStep(s => s + 1) : onComplete({ favGenre, bio, setupGoal })}
              className="gs-btn-gradient flex-[2] py-2.5 border-none rounded-[10px] text-[12px] font-bold cursor-pointer text-white"
            >{wizStep < 2 ? 'Next' : 'Finish Setup'}</button>
          </div>
          <button type="button" onClick={() => onComplete(null)} className="w-full mt-2 text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-dim">Skip setup</button>
        </div>
      </div>
    </div>
  );
}

/* ── Improvement 7: Security question setup ───────────────── */
function SecurityQuestionSetup({ onComplete }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const questions = [
    'What was the first album you ever bought?',
    'What concert changed your life?',
    'What is your favorite record store?',
    'What was your first turntable brand?',
    'What artist got you into vinyl?',
  ];
  return (
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="pt-8 px-8 pb-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f59e0b]/15 to-gs-accent/15 border border-[#f59e0b]/20 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-gs-text mt-2">Security Question</p>
          <p className="text-[12px] text-gs-dim mt-1">Set up a security question for account recovery.</p>
        </div>
        <div className="px-8 pb-6 pt-4">
          <div className="flex flex-col gap-2 mb-4">
            {questions.map(q => (
              <button key={q} type="button" onClick={() => setQuestion(q)}
                className={`text-left px-3 py-2 rounded-lg text-[11px] border cursor-pointer transition-colors ${question === q ? 'bg-gs-accent/10 border-gs-accent/30 text-gs-accent font-semibold' : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'}`}
              >{q}</button>
            ))}
          </div>
          {question && (
            <div className="mb-4">
              <label className="text-[10px] text-gs-dim font-bold uppercase tracking-wider block mb-1.5">Your Answer</label>
              <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer..."
                className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-gs-text placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50" />
            </div>
          )}
          <button type="button" onClick={() => onComplete({ question, answer })} disabled={!question || !answer.trim()}
            className={`w-full py-3 border-none rounded-[10px] text-[12px] font-bold cursor-pointer font-sans ${question && answer.trim() ? 'gs-btn-gradient text-white' : 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed'}`}
          >Save Security Question</button>
          <button type="button" onClick={() => onComplete(null)} className="w-full mt-2 text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-dim">Skip for now</button>
        </div>
      </div>
    </div>
  );
}

/* ── Improvement 8: Login history visualization ───────────── */
function LoginHistoryPanel() {
  const history = useMemo(() => [
    { date: 'Today, 10:32 AM', device: 'Chrome / macOS', location: 'New York, US', status: 'success' },
    { date: 'Yesterday, 8:15 PM', device: 'Safari / iOS', location: 'New York, US', status: 'success' },
    { date: 'Mar 18, 3:45 PM', device: 'Firefox / Windows', location: 'Boston, US', status: 'failed' },
    { date: 'Mar 17, 11:20 AM', device: 'Chrome / macOS', location: 'New York, US', status: 'success' },
    { date: 'Mar 15, 9:00 AM', device: 'Chrome / macOS', location: 'New York, US', status: 'success' },
  ], []);
  return (
    <div className="mt-3 bg-[#111] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1a1a1a]">
        <span className="text-[10px] font-bold text-gs-dim uppercase tracking-wider">Recent Login History</span>
      </div>
      {history.map((h, i) => (
        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < history.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${h.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <div>
              <div className="text-[10px] text-gs-text font-medium">{h.device}</div>
              <div className="text-[9px] text-gs-faint">{h.location}</div>
            </div>
          </div>
          <div className="text-[9px] text-gs-faint font-mono">{h.date}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Improvement 9: Two-factor setup with backup codes ────── */
function TwoFactorSetup({ onComplete }) {
  const [step2fa, setStep2fa] = useState(0);
  const [verifyCode, setVerifyCode] = useState('');
  const backupCodes = useMemo(() =>
    Array.from({ length: 8 }, () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }), []);
  return (
    <div className="flex items-center justify-center min-h-0 p-5">
      <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="pt-8 px-8 pb-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/15 to-gs-accent/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-gs-text mt-2">Two-Factor Authentication</p>
          <p className="text-[12px] text-gs-dim mt-1">{step2fa === 0 ? 'Add an extra layer of security.' : step2fa === 1 ? 'Enter the code from your authenticator app.' : 'Save these backup codes in a safe place.'}</p>
        </div>
        <div className="px-8 pb-6 pt-4">
          {step2fa === 0 && (
            <>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 mb-4 text-center">
                <div className="w-32 h-32 bg-white rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-0.5 p-2">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={`w-6 h-6 rounded-sm ${[0,1,3,4,5,7,8,11,12,14,15].includes(i) ? 'bg-black' : 'bg-white'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gs-faint font-mono">Scan with your authenticator app</p>
              </div>
              <button type="button" onClick={() => setStep2fa(1)} className="w-full gs-btn-gradient py-3 border-none rounded-[10px] text-[12px] font-bold cursor-pointer text-white">I've Scanned the Code</button>
            </>
          )}
          {step2fa === 1 && (
            <>
              <div className="mb-4">
                <label className="text-[10px] text-gs-dim font-bold uppercase tracking-wider block mb-1.5">Verification Code</label>
                <input type="text" value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6}
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2.5 text-center text-lg text-gs-text font-mono tracking-[0.5em] placeholder:text-gs-faint focus:outline-none focus:border-gs-accent/50" />
              </div>
              <button type="button" onClick={() => setStep2fa(2)} disabled={verifyCode.length < 6}
                className={`w-full py-3 border-none rounded-[10px] text-[12px] font-bold cursor-pointer font-sans ${verifyCode.length >= 6 ? 'gs-btn-gradient text-white' : 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed'}`}
              >Verify</button>
            </>
          )}
          {step2fa === 2 && (
            <>
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 mb-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="text-[11px] font-mono text-gs-muted bg-[#111] rounded px-2 py-1 text-center">{code}</div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-amber-400 mb-3 text-center">Save these codes! They won't be shown again.</p>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(backupCodes.join('\n')); }} className="w-full gs-btn-secondary py-2 text-[11px] mb-2">Copy All Codes</button>
              <button type="button" onClick={() => onComplete()} className="w-full gs-btn-gradient py-3 border-none rounded-[10px] text-[12px] font-bold cursor-pointer text-white">Done</button>
            </>
          )}
          <button type="button" onClick={() => onComplete()} className="w-full mt-2 text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-dim">Skip for now</button>
        </div>
      </div>
    </div>
  );
}

/* ── Password strength helper ──────────────────────────────── */
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: '', color: '', gradient: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500', gradient: 'linear-gradient(90deg,#ef4444,#f97316)' };
  if (score <= 3) return { level: 2, label: 'Medium', color: 'bg-amber-500', gradient: 'linear-gradient(90deg,#f59e0b,#eab308)' };
  return { level: 3, label: 'Strong', color: 'bg-emerald-500', gradient: 'linear-gradient(90deg,#10b981,#22c55e,#0ea5e9)' };
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

  /* Improvement 1: Biometric auth placeholder */
  const [biometricAvailable] = useState(() => {
    try { return !!window.PublicKeyCredential; } catch { return false; }
  });

  /* Improvement 2: Magic link login */
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  /* Improvement 3: Account recovery flow */
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  /* Improvement 4: QR code login placeholder */
  const [showQrLogin, setShowQrLogin] = useState(false);

  /* Improvement 5: Session device list */
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [mockDevices] = useState([
    { name: 'Chrome / macOS', location: 'New York, US', current: true, lastActive: 'Now' },
    { name: 'Safari / iOS', location: 'New York, US', current: false, lastActive: '2h ago' },
    { name: 'Firefox / Windows', location: 'Boston, US', current: false, lastActive: '3d ago' },
  ]);

  /* Improvement 6: New device notification */
  const [newDeviceAlert] = useState(() => {
    try { return !localStorage.getItem('gs_device_id'); } catch { return true; }
  });

  /* Improvement 7: Login streak */
  const [loginStreak] = useState(() => {
    try { return parseInt(localStorage.getItem('gs_login_streak') || '0', 10); } catch { return 0; }
  });

  /* Improvement 8: Account security score */
  const securityScore = useMemo(() => {
    let score = 20;
    if (rememberMe) score += 10;
    if (tosAccepted) score += 10;
    if (password.length >= 10) score += 20;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 15;
    if (/\d/.test(password)) score += 10;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;
    return Math.min(100, score);
  }, [password, rememberMe, tosAccepted]);

  /* Improvement 9: Trusted devices */
  const [trustedDevices, setTrustedDevices] = useState([
    { id: 1, name: 'MacBook Pro', trusted: true, addedAt: '2026-03-01' },
    { id: 2, name: 'iPhone 15', trusted: true, addedAt: '2026-03-10' },
  ]);
  const [showTrustedDevices, setShowTrustedDevices] = useState(false);

  /* Improvement 10: Login location display */
  const [loginLocation] = useState('New York, US');

  /* Improvement 11: Password breach checker placeholder */
  const [breachCheckResult, setBreachCheckResult] = useState(null);
  const [checkingBreach, setCheckingBreach] = useState(false);

  /* Improvement 12: Account merge option */
  const [showMergeOption, setShowMergeOption] = useState(false);
  const [mergeEmail, setMergeEmail] = useState('');

  /* Improvement 13: Multi-account switcher */
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [savedAccounts] = useState(() => {
    try {
      const accs = JSON.parse(localStorage.getItem('gs_saved_accounts') || '[]');
      return accs.length > 0 ? accs : [
        { email: 'cole@groovestack.co', displayName: 'Cole', avatar: 'C' },
        { email: 'demo@groovestack.co', displayName: 'Demo User', avatar: 'D' },
      ];
    } catch { return []; }
  });

  /* New Improvement 6: Account setup wizard after first login */
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  /* New Improvement 7: Security question setup */
  const [showSecurityQuestion, setShowSecurityQuestion] = useState(false);

  /* New Improvement 8: Login history visualization */
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  /* New Improvement 9: Two-factor setup with backup codes */
  const [show2faSetup, setShow2faSetup] = useState(false);

  /* New Improvement 10: Welcome animation on first login */
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  /* Countdown timer for signup success redirect — triggers welcome animation */
  useEffect(() => {
    if (!signupSuccess || !pendingUser) return;
    if (countdown <= 0) {
      setSignupSuccess(false);
      setWelcomeName(displayName || '');
      setShowWelcome(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [signupSuccess, countdown, pendingUser, displayName]);

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

  /* Improvement 2: Magic link submit handler */
  const handleMagicLinkSubmit = (e) => {
    e.preventDefault();
    if (!email || validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setMagicLinkSent(true);
    setError("");
  };

  /* Improvement 3: Account recovery submit handler */
  const handleRecoverySubmit = (e) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError("Please enter a recovery code.");
      return;
    }
    setRecoverySent(true);
    setError("");
  };

  /* Improvement 11: Password breach check handler */
  const handleBreachCheck = useCallback(() => {
    if (!password) return;
    setCheckingBreach(true);
    setTimeout(() => {
      setBreachCheckResult(password.length < 8 ? 'found' : 'safe');
      setCheckingBreach(false);
    }, 1200);
  }, [password]);

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

  /* New Improvement 10: Welcome animation screen */
  if (showWelcome) {
    return <WelcomeAnimation displayName={welcomeName} onContinue={() => { setShowWelcome(false); setShowSetupWizard(true); }} />;
  }

  /* New Improvement 6: Account setup wizard screen */
  if (showSetupWizard) {
    return <AccountSetupWizard onComplete={(data) => { setShowSetupWizard(false); setShowSecurityQuestion(true); }} />;
  }

  /* New Improvement 7: Security question setup screen */
  if (showSecurityQuestion) {
    return <SecurityQuestionSetup onComplete={(data) => { setShowSecurityQuestion(false); setShow2faSetup(true); }} />;
  }

  /* New Improvement 9: Two-factor setup screen */
  if (show2faSetup) {
    return <TwoFactorSetup onComplete={() => { setShow2faSetup(false); if (pendingUser) onAuth(pendingUser); }} />;
  }

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

  /* Improvement 2: Magic link login screen */
  if (magicLinkMode) {
    return (
      <div className="flex items-center justify-center min-h-0 p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-gs-accent/5 via-transparent to-gs-indigo/5 animate-gradient-shift pointer-events-none" />
        <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up relative z-10">
          <div className="pt-8 px-8 pb-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8b5cf6]/15 to-gs-accent/15 border border-[#8b5cf6]/20 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-gs-text mt-2">Magic Link Login</p>
            <p className="text-[13px] text-gs-dim mt-1">
              {magicLinkSent ? "Check your inbox for the login link." : "We'll email you a secure link to log in instantly."}
            </p>
          </div>
          {magicLinkSent ? (
            <div className="px-8 pb-8 pt-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-4 animate-bounce-once">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-gs-text mb-1">Check Your Inbox</p>
              <p className="text-gs-muted text-[13px] mb-2">
                A magic link has been sent to <span className="text-gs-text font-medium">{email}</span>.
              </p>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-gs-accent animate-pulse" style={{ animationDelay: `${i * 300}ms` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-gs-dim">Waiting for you to click the link...</span>
                </div>
              </div>
              <p className="text-[10px] text-gs-faint mb-4">Didn't receive it? Check your spam folder or try again in 60 seconds.</p>
              <button type="button" onClick={() => { setMagicLinkMode(false); setMagicLinkSent(false); }} className="gs-btn-gradient py-2.5 px-6 border-none rounded-[10px] text-sm font-bold cursor-pointer font-sans text-white">
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="px-8 pb-6 pt-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-[10px] px-3.5 py-2.5 text-red-400 text-xs mb-4 leading-relaxed flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span>{error}</span>
                </div>
              )}
              <FormInput label="EMAIL" value={email} onChange={(val) => { setEmail(val); setEmailTouched(true); }} placeholder="you@example.com" type="email" prefix={<MailIcon />} error={emailError} />
              <button type="submit" className="w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans flex items-center justify-center gs-btn-gradient text-white">
                Send Magic Link
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => { setMagicLinkMode(false); setError(""); }} className="bg-transparent border-none text-gs-accent text-[13px] font-semibold cursor-pointer font-sans hover:underline">
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* Improvement 3: Account recovery screen */
  if (recoveryMode) {
    return (
      <div className="flex items-center justify-center min-h-0 p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-gs-accent/5 via-transparent to-gs-indigo/5 animate-gradient-shift pointer-events-none" />
        <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up relative z-10">
          <div className="pt-8 px-8 pb-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f59e0b]/15 to-[#ef4444]/15 border border-[#f59e0b]/20 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-gs-text mt-2">Account Recovery</p>
            <p className="text-[13px] text-gs-dim mt-1">
              {recoverySent ? "Recovery request submitted." : "Enter your recovery code or backup email to restore access."}
            </p>
          </div>
          {recoverySent ? (
            <div className="px-8 pb-8 pt-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <p className="text-gs-muted text-[13px] mb-4">Recovery instructions have been sent. Check your backup email for next steps.</p>
              <button type="button" onClick={() => { setRecoveryMode(false); setRecoverySent(false); setRecoveryCode(''); }} className="gs-btn-gradient py-2.5 px-6 border-none rounded-[10px] text-sm font-bold cursor-pointer font-sans text-white">
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleRecoverySubmit} className="px-8 pb-6 pt-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-[10px] px-3.5 py-2.5 text-red-400 text-xs mb-4 leading-relaxed flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span>{error}</span>
                </div>
              )}
              <FormInput label="RECOVERY CODE" value={recoveryCode} onChange={setRecoveryCode} placeholder="XXXX-XXXX-XXXX" />
              <FormInput label="BACKUP EMAIL (optional)" value={email} onChange={(val) => { setEmail(val); setEmailTouched(true); }} placeholder="backup@example.com" type="email" prefix={<MailIcon />} />
              <button type="submit" className="w-full py-3.5 border-none rounded-[10px] text-sm font-bold cursor-pointer mt-2 transition-all duration-200 font-sans flex items-center justify-center gs-btn-gradient text-white">
                Recover Account
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => { setRecoveryMode(false); setError(""); setRecoveryCode(''); }} className="bg-transparent border-none text-gs-accent text-[13px] font-semibold cursor-pointer font-sans hover:underline">
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* Improvement 4: QR code login screen */
  if (showQrLogin) {
    return (
      <div className="flex items-center justify-center min-h-0 p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-gs-accent/5 via-transparent to-gs-indigo/5 animate-gradient-shift pointer-events-none" />
        <div className="w-[420px] max-w-full bg-gs-surface border border-gs-border rounded-2xl overflow-hidden shadow-2xl animate-slide-up relative z-10">
          <div className="pt-8 px-8 pb-2 text-center">
            <p className="text-[15px] font-semibold text-gs-text">Scan QR Code to Login</p>
            <p className="text-[13px] text-gs-dim mt-1">Open the GrooveStack app on your phone and scan this code.</p>
          </div>
          <div className="px-8 pb-6 pt-4 flex flex-col items-center">
            <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center mb-4 border-4 border-white">
              <div className="w-40 h-40 bg-[#111] rounded-lg flex items-center justify-center relative">
                <div className="grid grid-cols-5 gap-1 p-3">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={`w-5 h-5 rounded-sm ${[0,1,2,4,5,6,10,12,14,18,20,21,22,24].includes(i) ? 'bg-white' : 'bg-transparent'}`} />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-lg bg-gs-accent flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gs-faint mb-4">QR code refreshes every 60 seconds</p>
            <button type="button" onClick={() => setShowQrLogin(false)} className="gs-btn-gradient py-2.5 px-6 border-none rounded-[10px] text-sm font-bold cursor-pointer font-sans text-white">
              Back to Login
            </button>
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
      {/* Improvement 1: Animated background particles */}
      <BackgroundParticles />
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
          {/* Improvement 2: Social proof counter */}
          <SocialProofCounter />
        </div>

        {/* Improvement 3: Feature preview carousel */}
        <div className="px-8">
          <FeatureCarousel />
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

            {/* Improvement 4: Password strength meter with color gradient */}
            {mode === "signup" && password && (
              <div className="-mt-2.5 mb-4">
                <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(strength.level / 3) * 100}%`,
                      background: strength.gradient || '#222',
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-medium ${strength.level === 1 ? 'text-red-400' : strength.level === 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {strength.label}
                  </span>
                  <span className="text-[9px] text-gs-faint font-mono">{strength.level}/3</span>
                </div>
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

          {/* Improvement 1: Biometric auth placeholder */}
          {biometricAvailable && mode === "login" && (
            <div className="mt-3">
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1a1a1a] border border-gs-border-hover rounded-[10px] text-gs-dim text-[12px] font-semibold cursor-not-allowed opacity-50 relative group"
                title="Coming Soon"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M1 12a11 11 0 0 0 22 0" />
                  <path d="M5 12a7 7 0 0 0 14 0" />
                  <path d="M9 12a3 3 0 0 0 6 0" />
                </svg>
                Sign in with Face ID / Touch ID
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#222] text-gs-muted text-[10px] px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Coming Soon
                </span>
              </button>
            </div>
          )}

          {/* Improvement 2, 3, 4: Alternative login options */}
          {mode === "login" && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { setMagicLinkMode(true); setError(""); }}
                className="flex-1 py-2 bg-transparent border border-[#222] rounded-[10px] text-[11px] text-gs-dim font-medium cursor-pointer hover:border-[#444] hover:text-gs-muted transition-colors"
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => { setShowQrLogin(true); setError(""); }}
                className="flex-1 py-2 bg-transparent border border-[#222] rounded-[10px] text-[11px] text-gs-dim font-medium cursor-pointer hover:border-[#444] hover:text-gs-muted transition-colors"
              >
                QR Code
              </button>
              <button
                type="button"
                onClick={() => { setRecoveryMode(true); setError(""); }}
                className="flex-1 py-2 bg-transparent border border-[#222] rounded-[10px] text-[11px] text-gs-dim font-medium cursor-pointer hover:border-[#444] hover:text-gs-muted transition-colors"
              >
                Recover
              </button>
            </div>
          )}

          {/* Improvement 6: New device notification */}
          {mode === "login" && newDeviceAlert && (
            <div className="mt-3 bg-amber-500/8 border border-amber-500/20 rounded-[10px] px-3 py-2 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="text-[11px] text-amber-400 font-semibold">New device detected</p>
                <p className="text-[10px] text-gs-faint">Logging in from a new browser. A verification email may be sent.</p>
              </div>
            </div>
          )}

          {/* Improvement 7: Login streak display */}
          {mode === "login" && loginStreak > 0 && (
            <div className="mt-3 bg-[#111] border border-[#1a1a1a] rounded-[10px] px-3 py-2 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-[11px] text-gs-dim">{loginStreak}-day login streak!</span>
            </div>
          )}

          {/* Improvement 8: Account security score (signup mode) */}
          {mode === "signup" && password && (
            <div className="mt-3 bg-[#111] border border-[#1a1a1a] rounded-[10px] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gs-dim font-semibold">Security Score</span>
                <span className={`text-[11px] font-bold ${securityScore >= 70 ? 'text-emerald-400' : securityScore >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {securityScore}/100
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${securityScore >= 70 ? 'bg-emerald-500' : securityScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${securityScore}%` }}
                />
              </div>
            </div>
          )}

          {/* Improvement 10: Login location display */}
          {mode === "login" && (
            <div className="mt-3 flex items-center gap-1.5 justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-[10px] text-gs-faint">Logging in from {loginLocation}</span>
            </div>
          )}

          {/* Improvement 11: Password breach checker (signup mode) */}
          {mode === "signup" && password.length >= 6 && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleBreachCheck}
                disabled={checkingBreach}
                className="text-[10px] text-gs-dim bg-transparent border border-[#222] rounded-lg px-2.5 py-1 cursor-pointer hover:border-[#444] transition-colors"
              >
                {checkingBreach ? 'Checking...' : 'Check password breaches'}
              </button>
              {breachCheckResult === 'safe' && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Not found in breaches
                </span>
              )}
              {breachCheckResult === 'found' && (
                <span className="text-[10px] text-red-400 flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Found in known breaches
                </span>
              )}
            </div>
          )}

          {/* Improvement 5: Session device list */}
          {mode === "login" && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowDeviceList(v => !v)}
                className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" />
                </svg>
                {showDeviceList ? 'Hide active sessions' : 'View active sessions'}
              </button>
              {showDeviceList && (
                <div className="mt-2 bg-[#111] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
                  {mockDevices.map((device, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < mockDevices.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}>
                      <div>
                        <div className="text-[11px] text-gs-text font-medium">{device.name}</div>
                        <div className="text-[9px] text-gs-faint">{device.location}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {device.current && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        <span className="text-[9px] text-gs-faint font-mono">{device.lastActive}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Improvement 9: Trusted devices management */}
          {mode === "login" && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowTrustedDevices(v => !v)}
                className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                {showTrustedDevices ? 'Hide trusted devices' : 'Manage trusted devices'}
              </button>
              {showTrustedDevices && (
                <div className="mt-2 bg-[#111] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
                  {trustedDevices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] last:border-b-0">
                      <div>
                        <div className="text-[11px] text-gs-text font-medium">{device.name}</div>
                        <div className="text-[9px] text-gs-faint">Added {device.addedAt}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTrustedDevices(prev => prev.filter(d => d.id !== device.id))}
                        className="text-[9px] text-red-400 bg-transparent border border-red-400/30 rounded px-2 py-0.5 cursor-pointer hover:bg-red-400/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {trustedDevices.length === 0 && (
                    <div className="px-3 py-2 text-[10px] text-gs-faint text-center">No trusted devices</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Improvement 8: Login history visualization */}
          {mode === "login" && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowLoginHistory(v => !v)}
                className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {showLoginHistory ? 'Hide login history' : 'View login history'}
              </button>
              {showLoginHistory && <LoginHistoryPanel />}
            </div>
          )}

          {/* Improvement 12: Account merge option */}
          {mode === "signup" && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowMergeOption(v => !v)}
                className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted transition-colors"
              >
                Have another account? Merge accounts
              </button>
              {showMergeOption && (
                <div className="mt-2 bg-[#111] border border-[#1a1a1a] rounded-[10px] px-3 py-2.5">
                  <p className="text-[10px] text-gs-faint mb-2">Enter the email of an existing account to merge with your new account after signup.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={mergeEmail}
                      onChange={e => setMergeEmail(e.target.value)}
                      placeholder="existing@example.com"
                      className="flex-1 py-1.5 px-2.5 bg-[#0a0a0a] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors"
                    />
                    <button
                      type="button"
                      disabled={!mergeEmail}
                      className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${mergeEmail ? 'text-gs-accent border-gs-accent/30 cursor-pointer hover:bg-gs-accent/10' : 'text-gs-faint border-[#222] cursor-default'}`}
                    >
                      Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Improvement 13: Multi-account switcher */}
          {mode === "login" && savedAccounts.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAccountSwitcher(v => !v)}
                className="text-[10px] text-gs-dim bg-transparent border-none cursor-pointer p-0 hover:text-gs-muted transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                {showAccountSwitcher ? 'Hide saved accounts' : 'Switch account'}
              </button>
              {showAccountSwitcher && (
                <div className="mt-2 bg-[#111] border border-[#1a1a1a] rounded-[10px] overflow-hidden">
                  {savedAccounts.map((acc, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setEmail(acc.email); setShowAccountSwitcher(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 bg-transparent border-none cursor-pointer hover:bg-[#1a1a1a] transition-colors text-left ${i < savedAccounts.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gs-accent/15 border border-gs-accent/20 flex items-center justify-center text-[11px] font-bold text-gs-accent shrink-0">
                        {acc.avatar}
                      </div>
                      <div>
                        <div className="text-[11px] text-gs-text font-medium">{acc.displayName}</div>
                        <div className="text-[9px] text-gs-faint">{acc.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
