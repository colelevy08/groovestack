// Settings screen — account, notifications, privacy, appearance, shipping, devices, data, and about.
// Uses Toggle and FormInput from the ui folder. All state is local/demo since there is no backend for settings.
import { useState, useCallback, useMemo } from 'react';
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

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Korean', value: 'ko' },
  { label: 'Italian', value: 'it' },
];

const DEFAULT_SHORTCUTS = [
  { action: 'Search', key: '/', description: 'Focus search bar' },
  { action: 'New Post', key: 'N', description: 'Create a new post' },
  { action: 'Home', key: 'H', description: 'Navigate to home feed' },
  { action: 'Profile', key: 'P', description: 'Open your profile' },
  { action: 'Settings', key: ',', description: 'Open settings' },
  { action: 'Messages', key: 'M', description: 'Open messages' },
];

const CONNECTED_ACCOUNT_TYPES = [
  { name: 'Discogs', icon: 'D', color: '#ff5500', connected: true, username: '@vinylcollector' },
  { name: 'Spotify', icon: 'S', color: '#1db954', connected: false, username: null },
  { name: 'Last.fm', icon: 'L', color: '#d51007', connected: true, username: 'groovestack_user' },
  { name: 'Apple Music', icon: 'A', color: '#fc3c44', connected: false, username: null },
];

