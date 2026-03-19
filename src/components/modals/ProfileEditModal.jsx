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
    try { setHeaderUrl(await resizeImage(file, 800, 200)); } catch {}
    e.target.value = '';
  };

  const handleAvatarFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setAvatarUrl(await resizeImage(file, 128, 128)); } catch {}
    e.target.value = '';
  };

  // Saves profile fields, then triggers username change separately if the handle was modified
  const handleSave = () => {
    if (usernameError) return;
    onSave({ displayName, bio, location, favGenre, avatarUrl, headerUrl });
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
      <input ref={headerInputRef} type="file" accept="image/*" onChange={handleHeaderFile} style={{ display: "none" }} />
      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{ display: "none" }} />

      {/* ── Image upload preview ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e" }}>
        {/* Header image area */}
        <div
          onClick={() => headerInputRef.current?.click()}
          onMouseEnter={() => setHeaderHover(true)}
          onMouseLeave={() => setHeaderHover(false)}
          style={{
            height: 100, cursor: "pointer", position: "relative",
            background: headerUrl
              ? `url(${headerUrl}) center/cover no-repeat`
              : "linear-gradient(135deg,#0ea5e922,#6366f115)",
          }}
        >
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: headerHover ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
            transition: "background 0.2s", color: "#fff", fontSize: 11, fontWeight: 600,
          }}>
            {headerHover && <>{cameraIcon} {headerUrl ? "Change Header" : "Add Header"}</>}
          </div>
        </div>

        {/* Avatar area — overlapping header bottom */}
        <div style={{ padding: "0 14px 12px", marginTop: -28, display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            style={{
              width: 64, height: 64, borderRadius: "50%", cursor: "pointer", position: "relative",
              border: "3px solid #111", overflow: "hidden", flexShrink: 0,
              background: avatarUrl ? "none" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{currentUser.slice(0, 2).toUpperCase()}</span>
            )}
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: avatarHover ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
              transition: "background 0.2s", color: "#fff", borderRadius: "50%",
            }}>
              {avatarHover && cameraIcon}
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 8, paddingBottom: 4 }}>
            {avatarUrl && (
              <button onClick={e => { e.stopPropagation(); setAvatarUrl(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 10, cursor: "pointer", padding: 0 }}>
                Remove photo
              </button>
            )}
            {headerUrl && (
              <button onClick={e => { e.stopPropagation(); setHeaderUrl(null); }} style={{ background: "none", border: "none", color: "#555", fontSize: 10, cursor: "pointer", padding: 0 }}>
                Remove header
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Text fields ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <FormInput
          label="USERNAME (@handle)"
          value={username}
          onChange={handleUsernameChange}
          placeholder="yourhandle"
        />
        {usernameError
          ? <div style={{ fontSize: 11, color: "#f87171", marginTop: 4, fontFamily: "'DM Mono',monospace" }}>{usernameError}</div>
          : <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Letters, numbers, dots, and underscores only.</div>
        }
      </div>
      <FormInput label="DISPLAY NAME" value={displayName} onChange={setDisplayName} placeholder="Your name" />
      <FormTextarea label="BIO" value={bio} onChange={setBio} placeholder="Tell the community about your collection..." />
      <FormInput label="LOCATION" value={location} onChange={setLocation} placeholder="Chicago, IL" />
      <FormSelect label="FAVORITE GENRE" value={favGenre} onChange={setFavGenre} options={GENRES} />
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 11, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button
          onClick={handleSave}
          disabled={!!usernameError}
          style={{ flex: 2, padding: 11, background: usernameError ? "#1a1a1a" : "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 10, color: usernameError ? "#555" : "#fff", fontSize: 13, fontWeight: 700, cursor: usernameError ? "not-allowed" : "pointer" }}
        >
          Save Changes
        </button>
      </div>
    </Modal>
  );
}
