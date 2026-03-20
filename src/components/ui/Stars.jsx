// Star rating display. Filled stars are amber; empty stars are dim.
// Pass onRate to make the stars interactive (used in AddRecordModal for setting a rating).
// Supports half-star ratings (e.g., 3.5), hover preview, rating count display,
// animated fill on change, accessible labels per star, custom max rating, and size responsive variants.
import { useState, useRef, useEffect } from 'react';

// Improvement 10: Size responsive variants
const SIZE_VARIANTS = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};

export default function Stars({
  rating,
  onRate,
  size = 12,
  sizeVariant,
  count,
  showCount,
  maxStars = 5,  // Improvement 9: Custom max rating
  animated = true, // Improvement 7: Animated fill on change
}) {
  const [hoverRating, setHoverRating] = useState(null);
  const [animatingStars, setAnimatingStars] = useState(new Set());
  const prevRatingRef = useRef(rating);

  // Resolve size from variant or raw value
  const resolvedSize = sizeVariant ? (SIZE_VARIANTS[sizeVariant] || size) : size;

  const displayRating = hoverRating != null ? hoverRating : rating;

  // Improvement 7: Animate stars that changed fill state
  useEffect(() => {
    if (!animated || prevRatingRef.current === rating) return;
    const prev = prevRatingRef.current || 0;
    const newAnimating = new Set();
    const starCount = Math.max(Math.ceil(prev), Math.ceil(rating));
    for (let i = 1; i <= starCount; i++) {
      const wasFilled = prev >= i - 0.5;
      const isFilled = rating >= i - 0.5;
      if (wasFilled !== isFilled) {
        newAnimating.add(i);
      }
    }
    if (newAnimating.size > 0) {
      setAnimatingStars(newAnimating);
      const timer = setTimeout(() => setAnimatingStars(new Set()), 400);
      prevRatingRef.current = rating;
      return () => clearTimeout(timer);
    }
    prevRatingRef.current = rating;
  }, [rating, animated]);

  const handleMouseMove = (starIndex, e) => {
    if (!onRate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    setHoverRating(isHalf ? starIndex - 0.5 : starIndex);
  };

  const handleClick = (starIndex, e) => {
    if (!onRate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    onRate(isHalf ? starIndex - 0.5 : starIndex);
  };

  // Build array from 1 to maxStars
  const stars = Array.from({ length: maxStars }, (_, i) => i + 1);

  return (
    <div
      role={onRate ? 'radiogroup' : 'img'}
      aria-label={`${rating} out of ${maxStars} stars`}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverRating(null)}
    >
      {stars.map(s => {
        const fill = getFillType(s, displayRating);
        const isAnimating = animatingStars.has(s);

        // Improvement 8: Accessible label per star
        const starLabel = onRate
          ? `Rate ${s} out of ${maxStars} star${s !== 1 ? 's' : ''}`
          : `${s} star${s !== 1 ? 's' : ''}`;

        return (
          <svg
            key={s}
            width={resolvedSize}
            height={resolvedSize}
            viewBox="0 0 24 24"
            className={onRate ? "cursor-pointer" : "cursor-default"}
            onMouseMove={onRate ? (e) => handleMouseMove(s, e) : undefined}
            onClick={onRate ? (e) => handleClick(s, e) : undefined}
            role={onRate ? 'radio' : undefined}
            aria-checked={onRate ? fill === 'full' : undefined}
            aria-label={starLabel}
            tabIndex={onRate ? 0 : undefined}
            onKeyDown={onRate ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRate(s); }
              if (e.key === 'ArrowRight' && s < maxStars) { e.preventDefault(); onRate(s + 1); }
              if (e.key === 'ArrowLeft' && s > 1) { e.preventDefault(); onRate(s - 1); }
            } : undefined}
            style={{
              transition: 'transform 0.15s',
              transform: isAnimating ? 'scale(1.3)' : 'scale(1)',
              animation: isAnimating ? 'starPop 0.4s ease-out' : undefined,
            }}
            onMouseEnter={onRate ? (e) => { e.currentTarget.style.transform = 'scale(1.15)'; } : undefined}
            onMouseLeave={onRate ? (e) => { e.currentTarget.style.transform = isAnimating ? 'scale(1.3)' : 'scale(1)'; } : undefined}
          >
            <defs>
              <linearGradient id={`star-half-${s}`}>
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              fill={
                fill === 'full' ? '#f59e0b' :
                fill === 'half' ? `url(#star-half-${s})` :
                'none'
              }
              stroke={fill === 'empty' ? '#444' : '#f59e0b'}
              strokeWidth="2"
              style={{
                transition: 'fill 0.2s, stroke 0.2s',
              }}
            />
          </svg>
        );
      })}
      {showCount && count != null && (
        <span className="text-gs-muted text-[11px] font-mono ml-1.5">({count})</span>
      )}

      {/* Inline keyframes for star pop animation */}
      <style>{`
        @keyframes starPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.4); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function getFillType(starIndex, rating) {
  if (rating >= starIndex) return 'full';
  if (rating >= starIndex - 0.5) return 'half';
  return 'empty';
}