const ACTIVITY_LOG = [
  { action: 'Login', device: 'Chrome / macOS', timestamp: Date.now() - 300000, ip: '192.168.1.42' },
  { action: 'Password changed', device: 'Chrome / macOS', timestamp: Date.now() - 86400000, ip: '192.168.1.42' },
  { action: 'Login', device: 'Safari / iOS', timestamp: Date.now() - 172800000, ip: '10.0.0.15' },
  { action: 'Settings updated', device: 'Chrome / macOS', timestamp: Date.now() - 259200000, ip: '192.168.1.42' },
  { action: 'Login', device: 'Firefox / Windows', timestamp: Date.now() - 432000000, ip: '203.0.113.50' },
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

function relTimeShort(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy === 1 ? 'yesterday' : `${dy}d ago`;
}

export default function SettingsScreen({ currentUser, profile, deviceCode, vinylBuddyActivated }) {
  // ── Notification toggles ──
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [dmNotifs, setDmNotifs] = useState(true);

  // ── Email notification preferences (Improvement 12) ──
  const [emailSales, setEmailSales] = useState(true);
  const [emailNewFollowers, setEmailNewFollowers] = useState(true);
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(false);
  const [emailPriceDrops, setEmailPriceDrops] = useState(true);

  // ── Notification scheduling / quiet hours (Improvement 3) ──
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  // ── Privacy toggles ──
  const [publicProfile, setPublicProfile] = useState(true);
  const [showListening, setShowListening] = useState(true);

  // ── Appearance ──
  const [accent, setAccent] = useState(profile?.accent || '#0ea5e9');

  // ── Accessibility settings (Improvement 8) ──
  const [fontSize, setFontSize] = useState('medium');
  const [highContrast, setHighContrast] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);

  // ── Language selection (Improvement 13) ──
  const [language, setLanguage] = useState('en');

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

  // ── Import/export settings (Improvement 1) ──
  const [settingsExported, setSettingsExported] = useState(false);
  const [settingsImported, setSettingsImported] = useState(false);

  // ── Storage management (Improvement 5) ──
  const [cacheCleared, setCacheCleared] = useState(false);
  const cacheSize = useMemo(() => '24.3 MB', []);
  const totalStorage = useMemo(() => '156.7 MB', []);

  // ── Developer mode (Improvement 6) ──
  const [devMode, setDevMode] = useState(false);

  // ── Keyboard shortcuts (Improvement 2) ──
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [editingShortcut, setEditingShortcut] = useState(null);

  // ── Connected accounts (Improvement 4) ──
  const [connectedAccounts, setConnectedAccounts] = useState(CONNECTED_ACCOUNT_TYPES);

  // ── Backup/restore (Improvement 9) ──
  const [backupCreated, setBackupCreated] = useState(false);
  const [lastBackup] = useState('2026-03-18 14:30');

  // ── Activity log (Improvement 10) ──
  const [showAllActivity, setShowAllActivity] = useState(false);

  // ── Improvement 14: Data usage statistics ──
  const [dataUsagePeriod, setDataUsagePeriod] = useState('week');
  const dataUsageStats = useMemo(() => ({
    week: { sent: '12.4 MB', received: '89.2 MB', requests: 342 },
    month: { sent: '48.7 MB', received: '312.5 MB', requests: 1247 },
    allTime: { sent: '156.3 MB', received: '1.2 GB', requests: 8934 },
  }), []);

  // ── Improvement 15: Cache management with size display ──
  const [cacheBreakdown] = useState([
    { label: 'Images', size: '14.2 MB', color: '#8b5cf6' },
    { label: 'API responses', size: '6.1 MB', color: '#0ea5e9' },
    { label: 'Search index', size: '3.2 MB', color: '#f59e0b' },
    { label: 'Other', size: '0.8 MB', color: '#64748b' },
  ]);

  // ── Improvement 16: Experimental features ──
  const [expAnimatedCovers, setExpAnimatedCovers] = useState(false);
  const [expAiRecommendations, setExpAiRecommendations] = useState(false);
  const [expBetaSearch, setExpBetaSearch] = useState(false);

  // ── Improvement 17: Account activity audit log ──
  const [auditLogFilter, setAuditLogFilter] = useState('all');
  const auditLog = useMemo(() => [
    { type: 'security', action: 'Password changed', detail: 'Via settings page', timestamp: Date.now() - 86400000 },
    { type: 'privacy', action: 'Profile set to public', detail: 'Privacy settings updated', timestamp: Date.now() - 172800000 },
    { type: 'data', action: 'Data export requested', detail: 'Full account export', timestamp: Date.now() - 259200000 },
    { type: 'security', action: 'Two-factor enabled', detail: 'TOTP authenticator', timestamp: Date.now() - 345600000 },
    { type: 'account', action: 'Email changed', detail: 'Verified new address', timestamp: Date.now() - 432000000 },
    { type: 'privacy', action: 'Listening activity hidden', detail: 'Vinyl Buddy privacy', timestamp: Date.now() - 518400000 },
  ], []);

  // ── Improvement 18: Privacy dashboard ──
  const [privacyStats] = useState({
    dataPoints: 1247,
    thirdPartyShares: 0,
    cookiesStored: 12,
    trackingBlocked: 89,
    lastAudit: '2026-03-18',
  });

  // ── Improvement 19: Blocked users list ──
  const [blockedUsers, setBlockedUsers] = useState([
    { username: 'spambot42', blockedAt: '2026-03-15' },
    { username: 'fake_vinyl', blockedAt: '2026-03-01' },
  ]);

  // ── Improvement 20: Muted words/topics ──
  const [mutedWords, setMutedWords] = useState(['bootleg', 'fake pressing', 'scam']);
  const [newMutedWord, setNewMutedWord] = useState('');

  // ── Improvement 21: Auto-archive old conversations ──
  const [autoArchive, setAutoArchive] = useState(false);
  const [autoArchiveDays, setAutoArchiveDays] = useState('30');

  // ── Improvement 22: Default listing settings ──
  const [defaultCondition, setDefaultCondition] = useState('VG+');
  const [defaultMinPrice, setDefaultMinPrice] = useState('');
  const [defaultMaxPrice, setDefaultMaxPrice] = useState('');

  // ── Improvement 23: Notification sound picker ──
  const [notifSound, setNotifSound] = useState('default');
  const notifSoundOptions = useMemo(() => [
    { label: 'Default', value: 'default' },
    { label: 'Chime', value: 'chime' },
    { label: 'Pop', value: 'pop' },
    { label: 'Vinyl Crackle', value: 'vinyl' },
    { label: 'None', value: 'none' },
  ], []);

  // ── Improvement 24: App icon customization ──
  const [selectedIcon, setSelectedIcon] = useState('default');
  const appIconOptions = useMemo(() => [
    { label: 'Default', value: 'default', color: '#0ea5e9' },
    { label: 'Dark', value: 'dark', color: '#1a1a1a' },
    { label: 'Sunset', value: 'sunset', color: '#f97316' },
    { label: 'Neon', value: 'neon', color: '#22c55e' },
    { label: 'Lavender', value: 'lavender', color: '#8b5cf6' },
    { label: 'Rose', value: 'rose', color: '#ec4899' },
  ], []);

  // ── Improvement 16: Import settings from other platforms ──
  const [platformImportStatus, setPlatformImportStatus] = useState(null);
  const importPlatforms = useMemo(() => [
    { name: 'Discogs', icon: 'D', color: '#ff5500', desc: 'Import collection data and wantlist' },
    { name: 'Vinyl Me Please', icon: 'V', color: '#e91e63', desc: 'Import membership preferences' },
    { name: 'Bandcamp', icon: 'B', color: '#1da0c3', desc: 'Import purchases and wishlist' },
    { name: 'MusicBrainz', icon: 'M', color: '#ba478f', desc: 'Import listening metadata' },
  ], []);

  // ── Improvement 17: Notification scheduling (digest times) ──
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('09:00');
  const [digestDays, setDigestDays] = useState(['Mon', 'Wed', 'Fri']);

  // ── Improvement 18: Privacy mode (hide activity) ──
  const [privacyMode, setPrivacyMode] = useState(false);
  const [hideCollection, setHideCollection] = useState(false);
  const [hideListeningHistory, setHideListeningHistory] = useState(false);
  const [hideWishlist, setHideWishlist] = useState(false);

  // ── Improvement 19: Auto-list records for sale based on rules ──
  const [autoListEnabled, setAutoListEnabled] = useState(false);
  const [autoListMinValue, setAutoListMinValue] = useState('50');
  const [autoListCondition, setAutoListCondition] = useState('NM');
  const [autoListDuplicates, setAutoListDuplicates] = useState(true);

  // ── Improvement 20: Marketplace fee preferences ──
  const [feeAbsorb, setFeeAbsorb] = useState('split');
  const [autoRelist, setAutoRelist] = useState(true);
  const [relistDiscount, setRelistDiscount] = useState('5');

  // ── Improvement 21: Default currency selection ──
  const [currency, setCurrency] = useState('USD');
  const currencyOptions = useMemo(() => [
    { label: 'USD ($)', value: 'USD' }, { label: 'EUR (\u20AC)', value: 'EUR' },
    { label: 'GBP (\u00A3)', value: 'GBP' }, { label: 'JPY (\u00A5)', value: 'JPY' },
    { label: 'CAD ($)', value: 'CAD' }, { label: 'AUD ($)', value: 'AUD' },
  ], []);

  // ── Improvement 22: Time zone setting ──
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const timeZoneOptions = useMemo(() => [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
    'Australia/Sydney', 'Pacific/Auckland',
  ], []);

  // ── Improvement 23: Shipping preferences ──
  const [defaultCarrier, setDefaultCarrier] = useState('USPS');
  const [shippingInsurance, setShippingInsurance] = useState(false);
  const [insuranceThreshold, setInsuranceThreshold] = useState('50');
  const [requireSignature, setRequireSignature] = useState(false);

  // ── Improvement 24b: Collection organization defaults ──
  const [collectionSort, setCollectionSort] = useState('artist');
  const [collectionView, setCollectionView] = useState('grid');
  const [showGrades, setShowGrades] = useState(true);
  const [showValues, setShowValues] = useState(false);

  // ── Improvement 25: Data retention policy settings ──
  const [retentionPeriod, setRetentionPeriod] = useState('forever');
  const [autoDeleteMessages, setAutoDeleteMessages] = useState(false);
  const [autoDeleteMsgDays, setAutoDeleteMsgDays] = useState('90');
  const [anonymizeOldData, setAnonymizeOldData] = useState(false);

  const handleSaveShipping = useCallback(() => {
    setShippingSaved(true);
    setTimeout(() => setShippingSaved(false), 2000);
  }, []);

  const handleExportData = useCallback(() => {
    setExportStarted(true);
    setTimeout(() => setExportStarted(false), 3000);
  }, []);

  const handleExportSettings = useCallback(() => {
    const settings = {
      notifications: { emailNotifs, pushNotifs, dmNotifs, emailSales, emailNewFollowers, emailWeeklyDigest, emailPriceDrops },
      quietHours: { enabled: quietHoursEnabled, start: quietStart, end: quietEnd },
      privacy: { publicProfile, showListening },
      appearance: { accent, fontSize, highContrast, reduceAnimations, language },
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groovestack-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSettingsExported(true);
    setTimeout(() => setSettingsExported(false), 2000);
  }, [emailNotifs, pushNotifs, dmNotifs, emailSales, emailNewFollowers, emailWeeklyDigest, emailPriceDrops, quietHoursEnabled, quietStart, quietEnd, publicProfile, showListening, accent, fontSize, highContrast, reduceAnimations, language]);

  const handleImportSettings = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          JSON.parse(reader.result);
          setSettingsImported(true);
          setTimeout(() => setSettingsImported(false), 2000);
        } catch {
          // Invalid JSON - silently ignore
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleClearCache = useCallback(() => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  }, []);

  const handleCreateBackup = useCallback(() => {
    setBackupCreated(true);
    setTimeout(() => setBackupCreated(false), 2000);
  }, []);

  const handleShortcutEdit = useCallback((index, newKey) => {
    setShortcuts(prev => prev.map((s, i) => i === index ? { ...s, key: newKey.toUpperCase() } : s));
    setEditingShortcut(null);
  }, []);

  const handleToggleAccount = useCallback((index) => {
    setConnectedAccounts(prev => prev.map((acc, i) =>
      i === index ? { ...acc, connected: !acc.connected, username: acc.connected ? null : `@${currentUser}` } : acc
    ));
  }, [currentUser]);

  const visibleActivity = showAllActivity ? ACTIVITY_LOG : ACTIVITY_LOG.slice(0, 3);

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

      {/* ── Connected Accounts (Improvement 4) ─────────────── */}
      <SectionHeader
        title="Connected Accounts"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>}
      />
      <SettingsCard>
        {connectedAccounts.map((account, i) => (
          <div key={account.name} className={`flex items-center justify-between py-2.5 ${i < connectedAccounts.length - 1 ? 'border-b border-[#111]' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: account.color }}>
                {account.icon}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-gs-text">{account.name}</div>
                {account.connected && account.username && (
                  <div className="text-[10px] text-gs-dim font-mono">{account.username}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => handleToggleAccount(i)}
              className={`text-[11px] bg-transparent border rounded-lg px-3 py-1.5 cursor-pointer transition-colors ${
                account.connected
                  ? 'text-red-400 border-red-400/30 hover:bg-red-400/10'
                  : 'text-gs-accent border-gs-accent/30 hover:bg-gs-accent/10'
              }`}
            >
              {account.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
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

      {/* ── Email Notification Preferences (Improvement 12) ── */}
      <SettingsCard>
        <div className="text-[10px] text-gs-dim font-mono mb-3 uppercase tracking-[0.06em]">Email Preferences</div>
        <SettingsRow label="Sale Notifications" description="When your listed items receive offers or sell">
          <Toggle on={emailSales} onToggle={() => setEmailSales(v => !v)} />
        </SettingsRow>
        <SettingsRow label="New Followers" description="When someone follows your profile">
          <Toggle on={emailNewFollowers} onToggle={() => setEmailNewFollowers(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Weekly Digest" description="Summary of marketplace activity and new arrivals">
          <Toggle on={emailWeeklyDigest} onToggle={() => setEmailWeeklyDigest(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Price Drop Alerts" description="When items in your wishlist drop in price">
          <Toggle on={emailPriceDrops} onToggle={() => setEmailPriceDrops(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Quiet Hours (Improvement 3) ──────────────────────── */}
      <SettingsCard>
        <SettingsRow label="Quiet Hours" description="Silence all notifications during specified hours">
          <Toggle on={quietHoursEnabled} onToggle={() => setQuietHoursEnabled(v => !v)} />
        </SettingsRow>
        {quietHoursEnabled && (
          <div className="mt-3 pt-3 border-t border-[#111] flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-gs-dim font-mono block mb-1">Start</label>
              <input
                type="time"
                value={quietStart}
                onChange={e => setQuietStart(e.target.value)}
                className="w-full py-1.5 px-2 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
              />
            </div>
            <div className="text-gs-faint text-xs mt-4">to</div>
            <div className="flex-1">
              <label className="text-[10px] text-gs-dim font-mono block mb-1">End</label>
              <input
                type="time"
                value={quietEnd}
                onChange={e => setQuietEnd(e.target.value)}
                className="w-full py-1.5 px-2 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
              />
            </div>
          </div>
        )}
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

      {/* ── Accessibility (Improvement 8) ───────────────────── */}
      <SectionHeader
        title="Accessibility"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="8" r="1" /><path d="M12 12v4" /><path d="M8 10l4 2 4-2" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Font Size" description="Adjust the text size across the interface">
          <div className="flex gap-1">
            {['small', 'medium', 'large'].map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all duration-200 border capitalize ${
                  fontSize === size
                    ? 'bg-[#14b8a611] border-[#14b8a633] text-[#14b8a6] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="High Contrast" description="Increase contrast for better readability">
          <Toggle on={highContrast} onToggle={() => setHighContrast(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Reduce Animations" description="Minimize motion and transitions throughout the app">
          <Toggle on={reduceAnimations} onToggle={() => setReduceAnimations(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Language Selection (Improvement 13) ──────────────── */}
      <SectionHeader
        title="Language"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>}
      />
      <SettingsCard>
        <div className="text-[13px] font-semibold text-gs-text mb-3">Interface Language</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {LANGUAGE_OPTIONS.map(lang => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`text-[11px] py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 border text-center ${
                language === lang.value
                  ? 'bg-[#ec489911] border-[#ec489933] text-[#ec4899] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-gs-faint">Changes will take effect after page reload.</div>
      </SettingsCard>

      {/* ── Keyboard Shortcuts (Improvement 2) ──────────────── */}
      <SectionHeader
        title="Keyboard Shortcuts"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" /></svg>}
      />
      <SettingsCard>
        <div className="flex flex-col gap-1">
          {shortcuts.map((shortcut, i) => (
            <div key={shortcut.action} className="flex items-center justify-between py-2 border-b border-[#111] last:border-b-0">
              <div>
                <div className="text-[12px] font-semibold text-gs-text">{shortcut.action}</div>
                <div className="text-[10px] text-gs-dim">{shortcut.description}</div>
              </div>
              {editingShortcut === i ? (
                <input
                  autoFocus
                  className="w-12 text-center bg-[#111] rounded-lg text-xs text-gs-accent border border-gs-accent outline-none py-1 font-mono font-bold uppercase"
                  maxLength={1}
                  onKeyDown={e => {
                    if (e.key.length === 1) {
                      handleShortcutEdit(i, e.key);
                    } else if (e.key === 'Escape') {
                      setEditingShortcut(null);
                    }
                    e.preventDefault();
                  }}
                  onBlur={() => setEditingShortcut(null)}
                />
              ) : (
                <button
                  onClick={() => setEditingShortcut(i)}
                  className="text-[11px] font-mono font-bold bg-[#111] border border-[#222] rounded-lg px-3 py-1 text-gs-muted cursor-pointer hover:border-gs-accent hover:text-gs-accent transition-colors"
                >
                  {shortcut.key}
                </button>
              )}
            </div>
          ))}
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

      {/* ── Connected Devices (Improvement 11 - enhanced) ──── */}
      <SectionHeader
        title="Connected Devices"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>}
      />
      <SettingsCard>
        {vinylBuddyActivated && deviceCode ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
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
            {/* Additional device: browser session */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#111]">
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-gs-text">This Browser</div>
                <div className="text-[11px] text-gs-dim font-mono">Chrome / macOS</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0ea5e911] border border-[#0ea5e933]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]" />
                <span className="text-[10px] text-[#0ea5e9] font-semibold">Current</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-[13px] text-gs-dim mb-1">No devices connected</div>
            <div className="text-[11px] text-gs-faint">Activate a Vinyl Buddy from the Buddy tab to see it here</div>
          </div>
        )}
      </SettingsCard>

      {/* ── Storage Management (Improvement 5) ────────────── */}
      <SectionHeader
        title="Storage"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="10" y1="16" x2="10.01" y2="16" /></svg>}
      />
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13px] font-semibold text-gs-text">Total Storage Used</div>
            <div className="text-[11px] text-gs-dim">{totalStorage} across all data</div>
          </div>
        </div>
        <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-gs-accent to-[#8b5cf6]" style={{ width: '32%' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-gs-accent">98.4 MB</div>
            <div className="text-[9px] text-gs-dim font-mono">Collection</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-[#8b5cf6]">34.0 MB</div>
            <div className="text-[9px] text-gs-dim font-mono">Images</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-[#f59e0b]">{cacheSize}</div>
            <div className="text-[9px] text-gs-dim font-mono">Cache</div>
          </div>
        </div>
        <button
          onClick={handleClearCache}
          className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
        >
          {cacheCleared ? 'Cache Cleared!' : `Clear Cache (${cacheSize})`}
        </button>
      </SettingsCard>

      {/* ── Import/Export Settings (Improvement 1) ──────────── */}
      <SectionHeader
        title="Import / Export"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Export Settings" description="Download your preferences as a JSON file">
          <button
            onClick={handleExportSettings}
            className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
          >
            {settingsExported ? 'Exported!' : 'Export'}
          </button>
        </SettingsRow>
        <SettingsRow label="Import Settings" description="Restore preferences from a previously exported file">
          <button
            onClick={handleImportSettings}
            className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
          >
            {settingsImported ? 'Imported!' : 'Import'}
          </button>
        </SettingsRow>
      </SettingsCard>

      {/* ── Backup / Restore (Improvement 9) ────────────────── */}
      <SectionHeader
        title="Backup & Restore"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>}
      />
      <SettingsCard>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13px] font-semibold text-gs-text">Cloud Backup</div>
            <div className="text-[11px] text-gs-dim">Last backup: {lastBackup}</div>
          </div>
          <button
            onClick={handleCreateBackup}
            className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
          >
            {backupCreated ? 'Backup Created!' : 'Backup Now'}
          </button>
        </div>
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#22c55e08] border border-[#22c55e22]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="text-[10px] text-[#22c55e] font-semibold">Auto-backup enabled (weekly)</span>
        </div>
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

      {/* ── Account Activity Log (Improvement 10) ──────────── */}
      <SectionHeader
        title="Account Activity"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>}
      />
      <SettingsCard>
        <div className="flex flex-col gap-1">
          {visibleActivity.map((entry, i) => (
            <div key={i} className={`flex items-center justify-between py-2 ${i < visibleActivity.length - 1 ? 'border-b border-[#111]' : ''}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${entry.action === 'Login' ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
                <div>
                  <div className="text-[12px] font-semibold text-gs-text">{entry.action}</div>
                  <div className="text-[10px] text-gs-dim">{entry.device}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gs-faint font-mono">{relTimeShort(entry.timestamp)}</div>
                <div className="text-[9px] text-gs-faint font-mono">{entry.ip}</div>
              </div>
            </div>
          ))}
        </div>
        {ACTIVITY_LOG.length > 3 && (
          <button
            onClick={() => setShowAllActivity(v => !v)}
            className="mt-2 text-[11px] text-gs-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            {showAllActivity ? 'Show less' : `View all (${ACTIVITY_LOG.length})`}
          </button>
        )}
      </SettingsCard>

      {/* ── Developer Mode (Improvement 6) ──────────────────── */}
      <SectionHeader
        title="Developer"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Developer Mode" description="Enable advanced debugging tools and API inspector">
          <Toggle on={devMode} onToggle={() => setDevMode(v => !v)} />
        </SettingsRow>
        {devMode && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">API Usage</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
                <div className="text-[13px] font-bold text-gs-accent">1,247</div>
                <div className="text-[9px] text-gs-dim font-mono">Requests</div>
              </div>
              <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
                <div className="text-[13px] font-bold text-[#22c55e]">99.2%</div>
                <div className="text-[9px] text-gs-dim font-mono">Uptime</div>
              </div>
              <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
                <div className="text-[13px] font-bold text-[#f59e0b]">42ms</div>
                <div className="text-[9px] text-gs-dim font-mono">Avg Latency</div>
              </div>
            </div>
            <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Rate Limits</div>
            <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden mb-1">
              <div className="h-full rounded-full bg-[#22c55e]" style={{ width: '12%' }} />
            </div>
            <div className="flex justify-between">
              <span className="text-[9px] text-gs-faint font-mono">124 / 1,000 requests used</span>
              <span className="text-[9px] text-[#22c55e] font-mono">12%</span>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 14: Data Usage Statistics ──────────── */}
      <SectionHeader
        title="Data Usage"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>}
      />
      <SettingsCard>
        <div className="flex gap-1 mb-3">
          {[{ label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }, { label: 'All Time', value: 'allTime' }].map(p => (
            <button
              key={p.value}
              onClick={() => setDataUsagePeriod(p.value)}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all duration-200 border ${
                dataUsagePeriod === p.value
                  ? 'bg-[#06b6d411] border-[#06b6d433] text-[#06b6d4] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-[#06b6d4]">{dataUsageStats[dataUsagePeriod].sent}</div>
            <div className="text-[9px] text-gs-dim font-mono">Sent</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-[#8b5cf6]">{dataUsageStats[dataUsagePeriod].received}</div>
            <div className="text-[9px] text-gs-dim font-mono">Received</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2 px-2.5 text-center">
            <div className="text-[11px] font-bold text-[#f59e0b]">{dataUsageStats[dataUsagePeriod].requests}</div>
            <div className="text-[9px] text-gs-dim font-mono">Requests</div>
          </div>
        </div>
      </SettingsCard>

      {/* ── Improvement 15: Cache Management ──────────────── */}
      <SectionHeader
        title="Cache Management"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>}
      />
      <SettingsCard>
        <div className="text-[13px] font-semibold text-gs-text mb-3">Cache Breakdown</div>
        <div className="space-y-2 mb-3">
          {cacheBreakdown.map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-[11px] text-gs-muted">{item.label}</span>
              </div>
              <span className="text-[11px] text-gs-text font-mono">{item.size}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearCache}
            className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
          >
            {cacheCleared ? 'Cleared!' : `Clear All (${cacheSize})`}
          </button>
        </div>
      </SettingsCard>

      {/* ── Improvement 16: Experimental Features ─────────── */}
      <SectionHeader
        title="Experimental Features"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0112 4.5V6h2V4.5A4.5 4.5 0 009.5 0v2zM5.584 3.412L7 4.828V7h2V4.828l1.416-1.416A4.5 4.5 0 005.584 3.412z" /><path d="M14 14v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7" /><path d="M3 10h14v4H3z" /></svg>}
      />
      <SettingsCard>
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" className="shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] text-amber-400">These features are in development and may be unstable.</span>
        </div>
        <SettingsRow label="Animated Album Covers" description="Show subtle animations on album artwork">
          <Toggle on={expAnimatedCovers} onToggle={() => setExpAnimatedCovers(v => !v)} />
        </SettingsRow>
        <SettingsRow label="AI Recommendations" description="Get personalized vinyl suggestions powered by AI">
          <Toggle on={expAiRecommendations} onToggle={() => setExpAiRecommendations(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Beta Search Engine" description="Try the next-generation search with fuzzy matching">
          <Toggle on={expBetaSearch} onToggle={() => setExpBetaSearch(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Improvement 17: Account Activity Audit Log ─────── */}
      <SectionHeader
        title="Audit Log"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
      />
      <SettingsCard>
        <div className="flex gap-1 mb-3">
          {['all', 'security', 'privacy', 'data', 'account'].map(f => (
            <button
              key={f}
              onClick={() => setAuditLogFilter(f)}
              className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all duration-200 border capitalize ${
                auditLogFilter === f
                  ? 'bg-[#a78bfa11] border-[#a78bfa33] text-[#a78bfa] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {auditLog.filter(e => auditLogFilter === 'all' || e.type === auditLogFilter).map((entry, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#111] last:border-b-0">
              <div>
                <div className="text-[12px] font-semibold text-gs-text">{entry.action}</div>
                <div className="text-[10px] text-gs-dim">{entry.detail}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gs-faint font-mono">{relTimeShort(entry.timestamp)}</div>
                <div className="text-[9px] text-gs-faint font-mono capitalize">{entry.type}</div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ── Improvement 18: Privacy Dashboard ─────────────── */}
      <SectionHeader
        title="Privacy Dashboard"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
      />
      <SettingsCard>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[#111] rounded-lg py-2.5 px-3 text-center">
            <div className="text-[14px] font-bold text-[#22c55e]">{privacyStats.dataPoints}</div>
            <div className="text-[9px] text-gs-dim font-mono">Data Points</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2.5 px-3 text-center">
            <div className="text-[14px] font-bold text-[#22c55e]">{privacyStats.thirdPartyShares}</div>
            <div className="text-[9px] text-gs-dim font-mono">3rd Party Shares</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2.5 px-3 text-center">
            <div className="text-[14px] font-bold text-[#0ea5e9]">{privacyStats.cookiesStored}</div>
            <div className="text-[9px] text-gs-dim font-mono">Cookies</div>
          </div>
          <div className="bg-[#111] rounded-lg py-2.5 px-3 text-center">
            <div className="text-[14px] font-bold text-[#8b5cf6]">{privacyStats.trackingBlocked}</div>
            <div className="text-[9px] text-gs-dim font-mono">Trackers Blocked</div>
          </div>
        </div>
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#22c55e08] border border-[#22c55e22]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="text-[10px] text-[#22c55e] font-semibold">Last privacy audit: {privacyStats.lastAudit}</span>
        </div>
      </SettingsCard>

      {/* ── Improvement 19: Blocked Users ─────────────────── */}
      <SectionHeader
        title="Blocked Users"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>}
      />
      <SettingsCard>
        {blockedUsers.length > 0 ? (
          <div className="flex flex-col gap-1">
            {blockedUsers.map((user, i) => (
              <div key={user.username} className={`flex items-center justify-between py-2 ${i < blockedUsers.length - 1 ? 'border-b border-[#111]' : ''}`}>
                <div>
                  <div className="text-[12px] font-semibold text-gs-text">@{user.username}</div>
                  <div className="text-[10px] text-gs-dim">Blocked {user.blockedAt}</div>
                </div>
                <button
                  onClick={() => setBlockedUsers(prev => prev.filter(u => u.username !== user.username))}
                  className="text-[10px] text-red-400 bg-transparent border border-red-400/30 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-red-400/10 transition-colors"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3">
            <div className="text-[13px] text-gs-dim">No blocked users</div>
            <div className="text-[11px] text-gs-faint mt-0.5">Users you block will appear here</div>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 20: Muted Words/Topics ────────────── */}
      <SectionHeader
        title="Muted Words"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Posts containing these words will be hidden from your feed.</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {mutedWords.map(word => (
            <span key={word} className="inline-flex items-center gap-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-2.5 py-1 text-[11px] text-gs-muted">
              {word}
              <button
                onClick={() => setMutedWords(prev => prev.filter(w => w !== word))}
                className="text-gs-faint hover:text-red-400 bg-transparent border-none cursor-pointer p-0 text-[10px] transition-colors"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMutedWord}
            onChange={e => setNewMutedWord(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newMutedWord.trim()) {
                setMutedWords(prev => [...prev, newMutedWord.trim()]);
                setNewMutedWord('');
              }
            }}
            placeholder="Add a word or phrase..."
            className="flex-1 py-1.5 px-2.5 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors"
          />
          <button
            onClick={() => { if (newMutedWord.trim()) { setMutedWords(prev => [...prev, newMutedWord.trim()]); setNewMutedWord(''); } }}
            disabled={!newMutedWord.trim()}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${newMutedWord.trim() ? 'text-gs-accent border-gs-accent/30 cursor-pointer hover:bg-gs-accent/10' : 'text-gs-faint border-[#222] cursor-default'}`}
          >
            Add
          </button>
        </div>
      </SettingsCard>

      {/* ── Improvement 21: Auto-Archive ──────────────────── */}
      <SectionHeader
        title="Conversations"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Auto-Archive Old Conversations" description="Automatically archive conversations after a period of inactivity">
          <Toggle on={autoArchive} onToggle={() => setAutoArchive(v => !v)} />
        </SettingsRow>
        {autoArchive && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <label className="text-[10px] text-gs-dim font-mono block mb-1.5">Archive after</label>
            <div className="flex gap-1">
              {['7', '14', '30', '60', '90'].map(d => (
                <button
                  key={d}
                  onClick={() => setAutoArchiveDays(d)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all duration-200 border ${
                    autoArchiveDays === d
                      ? 'bg-[#14b8a611] border-[#14b8a633] text-[#14b8a6] font-bold'
                      : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 22: Default Listing Settings ──────── */}
      <SectionHeader
        title="Default Listing Settings"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Pre-fill these defaults when creating new listings.</div>
        <SettingsRow label="Default Condition" description="Pre-selected condition for new listings">
          <div className="flex gap-1">
            {['M', 'NM', 'VG+', 'VG', 'G+', 'G'].map(c => (
              <button
                key={c}
                onClick={() => setDefaultCondition(c)}
                className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all duration-200 border ${
                  defaultCondition === c
                    ? 'bg-[#ec489911] border-[#ec489933] text-[#ec4899] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </SettingsRow>
        <div className="mt-3 pt-3 border-t border-[#111]">
          <div className="text-[11px] font-semibold text-gs-text mb-2">Default Price Range</div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={defaultMinPrice}
                onChange={e => setDefaultMinPrice(e.target.value)}
                placeholder="Min $"
                className="w-full py-1.5 px-2.5 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
              />
            </div>
            <span className="text-gs-faint text-xs">to</span>
            <div className="flex-1">
              <input
                type="number"
                value={defaultMaxPrice}
                onChange={e => setDefaultMaxPrice(e.target.value)}
                placeholder="Max $"
                className="w-full py-1.5 px-2.5 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
              />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ── Improvement 23: Notification Sound Picker ──────── */}
      <SectionHeader
        title="Notification Sound"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14" /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg>}
      />
      <SettingsCard>
        <div className="flex flex-wrap gap-1.5">
          {notifSoundOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setNotifSound(opt.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border ${
                notifSound === opt.value
                  ? 'bg-[#f59e0b11] border-[#f59e0b33] text-[#f59e0b] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {notifSound !== 'none' && (
          <button
            onClick={() => { /* preview sound placeholder */ }}
            className="mt-2 text-[10px] text-gs-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            Preview sound
          </button>
        )}
      </SettingsCard>

      {/* ── Improvement 24: App Icon Customization ─────────── */}
      <SectionHeader
        title="App Icon"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Choose a custom app icon (applies on supported devices).</div>
        <div className="flex flex-wrap gap-2">
          {appIconOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedIcon(opt.value)}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-all duration-200 p-1.5 rounded-xl border ${
                selectedIcon === opt.value ? 'border-white scale-105' : 'border-transparent'
              }`}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/10"
                style={{ background: opt.color }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="text-[9px] text-gs-faint">{opt.label}</span>
            </button>
          ))}
        </div>
      </SettingsCard>

      {/* ── Improvement 16: Import Settings from Other Platforms ── */}
      <SectionHeader
        title="Import from Platform"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Import your collection, preferences, and data from other vinyl platforms.</div>
        <div className="flex flex-col gap-1.5">
          {importPlatforms.map(platform => (
            <div key={platform.name} className="flex items-center justify-between py-2 border-b border-[#111] last:border-b-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: platform.color }}>
                  {platform.icon}
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-gs-text">{platform.name}</div>
                  <div className="text-[10px] text-gs-dim">{platform.desc}</div>
                </div>
              </div>
              <button
                onClick={() => { setPlatformImportStatus(platform.name); setTimeout(() => setPlatformImportStatus(null), 2000); }}
                className="text-[11px] text-gs-accent bg-transparent border border-gs-accent/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-gs-accent/10 transition-colors"
              >
                {platformImportStatus === platform.name ? 'Importing...' : 'Import'}
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ── Improvement 17: Notification Scheduling (Digest Times) ── */}
      <SectionHeader
        title="Notification Digest"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Digest Mode" description="Bundle notifications into a single daily summary">
          <Toggle on={digestEnabled} onToggle={() => setDigestEnabled(v => !v)} />
        </SettingsRow>
        {digestEnabled && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-gs-dim font-mono block mb-1">Delivery Time</label>
                <input
                  type="time"
                  value={digestTime}
                  onChange={e => setDigestTime(e.target.value)}
                  className="w-full py-1.5 px-2 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
                />
              </div>
            </div>
            <label className="text-[10px] text-gs-dim font-mono block mb-1.5">Digest Days</label>
            <div className="flex gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <button
                  key={day}
                  onClick={() => setDigestDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                  className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                    digestDays.includes(day)
                      ? 'bg-[#f59e0b11] border-[#f59e0b33] text-[#f59e0b] font-bold'
                      : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 18: Privacy Mode ─────────────────────── */}
      <SectionHeader
        title="Privacy Mode"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Privacy Mode" description="Hide all activity from other users when enabled">
          <Toggle on={privacyMode} onToggle={() => setPrivacyMode(v => !v)} />
        </SettingsRow>
        {privacyMode && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <SettingsRow label="Hide Collection" description="Others cannot browse your record collection">
              <Toggle on={hideCollection} onToggle={() => setHideCollection(v => !v)} />
            </SettingsRow>
            <SettingsRow label="Hide Listening History" description="Your Vinyl Buddy activity is private">
              <Toggle on={hideListeningHistory} onToggle={() => setHideListeningHistory(v => !v)} />
            </SettingsRow>
            <SettingsRow label="Hide Wishlist" description="Keep your wantlist hidden from other users">
              <Toggle on={hideWishlist} onToggle={() => setHideWishlist(v => !v)} />
            </SettingsRow>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 19: Auto-List Records for Sale ────────── */}
      <SectionHeader
        title="Auto-List Rules"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Auto-List Enabled" description="Automatically list records for sale based on your rules">
          <Toggle on={autoListEnabled} onToggle={() => setAutoListEnabled(v => !v)} />
        </SettingsRow>
        {autoListEnabled && (
          <div className="mt-3 pt-3 border-t border-[#111]">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-gs-dim font-mono block mb-1">Min Estimated Value ($)</label>
                <input
                  type="number"
                  value={autoListMinValue}
                  onChange={e => setAutoListMinValue(e.target.value)}
                  className="w-full py-1.5 px-2.5 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gs-dim font-mono block mb-1">Min Condition</label>
                <div className="flex gap-1">
                  {['M', 'NM', 'VG+', 'VG'].map(c => (
                    <button
                      key={c}
                      onClick={() => setAutoListCondition(c)}
                      className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                        autoListCondition === c
                          ? 'bg-[#22c55e11] border-[#22c55e33] text-[#22c55e] font-bold'
                          : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <SettingsRow label="Auto-List Duplicates" description="Automatically list duplicate records in your collection">
              <Toggle on={autoListDuplicates} onToggle={() => setAutoListDuplicates(v => !v)} />
            </SettingsRow>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 20: Marketplace Fee Preferences ──────── */}
      <SectionHeader
        title="Marketplace Fees"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">How marketplace fees (5%) are handled on sales.</div>
        <div className="flex gap-1 mb-3">
          {[{ label: 'I pay', value: 'seller' }, { label: 'Buyer pays', value: 'buyer' }, { label: 'Split 50/50', value: 'split' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFeeAbsorb(opt.value)}
              className={`text-[10px] px-3 py-1.5 rounded-lg font-mono cursor-pointer transition-all border flex-1 ${
                feeAbsorb === opt.value
                  ? 'bg-[#f9731611] border-[#f9731633] text-[#f97316] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <SettingsRow label="Auto-Relist Unsold Items" description="Automatically relist items that don't sell within 30 days">
          <Toggle on={autoRelist} onToggle={() => setAutoRelist(v => !v)} />
        </SettingsRow>
        {autoRelist && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-gs-dim font-mono">Relist discount:</span>
            <div className="flex gap-1">
              {['0', '5', '10', '15'].map(d => (
                <button
                  key={d}
                  onClick={() => setRelistDiscount(d)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                    relistDiscount === d
                      ? 'bg-[#f9731611] border-[#f9731633] text-[#f97316] font-bold'
                      : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                  }`}
                >
                  {d}%
                </button>
              ))}
            </div>
          </div>
        )}
      </SettingsCard>

      {/* ── Improvement 21: Default Currency Selection ────────── */}
      <SectionHeader
        title="Currency"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>}
      />
      <SettingsCard>
        <div className="text-[13px] font-semibold text-gs-text mb-3">Default Currency</div>
        <div className="flex flex-wrap gap-1.5">
          {currencyOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCurrency(opt.value)}
              className={`text-[11px] px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                currency === opt.value
                  ? 'bg-[#14b8a611] border-[#14b8a633] text-[#14b8a6] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-gs-faint">All prices will be displayed in {currency}. Conversion is approximate.</div>
      </SettingsCard>

      {/* ── Improvement 22: Time Zone Setting ────────────────── */}
      <SectionHeader
        title="Time Zone"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
      />
      <SettingsCard>
        <div className="text-[13px] font-semibold text-gs-text mb-3">Your Time Zone</div>
        <div className="flex flex-col gap-1">
          {timeZoneOptions.map(tz => (
            <button
              key={tz}
              onClick={() => setTimeZone(tz)}
              className={`text-left text-[11px] py-2 px-3 rounded-lg cursor-pointer transition-all border ${
                timeZone === tz
                  ? 'bg-[#8b5cf611] border-[#8b5cf633] text-[#8b5cf6] font-bold'
                  : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
              }`}
            >
              {tz.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-gs-faint">Affects all timestamps and scheduled notifications.</div>
      </SettingsCard>

      {/* ── Improvement 23: Shipping Preferences ─────────────── */}
      <SectionHeader
        title="Shipping Preferences"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Set defaults for outgoing shipments.</div>
        <SettingsRow label="Default Carrier" description="Preferred shipping carrier for marketplace orders">
          <div className="flex gap-1">
            {['USPS', 'UPS', 'FedEx', 'DHL'].map(c => (
              <button
                key={c}
                onClick={() => setDefaultCarrier(c)}
                className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                  defaultCarrier === c
                    ? 'bg-[#06b6d411] border-[#06b6d433] text-[#06b6d4] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Shipping Insurance" description="Automatically add insurance to shipments">
          <Toggle on={shippingInsurance} onToggle={() => setShippingInsurance(v => !v)} />
        </SettingsRow>
        {shippingInsurance && (
          <div className="mt-2 flex items-center gap-2 ml-2">
            <span className="text-[10px] text-gs-dim font-mono">For orders over $</span>
            <input
              type="number"
              value={insuranceThreshold}
              onChange={e => setInsuranceThreshold(e.target.value)}
              className="w-20 py-1 px-2 bg-[#111] rounded-lg text-xs text-gs-text border border-[#222] outline-none focus:border-gs-accent transition-colors font-mono"
            />
          </div>
        )}
        <SettingsRow label="Require Signature" description="Require delivery signature for all shipments">
          <Toggle on={requireSignature} onToggle={() => setRequireSignature(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Improvement 24b: Collection Organization Defaults ── */}
      <SectionHeader
        title="Collection Organization"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>}
      />
      <SettingsCard>
        <SettingsRow label="Default Sort" description="How your collection is sorted by default">
          <div className="flex gap-1">
            {[{ l: 'Artist', v: 'artist' }, { l: 'Album', v: 'album' }, { l: 'Year', v: 'year' }, { l: 'Added', v: 'added' }].map(opt => (
              <button
                key={opt.v}
                onClick={() => setCollectionSort(opt.v)}
                className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                  collectionSort === opt.v
                    ? 'bg-[#ec489911] border-[#ec489933] text-[#ec4899] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Default View" description="Grid or list layout for your collection">
          <div className="flex gap-1">
            {['grid', 'list'].map(v => (
              <button
                key={v}
                onClick={() => setCollectionView(v)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-mono cursor-pointer transition-all border capitalize ${
                  collectionView === v
                    ? 'bg-[#ec489911] border-[#ec489933] text-[#ec4899] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Show Grades" description="Display vinyl condition grades in your collection">
          <Toggle on={showGrades} onToggle={() => setShowGrades(v => !v)} />
        </SettingsRow>
        <SettingsRow label="Show Estimated Values" description="Display median Discogs pricing next to records">
          <Toggle on={showValues} onToggle={() => setShowValues(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Improvement 25: Data Retention Policy Settings ────── */}
      <SectionHeader
        title="Data Retention"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>}
      />
      <SettingsCard>
        <div className="text-[11px] text-gs-dim mb-3">Control how long your data is retained on our servers.</div>
        <SettingsRow label="Listening History Retention" description="How long to keep your Vinyl Buddy listening data">
          <div className="flex gap-1">
            {[{ l: '6mo', v: '6months' }, { l: '1yr', v: '1year' }, { l: '2yr', v: '2years' }, { l: 'Forever', v: 'forever' }].map(opt => (
              <button
                key={opt.v}
                onClick={() => setRetentionPeriod(opt.v)}
                className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                  retentionPeriod === opt.v
                    ? 'bg-[#ef444411] border-[#ef444433] text-[#ef4444] font-bold'
                    : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Auto-Delete Old Messages" description="Automatically remove messages older than the specified period">
          <Toggle on={autoDeleteMessages} onToggle={() => setAutoDeleteMessages(v => !v)} />
        </SettingsRow>
        {autoDeleteMessages && (
          <div className="mt-2 flex items-center gap-2 ml-2">
            <span className="text-[10px] text-gs-dim font-mono">Delete after</span>
            <div className="flex gap-1">
              {['30', '60', '90', '180'].map(d => (
                <button
                  key={d}
                  onClick={() => setAutoDeleteMsgDays(d)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-mono cursor-pointer transition-all border ${
                    autoDeleteMsgDays === d
                      ? 'bg-[#ef444411] border-[#ef444433] text-[#ef4444] font-bold'
                      : 'bg-[#111] border-[#1a1a1a] text-gs-dim hover:border-[#333]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}
        <SettingsRow label="Anonymize Old Data" description="Strip personal identifiers from data older than retention period">
          <Toggle on={anonymizeOldData} onToggle={() => setAnonymizeOldData(v => !v)} />
        </SettingsRow>
      </SettingsCard>

      {/* ── Improvement 25: About / Credits ────────────────── */}
      <SectionHeader
        title="About"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>}
      />
      <SettingsCard className="mb-8">
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Version</span>
            <span className="text-[13px] text-gs-text font-mono">1.2.0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Build</span>
            <span className="text-[13px] text-gs-text font-mono">2026.03.20-stable</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Built with</span>
            <span className="text-[13px] text-gs-text">React + Tailwind</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gs-muted">Environment</span>
            <span className="text-[13px] text-gs-text font-mono">Production</span>
          </div>
          <div className="border-t border-[#111] pt-2.5 mt-2.5">
            <div className="text-[10px] text-gs-dim font-mono mb-2 uppercase tracking-[0.06em]">Credits</div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gs-muted">Design & Development</span>
                <span className="text-[11px] text-gs-text">GrooveStack Team</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gs-muted">Icons</span>
                <span className="text-[11px] text-gs-text">Lucide Icons</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gs-muted">UI Framework</span>
                <span className="text-[11px] text-gs-text">Tailwind CSS</span>
              </div>
            </div>
          </div>
          <div className="border-t border-[#111] pt-2.5 mt-2.5">
            <div className="flex gap-3">
              <button className="text-[11px] text-gs-accent hover:underline bg-transparent border-none cursor-pointer p-0">Terms of Service</button>
              <button className="text-[11px] text-gs-accent hover:underline bg-transparent border-none cursor-pointer p-0">Privacy Policy</button>
              <button className="text-[11px] text-gs-accent hover:underline bg-transparent border-none cursor-pointer p-0">Open Source</button>
              <button className="text-[11px] text-gs-accent hover:underline bg-transparent border-none cursor-pointer p-0">Changelog</button>
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
