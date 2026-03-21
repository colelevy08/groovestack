// Onboarding tour — 10-step tooltip walkthrough for new users.
// Improvements: 10 total steps, progress persistence, skip/back navigation, step animations,
// spotlight/highlight target elements, interactive step actions (click target to advance),
// skip to specific step, and tour completion reward animation.
import { useState, useEffect, useCallback, useRef } from 'react';

const STEPS = [
  {
    title: 'Welcome to GrooveStack!',
    description: 'Your vinyl record collection hub. Browse, collect, trade, and connect with fellow crate diggers.',
    icon: 'wave',
    target: null, // no spotlight for welcome
  },
  {
    title: 'Browse the Marketplace',
    description: 'Discover records from the community. Filter by genre, condition, and price to find your next gem.',
    icon: 'search',
    target: '[data-tour="marketplace"]',
    interactive: true, // click target to advance
  },
  {
    title: 'AI Vinyl Verification',
    description: 'Snap a photo of any record and our AI will identify it, grade its condition, and estimate its value.',
    icon: 'camera',
    target: '[data-tour="ai-verify"]',
  },
  {
    title: 'Build Your Collection',
    description: 'Add records to your crate and organize them by genre, artist, or custom tags. Track every spin.',
    icon: 'vinyl',
    target: '[data-tour="collection"]',
    interactive: true,
  },
  {
    title: 'Wishlist & Alerts',
    description: 'Add records to your wishlist and get notified when they appear in the marketplace at your price.',
    icon: 'bell',
    target: '[data-tour="wishlist"]',
  },
  {
    title: 'Make & Receive Offers',
    description: 'Negotiate prices directly with sellers. Submit offers, counter-offer, and close deals in-app.',
    icon: 'handshake',
    target: '[data-tour="offers"]',
  },
  {
    title: 'Connect with Collectors',
    description: 'Follow other collectors, see what they are spinning, and discover records through their collections.',
    icon: 'people',
    target: '[data-tour="connect"]',
  },
  {
    title: 'Chat & Community',
    description: 'Message other collectors, join genre-specific groups, and share your latest finds with the community.',
    icon: 'chat',
    target: '[data-tour="chat"]',
  },
  {
    title: 'Track Value Over Time',
    description: 'Watch your collection value grow with real-time market data. See trends, gains, and top performers.',
    icon: 'chart',
    target: '[data-tour="value"]',
  },
  {
    title: 'You are All Set!',
    description: 'Start exploring the marketplace or add your first record. Happy digging and welcome to the groove!',
    icon: 'rocket',
    target: null,
  },
];

const ICON_MAP = {
  wave: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 5.64a9 9 0 11-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  ),
  search: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  camera: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
    </svg>
  ),
  vinyl: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  bell: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  handshake: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V8" /><path d="M5 12H2a10 10 0 0020 0h-3" />
    </svg>
  ),
  people: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  chart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  rocket: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    </svg>
  ),
};

