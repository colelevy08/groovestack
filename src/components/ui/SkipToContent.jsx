// Skip-to-content link — visible only on keyboard focus for screen reader and keyboard users.
// Placed at the very top of the app DOM.
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-gs-accent focus:text-black focus:px-4 focus:py-2 focus:rounded-lg focus:text-[13px] focus:font-bold focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
