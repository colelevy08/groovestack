// 5-star rating display. Filled stars are amber; empty stars are dim.
// Pass onRate to make the stars interactive (used in AddRecordModal for setting a rating).
export default function Stars({ rating, onRate, size = 12 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg
          key={s} width={size} height={size} viewBox="0 0 24 24"
          fill={s <= rating ? "#f59e0b" : "none"}
          stroke={s <= rating ? "#f59e0b" : "#444"}
          strokeWidth="2"
          style={{ cursor: onRate ? "pointer" : "default" }}
          onClick={() => onRate && onRate(s)}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  );
}
