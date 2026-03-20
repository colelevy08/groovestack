// Keyboard shortcuts help overlay — shows all available shortcuts in organized sections.
// Triggered by Cmd+/ or from settings. Uses Modal for consistent behavior.
import Modal from './Modal';

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['1'], description: 'Feed' },
      { keys: ['2'], description: 'Shop' },
      { keys: ['3'], description: 'Crate' },
      { keys: ['4'], description: 'Activity' },
      { keys: ['5'], description: 'Vinyl Buddy' },
      { keys: ['6'], description: 'Profile' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['\u2318', 'N'], description: 'New record' },
      { keys: ['\u2318', 'P'], description: 'New post' },
      { keys: ['\u2318', 'K'], description: 'Search' },
    ],
  },
  {
    title: 'Settings & Help',
    shortcuts: [
      { keys: ['\u2318', ','], description: 'Open settings' },
      { keys: ['\u2318', '/'], description: 'This help' },
    ],
  },
  {
    title: 'Modals',
    shortcuts: [
      { keys: ['Esc'], description: 'Close modal / overlay' },
    ],
  },
];

function Kbd({ children }) {
  return (
    <span className="gs-kbd text-[11px] min-w-[22px] h-[22px] px-1.5">
      {children}
    </span>
  );
}

export default function KeyboardShortcutsHelp({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" size="md">
      <div className="space-y-5">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <h3 className="gs-label mb-2.5 uppercase">{section.title}</h3>
            <div className="space-y-1.5">
              {section.shortcuts.map(({ keys, description }) => (
                <div key={description} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#111] transition-colors">
                  <span className="text-[13px] text-gs-muted">{description}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k, i) => (
                      <Kbd key={i}>{k}</Kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-gs-faint text-center pt-2 border-t border-gs-border-subtle">
          Shortcuts are disabled when a modal is open (except Esc)
        </p>
      </div>
    </Modal>
  );
}
