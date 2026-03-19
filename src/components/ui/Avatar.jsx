// Circular user avatar — shows a custom image (via src prop), profile avatarUrl, or initials as fallback.
// Looks up the user's accent color and avatarUrl from USER_PROFILES via getProfile.
// Dims on hover when an onClick handler is provided (e.g., to open a user profile).
import { getProfile, getInitials } from '../../utils/helpers';

export default function Avatar({ username, size = 34, onClick, src }) {
  const p = getProfile(username);
  const accent = p.accent || "#0ea5e9";
  const initials = getInitials(username) || (p.displayName || username).slice(0, 2).toUpperCase();

  // Use explicit src first, then fall back to profile avatarUrl
  const imgSrc = src || p.avatarUrl;

  const baseStyle = {
    width: size, height: size, borderRadius: "50%",
    cursor: onClick ? "pointer" : "default", flexShrink: 0,
    transition: "opacity 0.15s", overflow: "hidden",
  };

  if (imgSrc) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={e => { if (onClick) e.currentTarget.style.opacity = "0.75"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
        style={baseStyle}
      >
        <img src={imgSrc} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.opacity = "0.75"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
      style={{
        ...baseStyle,
        background: accent + "22", border: `1.5px solid ${accent}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.33, fontWeight: 700, color: accent,
        fontFamily: "'DM Mono',monospace",
      }}
    >
      {initials}
    </div>
  );
}
