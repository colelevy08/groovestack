// Confetti animation — plays on first purchase or special achievements.
// Self-cleans after animation completes.
import { useEffect, useState } from 'react';

const COLORS = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export default function Confetti({ active, duration = 3000 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) return;

    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: randomBetween(10, 90),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: randomBetween(0, 0.5),
      size: randomBetween(6, 12),
      drift: randomBetween(-40, 40),
      rotation: randomBetween(0, 360),
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[3000] pointer-events-none overflow-hidden" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall ${randomBetween(2, 3.5)}s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) translateX(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) translateX(${randomBetween(-60, 60)}px) rotate(720deg); }
        }
      `}</style>
    </div>
  );
}
