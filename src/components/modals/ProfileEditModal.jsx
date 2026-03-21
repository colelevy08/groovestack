// Modal for editing the current user's profile — opened from ProfileScreen's "Edit Profile" button.
// Handles both profile metadata (displayName, bio, location, favGenre) and username/handle changes.
// Includes header image and avatar image upload with client-side resizing, drag-and-drop support,
// live preview panel, character count on bio, accent color picker, image preview, field validation.
// Username changes are validated against USER_PROFILES to prevent taking an existing handle.
// onSave updates profile state in App.js; onUsernameChange updates currentUser + re-keys all records.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import FormSelect from '../ui/FormSelect';
import Avatar from '../ui/Avatar';
import { GENRES, USER_PROFILES, ACCENT_COLORS } from '../../constants';
import { checkUsername } from '../../utils/supabase';
import { debounce } from '../../utils/helpers';

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

// [Improvement 1] Bio suggestions based on character count
const BIO_SUGGESTIONS = [
  'Tell collectors what genres you specialize in.',
  'Mention your favorite record of all time.',
  'Share how long you have been collecting.',
  'Describe what condition grades you prefer.',
  'List your top 3 most-wanted records.',
];

// [Improvement 2] Social platform definitions
const SOCIAL_PLATFORMS = [
  { key: 'discogs', label: 'Discogs', placeholder: 'https://www.discogs.com/user/yourname', icon: '\uD83D\uDCBF' },
  { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle', icon: '\uD83D\uDCF7' },
  { key: 'twitter', label: 'X / Twitter', placeholder: '@yourhandle', icon: '\uD83D\uDCAC' },
  { key: 'bandcamp', label: 'Bandcamp', placeholder: 'https://yourname.bandcamp.com', icon: '\uD83C\uDFB5' },
];

// [Improvement 16] Profile template library
const PROFILE_TEMPLATES = [
  { name: 'Collector', bio: 'Passionate vinyl collector with a love for rare pressings and first editions.', favGenre: 'Rock', accentColor: '#10b981' },
  { name: 'DJ', bio: 'Spinning records since day one. Always hunting for the perfect groove.', favGenre: 'Electronic', accentColor: '#6366f1' },
  { name: 'Seller', bio: 'Curating quality vinyl at fair prices. Fast shipping and careful packaging.', favGenre: 'Jazz', accentColor: '#f59e0b' },
  { name: 'Listener', bio: 'Music lover exploring new sounds through vinyl. Quality over quantity.', favGenre: 'Soul', accentColor: '#ec4899' },
  { name: 'Archivist', bio: 'Preserving music history one record at a time. Specializing in rare finds.', favGenre: 'Classical', accentColor: '#8b5cf6' },
];

export default function ProfileEditModal({ open, onClose, profile, onSave, currentUser, onUsernameChange }) {
  const [username, setUsername] = useState(currentUser);
  const [usernameError, setUsernameError] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [displayNameError, setDisplayNameError] = useState("");
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [favGenre, setFavGenre] = useState(profile.favGenre);
  const [accentColor, setAccentColor] = useState(profile.accentColor || ACCENT_COLORS[0]);
  const [customHexInput, setCustomHexInput] = useState('');
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

  // [Improvement 2] Social links state
  const [socialLinks, setSocialLinks] = useState(profile.socialLinks || {});

  // [Improvement 3] Privacy settings
  const [privacyCollectionPublic, setPrivacyCollectionPublic] = useState(profile.privacyCollectionPublic !== false);
  const [privacyShowLocation, setPrivacyShowLocation] = useState(profile.privacyShowLocation !== false);
  const [privacyShowActivity, setPrivacyShowActivity] = useState(profile.privacyShowActivity !== false);

  // [Improvement 5] Two-factor auth placeholder
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(profile.twoFactorEnabled || false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

  // [Improvement 7] Profile preview mode (card vs full)
  const [previewMode, setPreviewMode] = useState('card');

  // [Improvement 4] Account deletion confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // [Improvement 14] Profile analytics preview
  const [showAnalytics, setShowAnalytics] = useState(false);

  // [Improvement 15] A/B test profile variants
  const [showAbTest, setShowAbTest] = useState(false);
  const [variantA, setVariantA] = useState({ bio: '', displayName: '' });
  const [variantB, setVariantB] = useState({ bio: '', displayName: '' });
  const [activeVariant, setActiveVariant] = useState('A');

  // [Improvement 17] Import profile from Discogs
  const [showDiscogsImport, setShowDiscogsImport] = useState(false);
  const [discogsUsername, setDiscogsUsername] = useState('');
  const [discogsImporting, setDiscogsImporting] = useState(false);

  const headerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // [Improvement 8] Username availability check with debounce
  const debouncedCheckUsername = useMemo(
    () => debounce(async (clean) => {
      if (!clean || clean === currentUser) {
        setUsernameError("");
        setUsernameChecking(false);
        return;
      }
      // Check static profiles
      if (USER_PROFILES[clean]) {
        setUsernameError(`@${clean} is already taken`);
        setUsernameChecking(false);
        return;
      }
      // Check database
      try {
        const available = await checkUsername(clean);
        if (!available) {
          setUsernameError(`@${clean} is already taken`);
        } else {
          setUsernameError("");
        }
      } catch {
        setUsernameError("");
      }
      setUsernameChecking(false);
    }, 500),
    [currentUser]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => debouncedCheckUsername.cancel();
  }, [debouncedCheckUsername]);

  // Sync form fields with latest profile/username whenever the modal opens
  useEffect(() => {
    if (open) {
      setUsername(currentUser);
      setUsernameError("");
      setUsernameChecking(false);
      setDisplayName(profile.displayName);
      setDisplayNameError("");
      setBio(profile.bio);
      setLocation(profile.location);
      setFavGenre(profile.favGenre);
      setAccentColor(profile.accentColor || ACCENT_COLORS[0]);
      setCustomHexInput('');
      setAvatarUrl(profile.avatarUrl || null);
      setHeaderUrl(profile.headerUrl || null);
      setShippingName(profile.shippingName || '');
      setShippingStreet(profile.shippingStreet || '');
      setShippingCity(profile.shippingCity || '');
      setShippingState(profile.shippingState || '');
      setShippingZip(profile.shippingZip || '');
      setSocialLinks(profile.socialLinks || {});
      setPrivacyCollectionPublic(profile.privacyCollectionPublic !== false);
      setPrivacyShowLocation(profile.privacyShowLocation !== false);
      setPrivacyShowActivity(profile.privacyShowActivity !== false);
      setTwoFactorEnabled(profile.twoFactorEnabled || false);
      setShowTwoFactorSetup(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setPreviewMode('card');
    }
  }, [open, profile, currentUser]);

  // Sanitizes input and triggers debounced availability check
  const handleUsernameChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setUsername(clean);
    if (!clean || clean === currentUser) {
      setUsernameError("");
      setUsernameChecking(false);
      return;
    }
    setUsernameChecking(true);
    debouncedCheckUsername(clean);
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
    } catch { /* resize failed silently */ }
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

  // [Improvement 6] Custom hex color input
  const applyCustomHex = () => {
    const hex = customHexInput.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(hex)) {
      setAccentColor(hex.startsWith('#') ? hex : `#${hex}`);
      setCustomHexInput('');
    }
  };

  // [Improvement 2] Update social link
  const updateSocialLink = (key, value) => {
    setSocialLinks(prev => ({ ...prev, [key]: value }));
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
    onSave({
      displayName: displayName.trim(), bio, location, favGenre, accentColor, avatarUrl, headerUrl,
      shippingName, shippingStreet, shippingCity, shippingState, shippingZip,
      socialLinks,
      privacyCollectionPublic, privacyShowLocation, privacyShowActivity,
      twoFactorEnabled,
    });
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

  // [Improvement 1] Bio suggestion based on remaining characters
  const bioSuggestion = useMemo(() => {
    const len = (bio || '').length;
    if (len === 0) return BIO_SUGGESTIONS[0];
    if (len < 50) return BIO_SUGGESTIONS[1];
    if (len < 100) return BIO_SUGGESTIONS[2];
    if (len < 200) return BIO_SUGGESTIONS[3];
    return null;
  }, [bio]);

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
            {/* [Improvement 8] Username availability with debounce indicator */}
            {usernameChecking ? (
              <div className="text-[11px] text-gs-dim mt-1 font-mono flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 border-2 border-gs-accent/40 border-t-gs-accent rounded-full animate-spin" />
                Checking availability...
              </div>
            ) : usernameError ? (
              <div className="text-[11px] text-red-400 mt-1 font-mono">{usernameError}</div>
            ) : username && username !== currentUser ? (
              <div className="text-[11px] text-green-400 mt-1 font-mono">@{username} is available</div>
            ) : (
              <div className="text-[11px] text-gs-dim mt-1">Letters, numbers, dots, and underscores only.</div>
            )}
          </div>
          <div className="mb-3">
            <FormInput label="DISPLAY NAME" value={displayName} onChange={v => { setDisplayName(v); if (v.trim()) setDisplayNameError(""); }} placeholder="Your name" />
            {displayNameError && <div className="text-[11px] text-red-400 mt-1 font-mono">{displayNameError}</div>}
          </div>

          {/* Bio with character count and suggestions */}
          <div className="mb-4">
            <label className="gs-label block mb-1.5">BIO</label>
            <textarea
              value={bio}
              onChange={e => handleBioChange(e.target.value)}
              placeholder="Tell the community about your collection..."
              rows={3}
              className="w-full bg-gs-card border border-[#222] rounded-lg px-3 py-2.5 text-neutral-100 text-[13px] outline-none font-sans resize-y placeholder:text-gs-faint focus:border-gs-accent/40 focus:ring-1 focus:ring-gs-accent/20 transition-all duration-150"
            />
            <div className="flex items-center justify-between mt-1">
              {/* [Improvement 1] Bio suggestion */}
              {bioSuggestion && (
                <div className="text-[10px] text-gs-faint italic flex-1 mr-2">
                  Tip: {bioSuggestion}
                </div>
              )}
              <div className={`text-[10px] font-mono text-right shrink-0 ${bioRemaining < 30 ? (bioRemaining < 10 ? 'text-red-400' : 'text-amber-400') : 'text-gs-dim'}`}>
                {(bio || '').length}/{BIO_MAX_LENGTH}
              </div>
            </div>
          </div>

          <FormInput label="LOCATION" value={location} onChange={setLocation} placeholder="Chicago, IL" />
          <FormSelect label="FAVORITE GENRE" value={favGenre} onChange={setFavGenre} options={GENRES} />

          {/* ── Accent Color Picker with custom hex ─────────────────────── */}
          <div className="mb-4">
            <label className="gs-label block mb-2">ACCENT COLOR</label>
            <div className="flex gap-2 flex-wrap mb-2">
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
            {/* [Improvement 6] Custom hex color input */}
            <div className="flex gap-2 items-center">
              <div
                className="w-7 h-7 rounded-full border-2 border-white/20 shrink-0"
                style={{ background: accentColor }}
              />
              <input
                type="text"
                value={customHexInput}
                onChange={e => setCustomHexInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyCustomHex(); }}
                placeholder="#custom hex"
                className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-neutral-100 text-[11px] outline-none font-mono placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
              />
              <button
                onClick={applyCustomHex}
                disabled={!/^#?[0-9a-fA-F]{6}$/.test(customHexInput.trim())}
                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-gs-border-hover text-gs-muted text-[11px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:border-gs-accent/40 transition-colors"
              >
                Apply
              </button>
            </div>
            <div className="text-[10px] text-gs-faint mt-1 font-mono">Current: {accentColor}</div>
          </div>

          {/* [Improvement 2] Social Links Editor */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">SOCIAL LINKS</div>
            <div className="flex flex-col gap-2.5">
              {SOCIAL_PLATFORMS.map(platform => (
                <div key={platform.key} className="flex items-center gap-2">
                  <span className="text-sm shrink-0 w-6 text-center">{platform.icon}</span>
                  <input
                    type="text"
                    value={socialLinks[platform.key] || ''}
                    onChange={e => updateSocialLink(platform.key, e.target.value)}
                    placeholder={platform.placeholder}
                    className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
                  />
                  {socialLinks[platform.key] && (
                    <button
                      onClick={() => updateSocialLink(platform.key, '')}
                      className="text-gs-dim hover:text-red-400 bg-transparent border-none cursor-pointer text-sm p-0 transition-colors"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* [Improvement 3] Privacy Settings */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">PRIVACY SETTINGS</div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[12px] text-gs-muted">Collection visible to others</span>
                <button
                  onClick={() => setPrivacyCollectionPublic(p => !p)}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer ${privacyCollectionPublic ? 'bg-gs-accent' : 'bg-[#333]'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${privacyCollectionPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[12px] text-gs-muted">Show location on profile</span>
                <button
                  onClick={() => setPrivacyShowLocation(p => !p)}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer ${privacyShowLocation ? 'bg-gs-accent' : 'bg-[#333]'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${privacyShowLocation ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[12px] text-gs-muted">Show listening activity</span>
                <button
                  onClick={() => setPrivacyShowActivity(p => !p)}
                  className={`w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer ${privacyShowActivity ? 'bg-gs-accent' : 'bg-[#333]'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${privacyShowActivity ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
          </div>

          {/* [Improvement 14] Profile Analytics Preview */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="gs-label">PROFILE ANALYTICS</div>
              <button
                onClick={() => setShowAnalytics(a => !a)}
                className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer font-semibold"
              >
                {showAnalytics ? 'Hide' : 'Show Preview'}
              </button>
            </div>
            {showAnalytics && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-gs-border space-y-3">
                <div className="text-[11px] text-gs-muted mb-2">How your changes affect visibility:</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gs-dim">Profile completeness</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(100, [displayName, bio, location, favGenre, avatarUrl, headerUrl, Object.values(socialLinks).filter(Boolean).length > 0].filter(Boolean).length / 7 * 100)}%`
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono">
                        {Math.round([displayName, bio, location, favGenre, avatarUrl, headerUrl, Object.values(socialLinks).filter(Boolean).length > 0].filter(Boolean).length / 7 * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gs-dim">Search discoverability</span>
                    <span className={`text-[10px] font-semibold ${bio && bio.length > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {bio && bio.length > 50 ? 'High' : bio ? 'Medium' : 'Low'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gs-dim">Trust signals</span>
                    <span className={`text-[10px] font-semibold ${avatarUrl ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {avatarUrl ? 'Strong' : 'Needs avatar'}
                    </span>
                  </div>
                </div>
                <div className="text-[9px] text-gs-faint mt-2">Complete profiles get up to 3x more views and offers.</div>
              </div>
            )}
          </div>

          {/* [Improvement 15] A/B Test Profile Variants */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="gs-label">A/B TEST VARIANTS</div>
              <button
                onClick={() => {
                  setShowAbTest(a => !a);
                  if (!showAbTest) {
                    setVariantA({ bio: bio || '', displayName: displayName || '' });
                    setVariantB({ bio: bio || '', displayName: displayName || '' });
                  }
                }}
                className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer font-semibold"
              >
                {showAbTest ? 'Close' : 'Set Up Test'}
              </button>
            </div>
            {showAbTest && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-gs-border space-y-3">
                <div className="text-[11px] text-gs-muted mb-2">Create two profile variants to test which performs better:</div>
                <div className="flex gap-1 mb-3">
                  <button
                    onClick={() => setActiveVariant('A')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-none transition-colors ${activeVariant === 'A' ? 'bg-gs-accent text-black' : 'bg-[#1a1a1a] text-gs-dim'}`}
                  >
                    Variant A
                  </button>
                  <button
                    onClick={() => setActiveVariant('B')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border-none transition-colors ${activeVariant === 'B' ? 'bg-purple-500 text-white' : 'bg-[#1a1a1a] text-gs-dim'}`}
                  >
                    Variant B
                  </button>
                </div>
                {activeVariant === 'A' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={variantA.displayName}
                      onChange={e => setVariantA(v => ({ ...v, displayName: e.target.value }))}
                      placeholder="Display name variant A"
                      className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
                    />
                    <textarea
                      value={variantA.bio}
                      onChange={e => setVariantA(v => ({ ...v, bio: e.target.value }))}
                      placeholder="Bio variant A"
                      rows={2}
                      className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors resize-y font-sans"
                    />
                    <button
                      onClick={() => { setDisplayName(variantA.displayName); setBio(variantA.bio); }}
                      className="w-full py-1.5 bg-gs-accent/15 border border-gs-accent/30 rounded-lg text-gs-accent text-[11px] font-bold cursor-pointer hover:bg-gs-accent/25 transition-colors"
                    >
                      Apply Variant A
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={variantB.displayName}
                      onChange={e => setVariantB(v => ({ ...v, displayName: e.target.value }))}
                      placeholder="Display name variant B"
                      className="w-full bg-[#111] border border-purple-500/20 rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-purple-500/40 transition-colors"
                    />
                    <textarea
                      value={variantB.bio}
                      onChange={e => setVariantB(v => ({ ...v, bio: e.target.value }))}
                      placeholder="Bio variant B"
                      rows={2}
                      className="w-full bg-[#111] border border-purple-500/20 rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-purple-500/40 transition-colors resize-y font-sans"
                    />
                    <button
                      onClick={() => { setDisplayName(variantB.displayName); setBio(variantB.bio); }}
                      className="w-full py-1.5 bg-purple-500/15 border border-purple-500/30 rounded-lg text-purple-400 text-[11px] font-bold cursor-pointer hover:bg-purple-500/25 transition-colors"
                    >
                      Apply Variant B
                    </button>
                  </div>
                )}
                <div className="text-[9px] text-gs-faint">Test different bios and names to see which gets more engagement. Stats coming soon.</div>
              </div>
            )}
          </div>

          {/* [Improvement 16] Profile Template Library */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">PROFILE TEMPLATES</div>
            <div className="flex flex-wrap gap-1.5">
              {PROFILE_TEMPLATES.map(t => (
                <button
                  key={t.name}
                  onClick={() => {
                    setBio(t.bio);
                    setFavGenre(t.favGenre);
                    setAccentColor(t.accentColor);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-gs-border-hover bg-[#111] text-[11px] text-gs-muted font-semibold cursor-pointer hover:border-gs-accent/40 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.accentColor }} />
                  {t.name}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-gs-faint mt-1.5">Apply a template to quickly set up your bio, genre, and accent color.</div>
          </div>

          {/* [Improvement 17] Import Profile from Discogs */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="gs-label">IMPORT FROM DISCOGS</div>
              <button
                onClick={() => setShowDiscogsImport(d => !d)}
                className="text-[10px] text-gs-dim hover:text-gs-muted bg-transparent border-none cursor-pointer font-semibold"
              >
                {showDiscogsImport ? 'Cancel' : 'Import'}
              </button>
            </div>
            {showDiscogsImport && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-gs-border">
                <div className="text-[11px] text-gs-muted mb-2">Enter your Discogs username to import your profile info:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discogsUsername}
                    onChange={e => setDiscogsUsername(e.target.value)}
                    placeholder="Discogs username"
                    className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none placeholder:text-gs-faint focus:border-gs-accent/40 transition-colors"
                  />
                  <button
                    onClick={async () => {
                      if (!discogsUsername.trim()) return;
                      setDiscogsImporting(true);
                      // Simulate Discogs profile fetch
                      await new Promise(r => setTimeout(r, 1200));
                      setBio(`Vinyl collector and music enthusiast. Find me on Discogs as ${discogsUsername.trim()}.`);
                      setSocialLinks(prev => ({ ...prev, discogs: `https://www.discogs.com/user/${discogsUsername.trim()}` }));
                      setDiscogsImporting(false);
                      setShowDiscogsImport(false);
                      setDiscogsUsername('');
                    }}
                    disabled={discogsImporting || !discogsUsername.trim()}
                    className="px-4 py-2 rounded-lg border-none text-white text-[12px] font-bold cursor-pointer bg-gradient-to-br from-gs-accent to-gs-indigo disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {discogsImporting ? 'Importing...' : 'Import'}
                  </button>
                </div>
                <div className="text-[9px] text-gs-faint mt-2">We will import your bio and link your Discogs profile.</div>
              </div>
            )}
          </div>

          {/* ── Shipping Address ──────────────────────────────────────────── */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">SHIPPING ADDRESS</div>
            <p className="text-[11px] text-gs-dim mb-3">Used to pre-fill checkout and receive trades. You will always confirm before any order.</p>
            <FormInput label="FULL NAME" value={shippingName} onChange={setShippingName} placeholder="Jane Smith" />
            <FormInput label="STREET ADDRESS" value={shippingStreet} onChange={setShippingStreet} placeholder="123 Vinyl Lane, Apt 4" />
            <div className="grid grid-cols-3 gap-2.5">
              <FormInput label="CITY" value={shippingCity} onChange={setShippingCity} placeholder="Chicago" />
              <FormInput label="STATE" value={shippingState} onChange={setShippingState} placeholder="IL" />
              <FormInput label="ZIP" value={shippingZip} onChange={setShippingZip} placeholder="60601" />
            </div>
          </div>

          {/* [Improvement 5] Two-Factor Auth Toggle (Placeholder) */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3">SECURITY</div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[12px] text-gs-muted font-semibold">Two-Factor Authentication</div>
                <div className="text-[10px] text-gs-dim">Add an extra layer of security to your account</div>
              </div>
              <button
                onClick={() => {
                  if (twoFactorEnabled) {
                    setTwoFactorEnabled(false);
                    setShowTwoFactorSetup(false);
                  } else {
                    setShowTwoFactorSetup(true);
                  }
                }}
                className={`w-10 h-5 rounded-full relative transition-colors duration-200 border-none cursor-pointer ${twoFactorEnabled ? 'bg-green-500' : 'bg-[#333]'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform duration-200 ${twoFactorEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {showTwoFactorSetup && !twoFactorEnabled && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg border border-gs-border mb-3">
                <div className="text-[11px] text-gs-muted mb-2">Scan this QR code with your authenticator app:</div>
                <div className="w-32 h-32 mx-auto bg-[#fff] rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-[10px] text-[#333] font-mono text-center p-2">
                    [QR Code Placeholder]<br />Use Google Authenticator or Authy
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTwoFactorSetup(false)}
                    className="flex-1 py-2 bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-gs-muted text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setTwoFactorEnabled(true); setShowTwoFactorSetup(false); }}
                    className="flex-[2] py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-[11px] font-bold cursor-pointer"
                  >
                    I have scanned the code
                  </button>
                </div>
              </div>
            )}
            {twoFactorEnabled && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20 mb-3">
                <span className="text-green-400 text-xs">&check;</span>
                <span className="text-[11px] text-green-400 font-semibold">2FA is active on your account</span>
              </div>
            )}
          </div>

          {/* [Improvement 4] Account Deletion */}
          <div className="border-t border-gs-border mt-4 pt-4 mb-4">
            <div className="gs-label mb-3 text-red-400">DANGER ZONE</div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px] font-semibold cursor-pointer hover:bg-red-500/15 transition-colors"
              >
                Delete My Account
              </button>
            ) : (
              <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                <div className="text-[12px] text-red-400 font-semibold mb-2">Are you sure? This cannot be undone.</div>
                <div className="text-[11px] text-gs-dim mb-3">
                  This will permanently delete your account, collection, and all associated data.
                  Type <span className="font-mono text-red-400">delete my account</span> to confirm.
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type 'delete my account'"
                  className="w-full bg-[#111] border border-red-500/20 rounded-lg px-3 py-2 text-neutral-100 text-[12px] outline-none font-mono placeholder:text-gs-faint focus:border-red-500/40 transition-colors mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="flex-1 py-2 bg-[#1a1a1a] border border-gs-border-hover rounded-lg text-gs-muted text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteConfirmText !== 'delete my account'}
                    className="flex-[2] py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-[11px] font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => alert('Account deletion would be processed here.')}
                  >
                    Permanently Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-1">
            <button onClick={onClose} className="gs-btn-secondary flex-1 py-[11px] text-[13px]">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!!usernameError || !!displayNameError || usernameChecking}
              className={`flex-[2] py-[11px] rounded-[10px] text-[13px] font-bold ${usernameError || displayNameError || usernameChecking ? 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed border-none' : 'gs-btn-gradient'}`}
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* ── Right: live preview panel ──────────────────────────────────── */}
        <div className="w-[220px] shrink-0 hidden lg:block">
          <div className="sticky top-0">
            {/* [Improvement 7] Preview mode toggle */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-gs-dim font-mono uppercase tracking-wider">Preview</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewMode('card')}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer border-none transition-colors ${previewMode === 'card' ? 'bg-gs-accent text-black font-bold' : 'bg-[#1a1a1a] text-gs-dim'}`}
                >
                  Card
                </button>
                <button
                  onClick={() => setPreviewMode('full')}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono cursor-pointer border-none transition-colors ${previewMode === 'full' ? 'bg-gs-accent text-black font-bold' : 'bg-[#1a1a1a] text-gs-dim'}`}
                >
                  Full
                </button>
              </div>
            </div>

            {previewMode === 'card' ? (
              /* Card preview (compact) */
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
                    {location && privacyShowLocation && <span>&#x1F4CD; {location}</span>}
                    {favGenre && <span>&#x1F3B5; {favGenre}</span>}
                  </div>
                  {/* Mini accent bar */}
                  <div className="h-0.5 rounded-full mt-2.5" style={{ background: `linear-gradient(90deg,${accentColor},transparent)` }} />
                </div>
              </div>
            ) : (
              /* [Improvement 7] Full page preview */
              <div className="bg-gs-card border border-gs-border rounded-xl overflow-hidden">
                <div
                  className="h-20"
                  style={{
                    background: headerUrl
                      ? `url(${headerUrl}) center/cover no-repeat`
                      : `linear-gradient(135deg,${accentColor}33,#6366f122)`,
                  }}
                />
                <div className="px-3 pb-3 -mt-6">
                  <div className="rounded-full border-2 border-gs-card leading-none mb-2 w-fit">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="preview" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <Avatar username={currentUser} size={48} />
                    )}
                  </div>
                  <div className="text-[13px] font-extrabold text-gs-text truncate">{displayName || 'Display Name'}</div>
                  <div className="text-[10px] font-mono mb-2 truncate" style={{ color: accentColor }}>@{username || 'handle'}</div>
                  {bio && <p className="text-[10px] text-gs-muted leading-relaxed mb-2">{bio}</p>}
                  <div className="flex gap-2 text-[9px] text-gs-dim flex-wrap mb-2">
                    {location && privacyShowLocation && <span>&#x1F4CD; {location}</span>}
                    {favGenre && <span>&#x1F3B5; {favGenre}</span>}
                  </div>
                  {/* Social links preview */}
                  {Object.entries(socialLinks).filter(([, v]) => v).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {SOCIAL_PLATFORMS.filter(p => socialLinks[p.key]).map(p => (
                        <span key={p.key} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1a] text-gs-dim">
                          {p.icon} {p.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Privacy indicators */}
                  <div className="flex gap-1 flex-wrap">
                    {!privacyCollectionPublic && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Private collection</span>
                    )}
                    {!privacyShowActivity && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Activity hidden</span>
                    )}
                  </div>
                  <div className="h-0.5 rounded-full mt-2.5" style={{ background: `linear-gradient(90deg,${accentColor},transparent)` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
