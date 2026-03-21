// Keyboard shortcuts help overlay — shows all available shortcuts in organized sections.
// Triggered by Cmd+/ or from settings. Uses Modal for consistent behavior.
// Supports inline custom shortcut editing.
import { useState, useCallback, useEffect } from 'react';
import Modal from './Modal';

const DEFAULT_SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { id: 'nav-feed', keys: ['1'], description: 'Feed', editable: true },
      { id: 'nav-shop', keys: ['2'], description: 'Shop', editable: true },
      { id: 'nav-crate', keys: ['3'], description: 'Crate', editable: true },
      { id: 'nav-activity', keys: ['4'], description: 'Activity', editable: true },
      { id: 'nav-buddy', keys: ['5'], description: 'Vinyl Buddy', editable: true },
      { id: 'nav-profile', keys: ['6'], description: 'Profile', editable: true },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { id: 'act-new-record', keys: ['\u2318', 'N'], description: 'New record', editable: true },
      { id: 'act-new-post', keys: ['\u2318', 'P'], description: 'New post', editable: true },
      { id: 'act-search', keys: ['\u2318', 'K'], description: 'Search', editable: true },
    ],
  },
  {
    title: 'Settings & Help',
    shortcuts: [
      { id: 'set-settings', keys: ['\u2318', ','], description: 'Open settings', editable: true },
      { id: 'set-help', keys: ['\u2318', '/'], description: 'This help', editable: false },
    ],
  },
  {
    title: 'Modals',
    shortcuts: [
      { id: 'modal-close', keys: ['Esc'], description: 'Close modal / overlay', editable: false },
    ],
  },
];

const STORAGE_KEY = 'gs-custom-shortcuts';

function loadCustomShortcuts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCustomShortcuts(shortcuts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  } catch {
    // ignore
  }
}

// Map special key names for display
function formatKeyForDisplay(key) {
  const map = {
    'Meta': '\u2318',
    'Control': 'Ctrl',
    'Alt': '\u2325',
    'Shift': '\u21E7',
    'Escape': 'Esc',
    'Enter': '\u23CE',
    'Backspace': '\u232B',
    'Tab': '\u21E5',
    'ArrowUp': '\u2191',
    'ArrowDown': '\u2193',
    'ArrowLeft': '\u2190',
    'ArrowRight': '\u2192',
    ' ': 'Space',
  };
  return map[key] || (key.length === 1 ? key.toUpperCase() : key);
}

function Kbd({ children }) {
  return (
    <span className="gs-kbd text-[11px] min-w-[22px] h-[22px] px-1.5">
      {children}
    </span>
  );
}

