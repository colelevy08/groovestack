// Onboarding tour — 10-step tooltip walkthrough for new users.
// Improvements: 10 total steps, progress persistence, skip/back navigation, step animations.
import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    title: 'Welcome to GrooveStack!',
    description: 'Your vinyl record collection hub. Browse, collect, trade, and connect with fellow crate diggers.',
    icon: 'wave',
  },
  {
    title: 'Browse the Marketplace',
    description: 'Discover records from the community. Filter by genre, condition, and price to find your next gem.',
    icon: 'search',
  },
  {
    title: 'AI Vinyl Verification',
    description: 'Snap a photo of any record and our AI will identify it, grade its condition, and estimate its value.',
    icon: 'camera',
  },
  {
    title: 'Build Your Collection',
    description: 'Add records to your crate and organize them by genre, artist, or custom tags. Track every spin.',
    icon: 'vinyl',
  },
  {
    title: 'Wishlist & Alerts',
    description: 'Add records to your wishlist and get notified when they appear in the marketplace at your price.',
    icon: 'bell',
  },
  {
    title: 'Make & Receive Offers',
    description: 'Negotiate prices directly with sellers. Submit offers, counter-offer, and close deals in-app.',
    icon: 'handshake',
  },
  {
    title: 'Connect with Collectors',
    description: 'Follow other collectors, see what they are spinning, and discover records through their collections.',
    icon: 'people',
  },
  {
    title: 'Chat & Community',
    description: 'Message other collectors, join genre-specific groups, and share your latest finds with the community.',
    icon: 'chat',
  },
  {
    title: 'Track Value Over Time',
    description: 'Watch your collection value grow with real-time market data. See trends, gains, and top performers.',
    icon: 'chart',
  },
  {
    title: 'You are All Set!',
    description: 'Start exploring the marketplace or add your first record. Happy digging and welcome to the groove!',
    icon: 'rocket',
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

  const dismiss = useCallback(() => {
    setVisible(false);
    if (currentUser) {
      localStorage.setItem(`gs_onboarded_${currentUser}`, '1');
      localStorage.removeItem(`gs_onboard_step_${currentUser}`);
    }
  }, [currentUser]);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setAnimDir('next');
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    if (step > 0) {
      setAnimDir('prev');
      setStep(s => s - 1);
    }
  }, [step]);

  const goToStep = useCallback((i) => {
    setAnimDir(i > step ? 'next' : 'prev');
    setStep(i);
  }, [step]);

  if (!visible) return null;

  const current = STEPS[step];
  const slideClass = animDir === 'next'
    ? 'animate-slide-in-right'
    : 'animate-slide-in-left';

  return (
    <div className="fixed inset-0 z-[2500] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="bg-gs-surface border border-gs-border rounded-2xl p-6 max-w-sm w-[90vw] shadow-2xl animate-modal-in">
        {/* Progress dots — clickable */}
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
        </div>

        {/* Step counter */}
        <p className="text-[11px] text-gs-dim text-center mb-5">
          Step {step + 1} of {STEPS.length}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-[12px] text-gs-dim bg-transparent border-none cursor-pointer hover:text-gs-muted transition-colors"
          >
            Skip tour
          </button>
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
