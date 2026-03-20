// Onboarding tour — 4-step tooltip walkthrough for new users.
// Shows once per user, stored in localStorage. Each step highlights a key feature.
import { useState, useEffect } from 'react';

const STEPS = [
  {
    title: 'Welcome to GrooveStack!',
    description: 'Your vinyl record collection hub. Browse, collect, trade, and connect with fellow crate diggers.',
    position: 'center',
  },
  {
    title: 'Browse the Marketplace',
    description: 'Discover records from the community. Filter by genre, condition, and price to find your next gem.',
    position: 'center',
  },
  {
    title: 'Build Your Collection',
    description: 'Add records to your crate with AI-powered vinyl verification. Track condition, value, and listening history.',
    position: 'center',
  },
  {
    title: 'Connect & Trade',
    description: 'Follow other collectors, make offers on wishlisted records, and chat with the community. Happy digging!',
    position: 'center',
  },
];

export default function OnboardingTour({ currentUser }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const key = `gs_onboarded_${currentUser}`;
    if (!localStorage.getItem(key)) {
      // Small delay so the app has time to render first
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const dismiss = () => {
    setVisible(false);
    if (currentUser) {
      localStorage.setItem(`gs_onboarded_${currentUser}`, '1');
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[2500] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="bg-gs-surface border border-gs-border rounded-2xl p-6 max-w-sm w-[90vw] shadow-2xl animate-modal-in">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-gs-accent' : i < step ? 'w-1.5 bg-gs-accent/40' : 'w-1.5 bg-gs-border-hover'
              }`}
            />
          ))}
        </div>

        {/* Step icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gs-accent to-gs-indigo flex items-center justify-center mx-auto mb-4">
          <span className="text-xl text-white font-bold">{step + 1}</span>
        </div>

        <h3 className="text-[16px] font-bold text-gs-text text-center mb-2">
          {current.title}
        </h3>
        <p className="text-[13px] text-gs-muted text-center leading-relaxed mb-6">
          {current.description}
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
