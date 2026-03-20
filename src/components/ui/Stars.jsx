// 5-star rating display. Filled stars are amber; empty stars are dim.
// Pass onRate to make the stars interactive (used in AddRecordModal for setting a rating).
// Supports half-star ratings (e.g., 3.5), hover preview, and rating count display.
import { useState } from 'react';

export default function Stars({ rating, onRate, size = 12, count, showCount }) {
  const [hoverRating, setHoverRating] = useState(null);

  const displayRating = hoverRating != null ? hoverRating : rating;

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

  return (
    <div
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverRating(null)}
    >
      {[1, 2, 3, 4, 5].map(s => {
        const fill = getFillType(s, displayRating);
        return (
          <svg
            key={s}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={onRate ? "cursor-pointer" : "cursor-default"}
            onMouseMove={onRate ? (e) => handleMouseMove(s, e) : undefined}
            onClick={onRate ? (e) => handleClick(s, e) : undefined}
            style={{ transition: 'transform 0.1s' }}
            onMouseEnter={onRate ? (e) => { e.currentTarget.style.transform = 'scale(1.15)'; } : undefined}
            onMouseLeave={onRate ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
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
            />
          </svg>
        );
      })}
      {showCount && count != null && (
        <span className="text-gs-muted text-[11px] font-mono ml-1.5">({count})</span>
      )}
    </div>
  );
}

function getFillType(starIndex, rating) {
  if (rating >= starIndex) return 'full';
  if (rating >= starIndex - 0.5) return 'half';
  return 'empty';
}
