// Settings screen — account, notifications, privacy, appearance, shipping, devices, data, and about.
// Uses Toggle and FormInput from the ui folder. All state is local/demo since there is no backend for settings.
import { useState, useCallback } from 'react';
import Toggle from '../ui/Toggle';
import FormInput from '../ui/FormInput';

const ACCENT_OPTIONS = [
  { label: 'Blue',   value: '#0ea5e9' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink',   value: '#ec4899' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Amber',  value: '#f59e0b' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Orange', value: '#f97316' },
];

function SectionHeader({ title, icon }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-2">
      <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h2 className="text-sm font-bold text-gs-text tracking-tight">{title}</h2>
    </div>
  );
}

function SettingsCard({ children, className = '' }) {
  return (
    <div className={`bg-gs-card border border-gs-border rounded-[14px] p-4 mb-3 ${className}`}>
      {children}
    </div>
  );
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#111] last:border-b-0">
      <div className="flex-1 min-w-0 mr-4">
        <div className="text-[13px] font-semibold text-gs-text">{label}</div>
        {description && <div className="text-[11px] text-gs-dim mt-0.5 leading-normal">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsScreen({ currentUser, profile, deviceCode, vinylBuddyActivated }) {
  // ── Notification toggles ──
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [dmNotifs, setDmNotifs] = useState(true);

  // ── Privacy toggles ──
  const [publicProfile, setPublicProfile] = useState(true);
  const [showListening, setShowListening] = useState(true);

  // ── Appearance ──
  const [accent, setAccent] = useState(profile?.accent || '#0ea5e9');

  // ── Shipping ──
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [shippingSaved, setShippingSaved] = useState(false);

  // ── Change password ──
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // ── Data ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportStarted, setExportStarted] = useState(false);

  const handleSaveShipping = useCallback(() => {
    setShippingSaved(true);
    setTimeout(() => setShippingSaved(false), 2000);
  }, []);

  const handleExportData = useCallback(() => {
    setExportStarted(true);
    setTimeout(() => setExportStarted(false), 3000);
  }, []);

  return (
    <div className="max-w-[640px] gs-page-transition">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold tracking-tighter text-gs-text mb-1">Settings</h1>
        <p className="text-xs text-gs-dim">Manage your account, preferences, and connected devices</p>
      </div>

      {/* ── Account ──────────────────────────────────────────── */}
      <SectionHeader
        title="Account"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Username" description={`@${currentUser}`}>
          <span className="text-[11px] text-gs-faint font-mono">Cannot be changed</span>
        </SettingsRow>
        <SettingsRow label="Email" description={profile?.email || 'cole@groovestack.co'}>
          <span className="text-[11px] text-gs-accent font-mono">Verified</span>
        </SettingsRow>
        <SettingsRow label="Password">
          {!showPasswordForm ? (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
            >
              Change
            </button>
          ) : (
            <button
              onClick={() => setShowPasswordForm(false)}
              className="text-[11px] text-gs-dim bg-transparent border border-[#333] rounded-lg px-3 py-1.5 cursor-pointer hover:border-[#555] transition-colors"
            >
              Cancel
            </button>
          )}
        </SettingsRow>
        {showPasswordForm && (
          <div className="mt-3 pt-3 border-t border-[#111] space-y-0">
            <FormInput label="Current Password" type="password" value={currentPw} onChange={setCurrentPw} placeholder="Enter current password" />
            <FormInput label="New Password" type="password" value={newPw} onChange={setNewPw} placeholder="Enter new password" />
            <FormInput
              label="Confirm New Password"
              type="password"
              value={confirmPw}
              onChange={setConfirmPw}
              placeholder="Confirm new password"
              error={confirmPw && confirmPw !== newPw ? 'Passwords do not match' : ''}
            />
            <button
              disabled={!currentPw || !newPw || newPw !== confirmPw}
              className={`text-xs font-bold py-2.5 px-5 rounded-lg transition-all ${
                currentPw && newPw && newPw === confirmPw
                  ? 'gs-btn-gradient cursor-pointer text-white'
                  : 'bg-[#1a1a1a] text-gs-dim cursor-default'
              }`}
            >
              Update Password
            </button>
          </div>
        )}
      </SettingsCard>

      {/* ── Notifications ────────────────────────────────────── */}
      <SectionHeader
        title="Notifications"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Email Notifications" description="Receive updates about sales, offers, and followers">
          <Toggle on={emailNotifs} onToggle={() => setEmailNotifs(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Push Notifications" description="Browser push notifications for real-time alerts">
          <Toggle on={pushNotifs} onToggle={() => setPushNotifs(v => !v)} />
        </SettingsRow>
        <SettingsRow label="DM Notifications" description="Get notified when someone sends you a direct message">
          <Toggle on={dmNotifs} onToggle={() => setDmNotifs(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Privacy ──────────────────────────────────────────── */}
      <SectionHeader
        title="Privacy"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Public Profile" description="Allow anyone to view your profile and collection">
          <Toggle on={publicProfile} onToggle={() => setPublicProfile(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Show Listening Activity" description="Display what you're currently playing via Vinyl Buddy">
          <Toggle on={showListening} onToggle={() => setShowListening(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Appearance ───────────────────────────────────────── */}
      <SectionHeader
        title="Appearance"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" /><circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>}
      />
      <SettingsCard>
        <div className="text-[13px] font-semibold text-gs-text mb-3">Accent Color</div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setAccent(opt.value)}
              className={`w-9 h-9 rounded-full border-2 cursor-pointer transition-all duration-200 hover:scale-110 ${
                accent === opt.value ? 'border-white scale-110 shadow-lg' : 'border-transparent'
              }`}
              style={{
                background: opt.value,
                boxShadow: accent === opt.value ? `0 0 12px ${opt.value}66` : 'none',
              }}
              title={opt.label}
            />
          ))}
        </div>
        <div className="mt-3 text-[11px] text-gs-dim">
          Selected: <span className="font-bold font-mono" style={{ color: accent }}>{ACCENT_OPTIONS.find(o => o.value === accent)?.label || accent}</span>
        </div>
      </SettingsCard>

      {/* ── Shipping ─────────────────────────────────────────── */}
      <SectionHeader
        title="Shipping Address"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
      />
      <SettingsCard>
        <FormInput label="Street Address" value={street} onChange={setStreet} placeholder="123 Vinyl Lane" />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <FormInput label="City" value={city} onChange={setCity} placeholder="Brooklyn" />
          </div>
          <div className="col-span-1">
            <FormInput label="State" value={state} onChange={setState} placeholder="NY" />
          </div>
          <div className="col-span-1">
            <FormInput label="ZIP" value={zip} onChange={setZip} placeholder="11201" />
          </div>
        </div>
        <button
          onClick={handleSaveShipping}
          className="gs-btn-gradient px-5 py-2.5 text-xs text-white mt-1"
        >
          {shippingSaved ? 'Saved!' : 'Save Address'}
        </button>
      </SettingsCard>

      {/* ── Connected Devices ────────────────────────────────── */}
      <SectionHeader
        title="Connected Devices"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>}
      />
      <SettingsCard>
        {vinylBuddyActivated && deviceCode ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gs-accent to-[#6366f1] flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-gs-text">Vinyl Buddy</div>
              <div className="text-[11px] text-gs-dim font-mono">{deviceCode}</div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22c55e11] border border-[#22c55e33]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-[10px] text-[#22c55e] font-semibold">Active</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-[13px] text-gs-dim mb-1">No devices connected</div>
            <div className="text-[11px] text-gs-faint">Activate a Vinyl Buddy from the Buddy tab to see it here</div>
          </div>
        )}
      </SettingsCard>

      {/* ── Data ─────────────────────────────────────────────── */}
      <SectionHeader
        title="Data"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Export All Data" description="Download your collection, posts, and listening history">
          <button
            onClick={handleExportData}
            className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
          >
            {exportStarted ? 'Preparing...' : 'Export'}
          </button>
        </SettingsRow>
        <SettingsRow label="Delete Account" description="Permanently delete your account and all associated data">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] text-red-500 bg-transparent border border-red-500/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-red-500/10 transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-red-400 font-semibold">Sure?</span>
              <button className="text-[11px] text-white bg-red-500 border-none rounded-lg px-3 py-1.5 cursor-pointer font-bold">
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] text-gs-dim bg-transparent border border-[#333] rounded-lg px-3 py-1.5 cursor-pointer"
              >
                No
              </button>
            </div>
          )}
        </SettingsRow>
      </SettingsCard>

      {/* ── About ────────────────────────────────────────────── */}
      <SectionHeader
        title="About"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
      />
      <SettingsCard className="mb-8">
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Version</span>
            <span className="text-[13px] text-gs-text font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Built with</span>
            <span className="text-[13px] text-gs-text">React + Tailwind</span>
          </div>
          <div className="border-t border-[#111] pt-2.5 mt-2.5">
            <div className="flex gap-3">
              <a href="#" className="text-[11px] text-gs-accent hover:underline">Terms of Service</a>
              <a href="#" className="text-[11px] text-gs-accent hover:underline">Privacy Policy</a>
              <a href="#" className="text-[11px] text-gs-accent hover:underline">Open Source</a>
            </div>
          </div>
          <div className="text-[11px] text-gs-faint mt-1">
            Made with care for the vinyl community.
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
