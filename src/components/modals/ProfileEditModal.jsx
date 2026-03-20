// Modal for editing the current user's profile — opened from ProfileScreen's "Edit Profile" button.
// Handles both profile metadata (displayName, bio, location, favGenre) and username/handle changes.
// Includes header image and avatar image upload with client-side resizing, drag-and-drop support,
// live preview panel, character count on bio, accent color picker, image preview, field validation.
// Username changes are validated against USER_PROFILES to prevent taking an existing handle.
// onSave updates profile state in App.js; onUsernameChange updates currentUser + re-keys all records.
import { useState, useEffect, useRef, useCallback } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import Avatar from '../ui/Avatar';
import { GENRES, USER_PROFILES, ACCENT_COLORS } from '../../constants';
import { checkUsername } from '../../utils/supabase';

// ── Client-side image resize — reads file, draws to canvas, returns data URL ──
function resizeImage(file, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BIO_MAX_LENGTH = 300;

export default function ProfileEditModal({ open, onClose, profile, onSave, currentUser, onUsernameChange }) {
  const [username, setUsername] = useState(currentUser);
  const [usernameError, setUsernameError] = useState("");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [displayNameError, setDisplayNameError] = useState("");
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [favGenre, setFavGenre] = useState(profile.favGenre);
  const [accentColor, setAccentColor] = useState(profile.accentColor || ACCENT_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || null);
  const [headerUrl, setHeaderUrl] = useState(profile.headerUrl || null);
  const [shippingName, setShippingName] = useState(profile.shippingName || '');
  const [shippingStreet, setShippingStreet] = useState(profile.shippingStreet || '');
  const [shippingCity, setShippingCity] = useState(profile.shippingCity || '');
  const [shippingState, setShippingState] = useState(profile.shippingState || '');
  const [shippingZip, setShippingZip] = useState(profile.shippingZip || '');
  const [headerHover, setHeaderHover] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const [headerDragOver, setHeaderDragOver] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);

  const headerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Sync form fields with latest profile/username whenever the modal opens
  useEffect(() => {
    if (open) {
      setUsername(currentUser);
      setUsernameError("");
      setDisplayName(profile.displayName);
      setDisplayNameError("");
      setBio(profile.bio);
      setLocation(profile.location);
      setFavGenre(profile.favGenre);
      setAccentColor(profile.accentColor || ACCENT_COLORS[0]);
      setAvatarUrl(profile.avatarUrl || null);
      setHeaderUrl(profile.headerUrl || null);
      setShippingName(profile.shippingName || '');
      setShippingStreet(profile.shippingStreet || '');
      setShippingCity(profile.shippingCity || '');
      setShippingState(profile.shippingState || '');
      setShippingZip(profile.shippingZip || '');
    }
  }, [open, profile, currentUser]);

  // Sanitizes input to lowercase alphanumeric + dots + underscores; checks for conflicts with existing profiles
  const handleUsernameChange = async (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setUsername(clean);
    if (!clean || clean === currentUser) { setUsernameError(""); return; }
    // Check static profiles
    if (USER_PROFILES[clean]) { setUsernameError(`@${clean} is already taken`); return; }
    // Check database
    const available = await checkUsername(clean);
    if (!available) { setUsernameError(`@${clean} is already taken`); return; }
    setUsernameError("");
  };

  const handleImageFile = useCallback(async (file, type) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5242880) { alert('Image must be under 5MB'); return; }
    try {
      if (type === 'header') {
        setHeaderUrl(await resizeImage(file, 800, 200));
      } else {
        setAvatarUrl(await resizeImage(file, 128, 128));
      }
    } catch {}
  }, []);

  const handleHeaderFile = async e => {
    const file = e.target.files?.[0];
    await handleImageFile(file, 'header');
    e.target.value = '';
  };

  const handleAvatarFile = async e => {
    const file = e.target.files?.[0];
    await handleImageFile(file, 'avatar');
    e.target.value = '';
  };

  // ── Drag-and-drop handlers ────────────────────────────────────────────
  const handleDrop = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'header') setHeaderDragOver(false);
    else setAvatarDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file, type);
  }, [handleImageFile]);

  const handleDragOver = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'header') setHeaderDragOver(true);
    else setAvatarDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e, type) => {
    e.preventDefault();
    if (type === 'header') setHeaderDragOver(false);
    else setAvatarDragOver(false);
  }, []);

  // ── Bio with character limit ──────────────────────────────────────────
  const handleBioChange = (val) => {
    if (val.length <= BIO_MAX_LENGTH) setBio(val);
  };

  // ── Validation + save ────────────────────────────────────────────────
  const handleSave = () => {
    // Validate display name
    if (!displayName.trim()) {
      setDisplayNameError("Display name cannot be empty");
      return;
    }
    setDisplayNameError("");

    // Validate username format
    if (username && !/^[a-z0-9._]{2,30}$/.test(username)) {
      setUsernameError("Username must be 2-30 characters: letters, numbers, dots, underscores");
      return;
    }

    if (usernameError) return;
    onSave({ displayName: displayName.trim(), bio, location, favGenre, accentColor, avatarUrl, headerUrl, shippingName, shippingStreet, shippingCity, shippingState, shippingZip });
    if (username && username !== currentUser) {
      onUsernameChange(username);
    }
    onClose();
  };

  const cameraIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );

  const bioRemaining = BIO_MAX_LENGTH - (bio || '').length;

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      <div className="flex gap-6">
        {/* ── Left: form fields ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Hidden file inputs */}
          <input ref={headerInputRef} type="file" accept="image/*" onChange={handleHeaderFile} className="hidden" />
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />

          {/* ── Image upload preview with drag-and-drop ──────────────────── */}
          <div className="mb-5 rounded-xl overflow-hidden border border-gs-border">
            {/* Header image area */}
            <div
              onClick={() => headerInputRef.current?.click()}
              onMouseEnter={() => setHeaderHover(true)}
              onMouseLeave={() => setHeaderHover(false)}
              onDrop={e => handleDrop(e, 'header')}
              onDragOver={e => handleDragOver(e, 'header')}
              onDragLeave={e => handleDragLeave(e, 'header')}
              className={`h-[100px] cursor-pointer relative transition-all duration-200 ${headerDragOver ? 'ring-2 ring-gs-accent ring-inset' : ''}`}
              style={{
                background: headerUrl
                  ? `url(${headerUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg,#0ea5e922,#6366f115)",
              }}
            >
              <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-colors duration-200 text-white text-[11px] font-semibold ${headerHover || headerDragOver ? 'bg-black/55' : 'bg-transparent'}`}>
                {(headerHover || headerDragOver) && (
                  <>
                    {cameraIcon}
                    <span>{headerDragOver ? "Drop image here" : headerUrl ? "Change Header" : "Add Header"}</span>
                  </>
                )}
              </div>
            </div>

            {/* Avatar area — overlapping header bottom */}
            <div className="px-3.5 pb-3 -mt-7 flex items-end gap-3">
              <div
                onClick={() => avatarInputRef.current?.click()}
                onMouseEnter={() => setAvatarHover(true)}
                onMouseLeave={() => setAvatarHover(false)}
                onDrop={e => handleDrop(e, 'avatar')}
                onDragOver={e => handleDragOver(e, 'avatar')}
                onDragLeave={e => handleDragLeave(e, 'avatar')}
                className={`w-16 h-16 rounded-full cursor-pointer relative border-[3px] border-[#111] overflow-hidden shrink-0 flex items-center justify-center transition-all duration-200 ${avatarDragOver ? 'ring-2 ring-gs-accent' : ''}`}
                style={{
                  background: avatarUrl ? "none" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-extrabold text-white">{currentUser.slice(0, 2).toUpperCase()}</span>
                )}
                <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-200 text-white rounded-full ${avatarHover || avatarDragOver ? 'bg-black/55' : 'bg-transparent'}`}>
                  {(avatarHover || avatarDragOver) && cameraIcon}
                </div>
              </div>
              <div className="flex-1 flex gap-2 pb-1 flex-wrap">
                {avatarUrl && (
                  <button onClick={e => { e.stopPropagation(); setAvatarUrl(null); }} className="bg-transparent border-none text-gs-dim text-[10px] cursor-pointer p-0 hover:text-red-400 transition-colors">
                    Reset avatar
                  </button>
                )}
                {headerUrl && (
                  <button onClick={e => { e.stopPropagation(); setHeaderUrl(null); }} className="bg-transparent border-none text-gs-dim text-[10px] cursor-pointer p-0 hover:text-red-400 transition-colors">
                    Reset header
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Text fields ──────────────────────────────────────────────── */}
          <div className="mb-3">
            <FormInput
              label="USERNAME (@handle)"
              value={username}
              onChange={handleUsernameChange}
              placeholder="yourhandle"
            />
            {usernameError
              ? <div className="text-[11px] text-red-400 mt-1 font-mono">{usernameError}</div>
              : <div className="text-[11px] text-gs-dim mt-1">Letters, numbers, dots, and underscores only.</div>
            }
          </div>
          <div className="mb-3">
            <FormInput label="DISPLAY NAME" value={displayName} onChange={v => { setDisplayName(v); if (v.trim()) setDisplayNameError(""); }} placeholder="Your name" />
            {displayNameError && <div className="text-[11px] text-red-400 mt-1 font-mono">{displayNameError}</div>}
          </div>

          {/* Bio with character count */}
          <div className="mb-4">
            <label className="gs-label block mb-1.5">BIO</label>
            <textarea
              value={bio}
              onChange={e => handleBioChange(e.target.value)}
              placeholder="Tell the community about your collection..."
              rows={3}
              className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans resize-y placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
            />
            <div className={`text-[10px] font-mono mt-1 text-right ${bioRemaining < 30 ? (bioRemaining < 10 ? 'text-red-400' : 'text-amber-400') : 'text-gs-dim'}`}>
              {(bio || '').length}/{BIO_MAX_LENGTH}
            </div>
          </div>

          <FormInput label="LOCATION" value={location} onChange={setLocation} placeholder="Chicago, IL" />
          <FormSelect label="FAVORITE GENRE" value={favGenre} onChange={setFavGenre} options={GENRES} />

          {/* ── Accent Color Picker ─────────────────────────────────────── */}
          <div className="mb-4">
            <label className="gs-label block mb-2">ACCENT COLOR</label>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-all duration-150 hover:scale-110 ${accentColor === color ? 'border-white scale-110 ring-2 ring-white/20' : 'border-transparent'}`}
                  style={{ background: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* ── Shipping Address ──────────────────────────────────────────── */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">SHIPPING ADDRESS</div>
            <p className="text-[11px] text-gs-dim mb-3">Used to pre-fill checkout and receive trades. You'll always confirm before any order.</p>
            <FormInput label="FULL NAME" value={shippingName} onChange={setShippingName} placeholder="Jane Smith" />
            <FormInput label="STREET ADDRESS" value={shippingStreet} onChange={setShippingStreet} placeholder="123 Vinyl Lane, Apt 4" />
            <div className="grid grid-cols-3 gap-2.5">
              <FormInput label="CITY" value={shippingCity} onChange={setShippingCity} placeholder="Chicago" />
              <FormInput label="STATE" value={shippingState} onChange={setShippingState} placeholder="IL" />
              <FormInput label="ZIP" value={shippingZip} onChange={setShippingZip} placeholder="60601" />
            </div>
          </div>

          <div className="flex gap-2.5 mt-1">
            <button onClick={onClose} className="gs-btn-secondary flex-1 py-[11px] text-[13px]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!!usernameError || !!displayNameError}
              className={`flex-[2] py-[11px] rounded-[10px] text-[13px] font-bold ${usernameError || displayNameError ? 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed border-none' : 'gs-btn-gradient'}`}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* ── Right: live preview panel ──────────────────────────────────── */}
        <div className="w-[220px] shrink-0 hidden lg:block">
          <div className="sticky top-0">
            <div className="text-[10px] text-gs-dim font-mono uppercase tracking-wider mb-2">Preview</div>
            <div className="bg-gs-card border border-gs-border rounded-xl overflow-hidden">
              {/* Mini header */}
              <div
                className="h-12"
                style={{
                  background: headerUrl
                    ? `url(${headerUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg,${accentColor}33,#6366f122)`,
                }}
              />
              <div className="px-3 pb-3 -mt-4">
                <div className="rounded-full border-2 border-gs-card leading-none mb-2 w-fit">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="preview" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <Avatar username={currentUser} size={32} />
                  )}
                </div>
                <div className="text-[11px] font-extrabold text-gs-text truncate">{displayName || 'Display Name'}</div>
                <div className="text-[9px] font-mono mb-1.5 truncate" style={{ color: accentColor }}>@{username || 'handle'}</div>
                {bio && <p className="text-[9px] text-gs-muted leading-relaxed line-clamp-3 mb-2">{bio}</p>}
                <div className="flex gap-2 text-[9px] text-gs-dim flex-wrap">
                  {location && <span>📍 {location}</span>}
                  {favGenre && <span>🎵 {favGenre}</span>}
                </div>
                {/* Mini accent bar */}
                <div className="h-0.5 rounded-full mt-2.5" style={{ background: `linear-gradient(90deg,${accentColor},transparent)` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