export default function OnboardingTour({ currentUser }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [animDir, setAnimDir] = useState('next');
  const [showReward, setShowReward] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [jumpMenuOpen, setJumpMenuOpen] = useState(false);
  const interactiveCleanupRef = useRef(null);

  // Restore persisted progress
  useEffect(() => {
    if (!currentUser) return;
    const key = `gs_onboarded_${currentUser}`;
    const progressKey = `gs_onboard_step_${currentUser}`;
    if (!localStorage.getItem(key)) {
      const savedStep = parseInt(localStorage.getItem(progressKey) || '0', 10);
      setStep(savedStep < STEPS.length ? savedStep : 0);
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  // Persist step progress
  useEffect(() => {
    if (currentUser && visible) {
      localStorage.setItem(`gs_onboard_step_${currentUser}`, String(step));
    }
  }, [step, currentUser, visible]);

  // Spotlight: measure and highlight the target element for the current step
  useEffect(() => {
    if (!visible) {
      setSpotlightRect(null);
      return;
    }
    const currentStepData = STEPS[step];
    if (!currentStepData?.target) {
      setSpotlightRect(null);
      return;
    }
    const targetEl = document.querySelector(currentStepData.target);
    if (!targetEl) {
      setSpotlightRect(null);
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;
    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
    // Scroll target into view
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [step, visible]);

  // Interactive step: add click listener to the target element to advance
  useEffect(() => {
    // Clean up previous listener
    if (interactiveCleanupRef.current) {
      interactiveCleanupRef.current();
      interactiveCleanupRef.current = null;
    }

    if (!visible) return;
    const currentStepData = STEPS[step];
    if (!currentStepData?.interactive || !currentStepData?.target) return;

    const targetEl = document.querySelector(currentStepData.target);
    if (!targetEl) return;

    const handleTargetClick = () => {
      if (step < STEPS.length - 1) {
        setAnimDir('next');
        setStep(s => s + 1);
      }
    };

    targetEl.addEventListener('click', handleTargetClick);
    // Add a visual hint that the element is clickable
    targetEl.style.cursor = 'pointer';
    targetEl.setAttribute('data-tour-interactive', 'true');

    interactiveCleanupRef.current = () => {
      targetEl.removeEventListener('click', handleTargetClick);
      targetEl.style.cursor = '';
      targetEl.removeAttribute('data-tour-interactive');
    };

    return () => {
      if (interactiveCleanupRef.current) {
        interactiveCleanupRef.current();
        interactiveCleanupRef.current = null;
      }
    };
  }, [step, visible]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (currentUser) {
      localStorage.setItem(`gs_onboarded_${currentUser}`, '1');
      localStorage.removeItem(`gs_onboard_step_${currentUser}`);
    }
  }, [currentUser]);

  // Complete with reward animation
  const complete = useCallback(() => {
    setShowReward(true);
    setTimeout(() => {
      setShowReward(false);
      dismiss();
    }, 2500);
  }, [dismiss]);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setAnimDir('next');
      setStep(s => s + 1);
    } else {
      complete();
    }
  }, [step, complete]);

  const prev = useCallback(() => {
    if (step > 0) {
      setAnimDir('prev');
      setStep(s => s - 1);
    }
  }, [step]);

  const goToStep = useCallback((i) => {
    if (i < 0 || i >= STEPS.length) return;
    setAnimDir(i > step ? 'next' : 'prev');
    setStep(i);
    setJumpMenuOpen(false);
  }, [step]);

  // Tour completion reward animation
  if (showReward) {
    return (
      <div className="fixed inset-0 z-[2500] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="flex flex-col items-center animate-modal-in">
          {/* Animated reward ring */}
          <div className="relative w-24 h-24 mb-4">
            <svg className="w-24 h-24 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#rewardGrad)" strokeWidth="4" strokeDasharray="20 10" />
              <defs>
                <linearGradient id="rewardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="50%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-4xl">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h3 className="text-[18px] font-bold text-white mb-2">Tour Complete!</h3>
          <p className="text-[13px] text-white/70">You are ready to start digging. Enjoy GrooveStack!</p>
          {/* Sparkle particles */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360;
            const rad = (angle * Math.PI) / 180;
            const dist = 60 + Math.random() * 30;
            return (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4 + Math.random() * 4,
                  height: 4 + Math.random() * 4,
                  backgroundColor: ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899'][i % 5],
                  left: '50%',
                  top: '40%',
                  animation: `gsRewardBurst 1.5s ease-out ${i * 0.05}s forwards`,
                  '--burst-x': `${Math.cos(rad) * dist}px`,
                  '--burst-y': `${Math.sin(rad) * dist}px`,
                  opacity: 0,
                }}
              />
            );
          })}
          <style>{`
            @keyframes gsRewardBurst {
              0% { opacity: 1; transform: translate(0, 0) scale(1); }
              70% { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--burst-x), var(--burst-y)) scale(0); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  const current = STEPS[step];
  const slideClass = animDir === 'next'
    ? 'animate-slide-in-right'
    : 'animate-slide-in-left';

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center animate-fade-in">
      {/* Spotlight overlay: dark background with a cutout for the target element */}
      {spotlightRect ? (
        <svg className="fixed inset-0 w-full h-full" style={{ zIndex: 2500 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="8"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.70)"
            mask="url(#spotlight-mask)"
            style={{ backdropFilter: 'blur(4px)' }}
          />
          {/* Spotlight border glow */}
          <rect
            x={spotlightRect.left}
            y={spotlightRect.top}
            width={spotlightRect.width}
            height={spotlightRect.height}
            rx="8"
            fill="none"
            stroke="rgba(14,165,233,0.5)"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ zIndex: 2500 }} />
      )}

      {/* Tour card */}
      <div className="bg-gs-surface border border-gs-border rounded-2xl p-6 max-w-sm w-[90vw] shadow-2xl animate-modal-in relative" style={{ zIndex: 2501 }}>
        {/* Progress dots -- clickable */}
        <div className="flex items-center justify-center gap-1 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className="p-0 border-none bg-transparent cursor-pointer"
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-gs-accent' : i < step ? 'w-2 bg-gs-accent/40' : 'w-2 bg-gs-border-hover'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Step content with animation */}
        <div key={step} className={slideClass} style={{ animationDuration: '0.25s' }}>
          {/* Step icon */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gs-accent to-gs-indigo flex items-center justify-center mx-auto mb-4 text-white">
            {ICON_MAP[current.icon] || <span className="text-xl font-bold">{step + 1}</span>}
          </div>

          <h3 className="text-[16px] font-bold text-gs-text text-center mb-2">
            {current.title}
          </h3>
          <p className="text-[13px] text-gs-muted text-center leading-relaxed mb-2">
            {current.description}
          </p>

          {/* Interactive hint */}
          {current.interactive && current.target && (
            <p className="text-[11px] text-gs-accent text-center mb-1 animate-pulse">
              Click the highlighted element to continue
            </p>
          )}
        </div>

        {/* Step counter */}
        <p className="text-[11px] text-gs-dim text-center mb-5">
          Step {step + 1} of {STEPS.length}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={dismiss}
              className="text-[12px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted transition-colors"
            >
              Skip tour
            </button>

            {/* Jump to step menu */}
            <div className="relative">
              <button
                onClick={() => setJumpMenuOpen(!jumpMenuOpen)}
                className="text-[11px] text-gs-dim bg-transparent border border-gs-border rounded px-1.5 py-0.5 cursor-pointer hover:text-gs-muted hover:border-gs-accent transition-colors"
                aria-label="Jump to step"
              >
                #{step + 1}
              </button>
              {jumpMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-gs-card border border-gs-border rounded-lg shadow-xl py-1 min-w-[160px] max-h-[200px] overflow-y-auto" style={{ zIndex: 2502 }}>
                  {STEPS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => goToStep(i)}
                      className={`w-full text-left px-3 py-1.5 text-[11px] border-none cursor-pointer transition-colors ${
                        i === step
                          ? 'bg-gs-accent/10 text-gs-accent font-bold'
                          : 'bg-transparent text-gs-muted hover:bg-gs-surface hover:text-gs-text'
                      }`}
                    >
                      <span className="text-gs-dim mr-1">{i + 1}.</span> {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="gs-btn-secondary px-3.5 py-2 rounded-lg text-[12px] font-semibold"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="gs-btn-gradient px-4 py-2 rounded-lg text-[12px] font-bold"
            >
              {step < STEPS.length - 1 ? 'Next' : "Let's Go!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
