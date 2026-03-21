// Confetti animation — plays on first purchase or special achievements.
// Improvements: celebration types (confetti, fireworks, sparkles, vinyl rain), configurable colors,
// sound effects on celebration, and custom emoji confetti.
import { useEffect, useState, useRef } from 'react';

const DEFAULT_COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
const FIREWORK_COLORS = ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'];
const SPARKLE_COLORS = ['#fbbf24', '#fde68a', '#ffffff', '#fcd34d', '#f59e0b'];

// --- Sound effects ---
const SOUND_EFFECTS = {
  confetti: { frequency: 800, duration: 0.15, type: 'sine', ramp: true },
  fireworks: { frequency: 200, duration: 0.4, type: 'sawtooth', ramp: true },
  sparkles: { frequency: 1200, duration: 0.1, type: 'sine', ramp: false },
  vinyl: { frequency: 400, duration: 0.3, type: 'triangle', ramp: true },
  emoji: { frequency: 600, duration: 0.2, type: 'sine', ramp: true },
};

function playCelebrationSound(effectType = 'confetti') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const effect = SOUND_EFFECTS[effectType] || SOUND_EFFECTS.confetti;

    // Play a short burst of notes for a celebration feel
    const notes = effectType === 'fireworks'
      ? [200, 400, 600]
      : effectType === 'sparkles'
        ? [1200, 1400, 1600, 1800]
        : [523, 659, 784]; // C5, E5, G5 — major chord

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = effect.type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.08);
      if (effect.ramp) {
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + effect.duration);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + effect.duration + 0.05);
    });

    // Close context after all sounds finish
    setTimeout(() => ctx.close(), 2000);
  } catch {
    // Audio not available — silently ignore
  }
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function generateConfetti(colors, count = 50) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    type: 'confetti',
    x: randomBetween(10, 90),
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: randomBetween(0, 0.5),
    size: randomBetween(6, 12),
    drift: randomBetween(-40, 40),
    rotation: randomBetween(0, 360),
    duration: randomBetween(2, 3.5),
  }));
}

function generateFireworks(colors, count = 40) {
  // Multiple burst origins
  const bursts = [
    { cx: 30, cy: 30 },
    { cx: 70, cy: 25 },
    { cx: 50, cy: 40 },
  ];
  return Array.from({ length: count }, (_, i) => {
    const burst = bursts[i % bursts.length];
    const angle = (i / count) * 360;
    return {
      id: i,
      type: 'firework',
      cx: burst.cx,
      cy: burst.cy,
      angle,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: (Math.floor(i / (count / bursts.length))) * 0.4,
      distance: randomBetween(60, 150),
      size: randomBetween(3, 6),
      duration: randomBetween(0.8, 1.4),
    };
  });
}

function generateSparkles(colors, count = 35) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    type: 'sparkle',
    x: randomBetween(5, 95),
    y: randomBetween(5, 80),
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: randomBetween(0, 1.5),
    size: randomBetween(4, 10),
    duration: randomBetween(0.6, 1.2),
  }));
}

function generateVinylRain(colors, count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    type: 'vinyl',
    x: randomBetween(5, 95),
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: randomBetween(0, 1.2),
    size: randomBetween(16, 32),
    duration: randomBetween(2, 4),
    spin: randomBetween(360, 1080),
  }));
}

// --- Custom emoji confetti generator ---
function generateEmojiConfetti(emojis, count = 40) {
  const emojiList = emojis && emojis.length > 0 ? emojis : ['🎉', '🎊', '🥳', '✨', '🎸', '🎵'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    type: 'emoji',
    x: randomBetween(5, 95),
    emoji: emojiList[Math.floor(Math.random() * emojiList.length)],
    delay: randomBetween(0, 0.8),
    size: randomBetween(16, 32),
    rotation: randomBetween(0, 360),
    duration: randomBetween(2, 4),
  }));
}

