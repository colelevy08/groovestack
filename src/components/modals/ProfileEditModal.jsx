// Modal for editing the current user's profile — opened from ProfileScreen's "Edit Profile" button.
// Handles both profile metadata (displayName, bio, location, favGenre) and username/handle changes.
// Includes header image and avatar image upload with client-side resizing.
// Username changes are validated against USER_PROFILES to prevent taking an existing handle.
// onSave updates profile state in App.js; onUsernameChange updates currentUser + re-keys all records.
import { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import FormInput from '../ui/FormInput';
import FormTextarea from '../ui/FormTextarea';
import FormSelect from '../ui/FormSelect';
import { GENRES, USER_PROFILES } from '../../constants';
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

export default function ProfileEditModal({ open, onClose, profile, onSave, currentUser, onUsernameChange }) {
  const [username, setUsername] = useState(currentUser);
  const [usernameError, setUsernameError] = useState("");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [favGenre, setFavGenre] = useState(profile.favGenre);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || null);
  const [headerUrl, setHeaderUrl] = useState(profile.headerUrl || null);
  const [shippingName, setShippingName] = useState(profile.shippingName || '');
  const [shippingStreet, setShippingStreet] = useState(profile.shippingStreet || '');
  const [shippingCity, setShippingCity] = useState(profile.shippingCity || '');
  const [shippingState, setShippingState] = useState(profile.shippingState || '');
  const [shippingZip, setShippingZip] = useState(profile.shippingZip || '');
  const [headerHover, setHeaderHover] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);

  const headerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Sync form fields with latest profile/username whenever the modal opens
  useEffect(() => {
    if (open) {
      setUsername(currentUser);
      setUsernameError("");
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setLocation(profile.location);
      setFavGenre(profile.favGenre);
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

  const handleHeaderFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5242880) { alert('Image must be under 5MB'); e.target.value = ''; return; }
    try { setHeaderUrl(await resizeImage(file, 800, 200)); } catch {}
    e.target.value = '';
  };

  const handleAvatarFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5242880) { alert('Image must be under 5MB'); e.target.value = ''; return; }
    try { setAvatarUrl(await resizeImage(file, 128, 128)); } catch {}
    e.target.value = '';
  };

  // Saves profile fields, then triggers username change separately if the handle was modified
  const handleSave = () => {
    if (usernameError) return;
    onSave({ displayName, bio, location, favGenre, avatarUrl, headerUrl, shippingName, shippingStreet, shippingCity, shippingState, shippingZip });
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

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      {/* Hidden file inputs */}
      <input ref={headerInputRef} type="file" accept="image/*" onChange={handleHeaderFile} className="hidden" />
      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />

      {/* ── Image upload preview ─────────────────────────────────────────── */}
      <div className="mb-5 rounded-xl overflow-hidden border border-gs-border">
        {/* Header image area */}
        <div
          onClick={() => headerInputRef.current?.click()}
          onMouseEnter={() => setHeaderHover(true)}
          onMouseLeave={() => setHeaderHover(false)}
          className="h-[100px] cursor-pointer relative"
          style={{
            background: headerUrl
              ? `url(${headerUrl}) center/cover no-repeat`
              : "linear-gradient(135deg,#0ea5e922,#6366f115)",
          }}
        >
          <div className={`absolute inset-0 flex items-center justify-center gap-1.5 transition-colors duration-200 text-white text-[11px] font-semibold ${headerHover ? 'bg-black/55' : 'bg-transparent'}`}>
            {headerHover && <>{cameraIcon} {headerUrl ? "Change Header" : "Add Header"}</>}
          </div>
        </div>

        {/* Avatar area — overlapping header bottom */}
        <div className="px-3.5 pb-3 -mt-7 flex items-end gap-3">
          <div
            onClick={() => avatarInputRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            className="w-16 h-16 rounded-full cursor-pointer relative border-[3px] border-[#111] overflow-hidden shrink-0 flex items-center justify-center"
            style={{
              background: avatarUrl ? "none" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-extrabold text-white">{currentUser.slice(0, 2).toUpperCase()}</span>
            )}
            <div className={`absolute inset-0 flex items-center justify-center transition-colors duration-200 text-white rounded-full ${avatarHover ? 'bg-black/55' : 'bg-transparent'}`}>
              {avatarHover && cameraIcon}
            </div>
          </div>
          <div className="flex-1 flex gap-2 pb-1">
            {avatarUrl && (
              <button onClick={e => { e.stopPropagation(); setAvatarUrl(null); }} className="bg-transparent border-none text-gs-dim text-[10px] cursor-pointer p-0">
                Remove photo
              </button>
            )}
            {headerUrl && (
              <button onClick={e => { e.stopPropagation(); setHeaderUrl(null); }} className="bg-transparent border-none text-gs-dim text-[10px] cursor-pointer p-0">
                Remove header
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Text fields ──────────────────────────────────────────────────── */}
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
      <FormInput label="DISPLAY NAME" value={displayName} onChange={setDisplayName} placeholder="Your name" />
      <FormTextarea label="BIO" value={bio} onChange={setBio} placeholder="Tell the community about your collection..." />
      <FormInput label="LOCATION" value={location} onChange={setLocation} placeholder="Chicago, IL" />
      <FormSelect label="FAVORITE GENRE" value={favGenre} onChange={setFavGenre} options={GENRES} />

      {/* ── Shipping Address ─────────────────────────────────────────── */}
      <div className="border-t border-gs-border mt-4 pt-4 mb-4">
        <div className="gs-label mb-3">📦 SHIPPING ADDRESS</div>
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
          disabled={!!usernameError}
          className={`flex-[2] py-[11px] rounded-[10px] text-[13px] font-bold ${usernameError ? 'bg-[#1a1a1a] text-gs-dim cursor-not-allowed border-none' : 'gs-btn-gradient'}`}
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
}