// Inline shortcut editor component
function ShortcutEditor({ shortcutId, currentKeys, onSave, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState([]);
  const [conflict, setConflict] = useState(null);

  const handleStartRecording = useCallback(() => {
    setRecording(true);
    setRecordedKeys([]);
    setConflict(null);
  }, []);

  useEffect(() => {
    if (!recording) return;

    const pressedKeys = new Set();

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      pressedKeys.add(key);

      // Build the key combo
      const keys = [];
      if (e.metaKey) keys.push('\u2318');
      if (e.ctrlKey && !e.metaKey) keys.push('Ctrl');
      if (e.altKey) keys.push('\u2325');
      if (e.shiftKey) keys.push('\u21E7');

      // Add the main key (not a modifier)
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        keys.push(formatKeyForDisplay(key));
      }

      if (keys.length > 0 && !['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        setRecordedKeys(keys);
        setRecording(false);
      }
    };

    const handleKeyUp = () => {
      // If only modifiers were pressed and released, cancel
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording]);

  const handleSave = useCallback(() => {
    if (recordedKeys.length > 0) {
      onSave(recordedKeys);
    }
  }, [recordedKeys, onSave]);

  const handleReset = useCallback(() => {
    onSave(null); // null means reset to default
  }, [onSave]);

  return (
    <div className="flex items-center gap-2 animate-fade-in">
      {recording ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gs-accent animate-pulse font-medium">Press keys...</span>
          <button
            onClick={() => { setRecording(false); onCancel(); }}
            className="text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
          >
            Cancel
          </button>
        </div>
      ) : recordedKeys.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {recordedKeys.map((k, i) => (
              <Kbd key={i}>{k}</Kbd>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="text-[10px] text-emerald-400 bg-transparent border-none cursor-pointer hover:text-emerald-300 font-semibold"
          >
            Save
          </button>
          <button
            onClick={() => { setRecordedKeys([]); onCancel(); }}
            className="text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleStartRecording}
            className="text-[10px] text-gs-accent bg-gs-accent/10 border border-gs-accent/20 rounded px-2 py-0.5 cursor-pointer hover:bg-gs-accent/15 transition-colors font-medium"
          >
            Record
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
          >
            Reset
          </button>
          <button
            onClick={onCancel}
            className="text-[10px] text-gs-faint bg-transparent border-none cursor-pointer hover:text-gs-muted"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function KeyboardShortcutsHelp({ open, onClose, onShortcutChange }) {
  const [customShortcuts, setCustomShortcuts] = useState(loadCustomShortcuts);
  const [editingId, setEditingId] = useState(null);

  // Build sections with custom overrides applied
  const sections = DEFAULT_SECTIONS.map(section => ({
    ...section,
    shortcuts: section.shortcuts.map(shortcut => ({
      ...shortcut,
      keys: customShortcuts[shortcut.id] || shortcut.keys,
      isCustomized: !!customShortcuts[shortcut.id],
    })),
  }));

  const handleSaveShortcut = useCallback((shortcutId, newKeys) => {
    setCustomShortcuts(prev => {
      const updated = { ...prev };
      if (newKeys === null) {
        // Reset to default
        delete updated[shortcutId];
      } else {
        updated[shortcutId] = newKeys;
      }
      saveCustomShortcuts(updated);
      onShortcutChange?.(shortcutId, newKeys);
      return updated;
    });
    setEditingId(null);
  }, [onShortcutChange]);

  const handleResetAll = useCallback(() => {
    setCustomShortcuts({});
    saveCustomShortcuts({});
    onShortcutChange?.(null, null); // Signal full reset
    setEditingId(null);
  }, [onShortcutChange]);

  const hasCustomizations = Object.keys(customShortcuts).length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" size="md">
      <div className="space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <h3 className="gs-label mb-2.5 uppercase">{section.title}</h3>
            <div className="space-y-1.5">
              {section.shortcuts.map(({ id, keys, description, editable, isCustomized }) => (
                <div key={id || description} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#111] transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-gs-muted">{description}</span>
                    {isCustomized && (
                      <span className="text-[9px] text-gs-accent bg-gs-accent/10 rounded px-1 py-0.5 font-mono">
                        custom
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === id ? (
                      <ShortcutEditor
                        shortcutId={id}
                        currentKeys={keys}
                        onSave={(newKeys) => handleSaveShortcut(id, newKeys)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          {keys.map((k, i) => (
                            <Kbd key={i}>{k}</Kbd>
                          ))}
                        </div>
                        {/* Edit button (visible on hover) */}
                        {editable && (
                          <button
                            onClick={() => setEditingId(id)}
                            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-transparent border-none cursor-pointer text-gs-faint flex items-center justify-center hover:text-gs-accent transition-all"
                            aria-label={`Edit shortcut for ${description}`}
                            title="Customize shortcut"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between pt-2 border-t border-gs-border-subtle">
          <p className="text-[11px] text-gs-faint">
            Shortcuts are disabled when a modal is open (except Esc)
          </p>
          {hasCustomizations && (
            <button
              onClick={handleResetAll}
              className="text-[10px] text-gs-faint hover:text-gs-muted bg-transparent border-none cursor-pointer transition-colors font-mono"
            >
              Reset All
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
