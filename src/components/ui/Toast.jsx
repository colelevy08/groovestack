// Brief pop-up notification bar at the bottom center of the screen.
// Slides up and fades in when visible=true; slides away when false.
// App.js controls visibility via showToast(), which auto-hides after 2.2 seconds.
export default function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : "16px"})`,
      background: "#0ea5e9", color: "#000", padding: "10px 20px",
      borderRadius: 10, fontSize: 13, fontWeight: 700,
      zIndex: 2000, opacity: visible ? 1 : 0,
      transition: "all 0.25s", pointerEvents: "none",
    }}>
      {message}
    </div>
  );
}