export default function Confetti({
  active,
  duration = 3000,
  type = 'confetti',
  colors,
  sound = false,
  emojis = null, // Array of emoji strings for 'emoji' type, e.g. ['🎉', '🔥']
}) {
  const [particles, setParticles] = useState([]);
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (!active) {
      soundPlayed.current = false;
      return;
    }

    // Play sound effect
    if (sound && !soundPlayed.current) {
      soundPlayed.current = true;
      playCelebrationSound(type);
    }

    let generated;
    switch (type) {
      case 'fireworks':
        generated = generateFireworks(colors || FIREWORK_COLORS);
        break;
      case 'sparkles':
        generated = generateSparkles(colors || SPARKLE_COLORS);
        break;
      case 'vinyl':
        generated = generateVinylRain(colors || DEFAULT_COLORS);
        break;
      case 'emoji':
        generated = generateEmojiConfetti(emojis);
        break;
      default:
        generated = generateConfetti(colors || DEFAULT_COLORS);
    }
    setParticles(generated);

    const timer = setTimeout(() => setParticles([]), duration);
    return () => clearTimeout(timer);
  }, [active, duration, type, colors, sound, emojis]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[3000] pointer-events-none overflow-hidden" aria-hidden="true">
      {particles.map(p => {
        if (p.type === 'confetti') {
          return (
            <div
              key={p.id}
              className="absolute gs-confetti-fall"
              style={{
                left: `${p.x}%`,
                top: '-10px',
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                borderRadius: '2px',
                transform: `rotate(${p.rotation}deg)`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          );
        }
        if (p.type === 'firework') {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.distance;
          const ty = Math.sin(rad) * p.distance;
          return (
            <div
              key={p.id}
              className="absolute rounded-full gs-firework-burst"
              style={{
                left: `${p.cx}%`,
                top: `${p.cy}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                '--fw-tx': `${tx}px`,
                '--fw-ty': `${ty}px`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          );
        }
        if (p.type === 'sparkle') {
          return (
            <div
              key={p.id}
              className="absolute gs-sparkle-pop"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill={p.color}>
                <path d="M12 0l3 9h9l-7.5 5.5L19.5 24 12 18l-7.5 6 3-9.5L0 9h9z" />
              </svg>
            </div>
          );
        }
        if (p.type === 'vinyl') {
          return (
            <div
              key={p.id}
              className="absolute gs-vinyl-rain"
              style={{
                left: `${p.x}%`,
                top: '-40px',
                width: p.size,
                height: p.size,
                '--vinyl-spin': `${p.spin}deg`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              <svg width={p.size} height={p.size} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke={p.color} strokeWidth="1.5" fill="#1a1a2e" />
                <circle cx="12" cy="12" r="4" stroke={p.color} strokeWidth="1" fill={p.color} fillOpacity="0.3" />
                <circle cx="12" cy="12" r="1.5" fill={p.color} />
              </svg>
            </div>
          );
        }
        if (p.type === 'emoji') {
          return (
            <div
              key={p.id}
              className="absolute gs-emoji-fall"
              style={{
                left: `${p.x}%`,
                top: '-40px',
                fontSize: `${p.size}px`,
                transform: `rotate(${p.rotation}deg)`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            >
              {p.emoji}
            </div>
          );
        }
        return null;
      })}
      <style>{`
        .gs-confetti-fall {
          animation: gsConfettiFall 3s ease-out forwards;
          opacity: 0;
        }
        @keyframes gsConfettiFall {
          0% { opacity: 1; transform: translateY(0) translateX(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) translateX(40px) rotate(720deg); }
        }
        .gs-firework-burst {
          animation: gsFireworkBurst 1s ease-out forwards;
          opacity: 0;
        }
        @keyframes gsFireworkBurst {
          0% { opacity: 1; transform: translate(0, 0) scale(1); }
          70% { opacity: 1; transform: translate(var(--fw-tx), var(--fw-ty)) scale(1.2); }
          100% { opacity: 0; transform: translate(var(--fw-tx), var(--fw-ty)) scale(0); }
        }
        .gs-sparkle-pop {
          animation: gsSparkle 1s ease-out forwards;
          opacity: 0;
        }
        @keyframes gsSparkle {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.3) rotate(180deg); }
          100% { opacity: 0; transform: scale(0) rotate(360deg); }
        }
        .gs-vinyl-rain {
          animation: gsVinylRain 3s ease-in forwards;
          opacity: 0;
        }
        @keyframes gsVinylRain {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(var(--vinyl-spin)); }
        }
        .gs-emoji-fall {
          animation: gsEmojiFall 3s ease-out forwards;
          opacity: 0;
        }
        @keyframes gsEmojiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          50% { opacity: 1; transform: translateY(50vh) rotate(180deg) scale(1.2); }
          100% { opacity: 0; transform: translateY(100vh) rotate(360deg) scale(0.8); }
        }
      `}</style>
    </div>
  );
}
