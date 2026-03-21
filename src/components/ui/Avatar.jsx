// Circular user avatar — shows a custom image (via src prop), profile avatarUrl, or initials as fallback.
// Looks up the user's accent color and avatarUrl from USER_PROFILES via getProfile.
// Supports online status indicator, size variants, hover card preview, gradient fallback,
// group avatar stacking, edit overlay, loading skeleton, avatar upload with crop,
// and activity-based ring color.
import { useState, useRef, useCallback } from 'react';
import { getProfile, getInitials } from '../../utils/helpers';

const SIZE_MAP = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

// Activity status ring colors
const ACTIVITY_RING_COLORS = {
  active: '#22c55e',     // green
  idle: '#eab308',       // yellow
  dnd: '#ef4444',        // red
  offline: '#555',       // gray
  streaming: '#a855f7',  // purple
  recording: '#ef4444',  // red (pulsing)
};

// Generate a consistent gradient based on username
function usernameGradient(username) {
  if (!username) return ['#333', '#555'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return [`hsl(${h1}, 60%, 35%)`, `hsl(${h2}, 60%, 45%)`];
}

// Avatar group stacking component
export function AvatarGroup({ users, max = 4, size, sizeVariant = 'sm', onOverflowClick }) {
  const displayed = users.slice(0, max);
  const overflow = users.length - max;
  const resolvedSize = sizeVariant ? (SIZE_MAP[sizeVariant] || SIZE_MAP.sm) : (size || 28);

  return (
    <div className="flex items-center" style={{ paddingLeft: resolvedSize * 0.3 }}>
      {displayed.map((user, i) => (
        <div
          key={typeof user === 'string' ? user : user.username}
          className="relative rounded-full border-2 border-gs-bg"
          style={{
            marginLeft: i === 0 ? 0 : -(resolvedSize * 0.3),
            zIndex: displayed.length - i,
          }}
        >
          <Avatar
            username={typeof user === 'string' ? user : user.username}
            src={typeof user === 'object' ? user.src : undefined}
            sizeVariant={sizeVariant}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative rounded-full border-2 border-gs-bg flex items-center justify-center bg-[#2a2a2a] text-gs-muted font-mono font-bold shrink-0"
          style={{
            width: resolvedSize,
            height: resolvedSize,
            marginLeft: -(resolvedSize * 0.3),
            zIndex: 0,
            fontSize: resolvedSize * 0.3,
            cursor: onOverflowClick ? 'pointer' : 'default',
          }}
          onClick={onOverflowClick}
          role={onOverflowClick ? 'button' : undefined}
          tabIndex={onOverflowClick ? 0 : undefined}
          onKeyDown={onOverflowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOverflowClick(e); } } : undefined}
          aria-label={`${overflow} more users`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// --- Improvement 16: Avatar Upload with Crop ---
export function AvatarUpload({
  username,
  currentSrc,
  onUpload, // (croppedFile: Blob, previewUrl: string) => void
  size = 64,
  sizeVariant,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cropMode, setCropMode] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const resolvedSize = sizeVariant ? (SIZE_MAP[sizeVariant] || SIZE_MAP.xl) : size;

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setOriginalImage(ev.target.result);
      setCropMode(true);
      setCropOffset({ x: 0, y: 0 });
      setCropScale(1);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCropConfirm = useCallback(() => {
    if (!originalImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    const img = new Image();
    img.onload = () => {
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();

      const scale = cropScale;
      const imgW = img.width * scale;
      const imgH = img.height * scale;
      const dx = (outputSize - imgW) / 2 + cropOffset.x * scale;
      const dy = (outputSize - imgH) / 2 + cropOffset.y * scale;

      ctx.drawImage(img, dx, dy, imgW, imgH);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setCropMode(false);
        onUpload?.(blob, url);
      }, 'image/png');
    };
    img.src = originalImage;
  }, [originalImage, cropOffset, cropScale, onUpload]);

  const handleCropCancel = useCallback(() => {
    setCropMode(false);
    setOriginalImage(null);
  }, []);

  const handleDragStart = useCallback((e) => {
    const startX = e.clientX || e.touches?.[0]?.clientX;
    const startY = e.clientY || e.touches?.[0]?.clientY;
    dragRef.current = { startX, startY, startOffset: { ...cropOffset } };
  }, [cropOffset]);

  const handleDragMove = useCallback((e) => {
    if (!dragRef.current) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    setCropOffset({
      x: dragRef.current.startOffset.x + dx,
      y: dragRef.current.startOffset.y + dy,
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const displaySrc = previewUrl || currentSrc;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className="relative cursor-pointer group"
        onClick={() => !cropMode && fileInputRef.current?.click()}
        style={{ width: resolvedSize, height: resolvedSize }}
      >
        <Avatar
          username={username}
          src={displaySrc}
          size={resolvedSize}
        />
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <svg width={resolvedSize * 0.3} height={resolvedSize * 0.3} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Crop overlay */}
      {cropMode && originalImage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[2000] animate-fade-in">
          <div className="bg-gs-surface rounded-xl p-5 shadow-2xl flex flex-col items-center gap-4 max-w-[90vw]">
            <h3 className="text-[14px] font-bold text-gs-text">Crop Avatar</h3>
            <div
              className="relative overflow-hidden rounded-full border-2 border-gs-border"
              style={{ width: 200, height: 200, cursor: 'grab' }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <img
                src={originalImage}
                alt="Crop preview"
                className="absolute select-none pointer-events-none"
                style={{
                  transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`,
                  transformOrigin: 'center center',
                  left: '50%',
                  top: '50%',
                  marginLeft: -100 * cropScale,
                  marginTop: -100 * cropScale,
                  width: 200 * cropScale,
                  height: 'auto',
                }}
                draggable="false"
              />
            </div>
            {/* Zoom slider */}
            <div className="flex items-center gap-2 w-full max-w-[200px]">
              <span className="text-[10px] text-gs-faint">-</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={cropScale}
                onChange={(e) => setCropScale(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-[10px] text-gs-faint">+</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCropCancel}
                className="gs-btn-secondary px-4 py-2 rounded-lg text-[12px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                className="gs-btn-gradient px-4 py-2 rounded-lg text-[12px] font-bold"
              >
                Apply
              </button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Avatar({
  username, size, onClick, src, sizeVariant, online, showHoverCard, editable, onEdit, loading,
  activityStatus, // Improvement 17: 'active' | 'idle' | 'dnd' | 'offline' | 'streaming' | 'recording'
}) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const p = getProfile(username);
  const accent = p.accent || "#0ea5e9";
  const initials = getInitials(username) || (p.displayName || username).slice(0, 2).toUpperCase();

  // Resolve size: named variant takes priority over raw size
  const resolvedSize = sizeVariant ? (SIZE_MAP[sizeVariant] || SIZE_MAP.md) : (size || 34);

  // Use explicit src first, then fall back to profile avatarUrl
  const imgSrc = src || p.avatarUrl;

  const [grad1, grad2] = usernameGradient(username);

  // Activity ring color
  const ringColor = activityStatus ? (ACTIVITY_RING_COLORS[activityStatus] || null) : null;
  const isRecording = activityStatus === 'recording';
  const ringWidth = Math.max(2, resolvedSize * 0.06);

  const baseStyle = {
    width: resolvedSize, height: resolvedSize, borderRadius: "50%",
    cursor: onClick || editable ? "pointer" : "default", flexShrink: 0,
    transition: "opacity 0.15s", overflow: "hidden",
    position: 'relative',
  };

  // Add ring styles if activity status is set
  const ringStyle = ringColor ? {
    boxShadow: `0 0 0 ${ringWidth}px ${ringColor}`,
    ...(isRecording ? { animation: 'avatarRingPulse 1.5s ease-in-out infinite' } : {}),
  } : {};

  const statusDotSize = Math.max(8, resolvedSize * 0.22);

  const StatusDot = online != null ? (
    <span
      className="absolute block rounded-full border-2 border-gs-bg"
      style={{
        width: statusDotSize,
        height: statusDotSize,
        bottom: 0,
        right: 0,
        background: online ? '#22c55e' : '#555',
      }}
      aria-label={online ? 'Online' : 'Offline'}
    />
  ) : null;

  const HoverCard = showHoverCard && hovered ? (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gs-card border border-gs-border rounded-lg px-3 py-1.5 shadow-xl z-50 whitespace-nowrap animate-fade-in pointer-events-none"
      role="tooltip"
    >
      <span className="text-[12px] font-semibold text-gs-text">
        {p.displayName || username}
      </span>
      <span className="text-[11px] text-gs-muted ml-1">@{username}</span>
      {activityStatus && (
        <span className="flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ringColor || '#555' }} />
          <span className="text-[10px] text-gs-faint capitalize">{activityStatus}</span>
        </span>
      )}
    </div>
  ) : null;

  // Edit overlay on hover when editable
  const EditOverlay = editable && hovered ? (
    <div
      className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center animate-fade-in"
      onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
      role="button"
      aria-label="Edit avatar"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(); } }}
    >
      <svg width={resolvedSize * 0.35} height={resolvedSize * 0.35} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    </div>
  ) : null;

  // Loading skeleton state
  if (loading) {
    return (
      <div
        style={{ width: resolvedSize, height: resolvedSize, borderRadius: '50%', flexShrink: 0 }}
        className="overflow-hidden"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  const wrapperProps = {
    onClick: editable ? onEdit : onClick,
    onMouseEnter: (e) => {
      if (onClick || editable) e.currentTarget.style.opacity = "0.75";
      if (showHoverCard || editable) setHovered(true);
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.opacity = "1";
      if (showHoverCard || editable) setHovered(false);
    },
    style: { ...baseStyle, ...ringStyle, display: 'inline-block', position: 'relative' },
  };

  if (imgSrc) {
    return (
      <div {...wrapperProps}>
        {/* Shimmer while image loads */}
        {!imgLoaded && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s ease-in-out infinite',
            }}
          />
        )}
        <img
          src={imgSrc}
          alt={`${p.displayName || username}'s avatar`}
          className={`w-full h-full object-cover block rounded-full transition-opacity duration-200 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
        />
        {EditOverlay}
        {StatusDot}
        {HoverCard}
        {/* Ring pulse animation keyframes */}
        {isRecording && (
          <style>{`
            @keyframes avatarRingPulse {
              0%, 100% { box-shadow: 0 0 0 ${ringWidth}px ${ringColor}; }
              50% { box-shadow: 0 0 0 ${ringWidth + 2}px ${ringColor}80, 0 0 8px ${ringColor}40; }
            }
          `}</style>
        )}
      </div>
    );
  }

  return (
    <div {...wrapperProps}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${grad1}, ${grad2})`,
          border: `1.5px solid ${accent}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: resolvedSize * 0.33, fontWeight: 700, color: '#fff',
          fontFamily: "'DM Mono',monospace",
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        {initials}
      </div>
      {EditOverlay}
      {StatusDot}
      {HoverCard}
      {isRecording && (
        <style>{`
          @keyframes avatarRingPulse {
            0%, 100% { box-shadow: 0 0 0 ${ringWidth}px ${ringColor}; }
            50% { box-shadow: 0 0 0 ${ringWidth + 2}px ${ringColor}80, 0 0 8px ${ringColor}40; }
          }
        `}</style>
      )}
    </div>
  );
}
