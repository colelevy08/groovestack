// Empty-state placeholder for empty lists.
export default function Empty({ icon, text, action, actionLabel }) {
  return (
    <div className="text-center py-16 text-gs-faint">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-sm mb-5">{text}</div>
      {action && (
        <button onClick={action} className="gs-btn-gradient px-5 py-2.5 text-[13px]">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
