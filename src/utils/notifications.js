// Browser notification utility.
// Handles push notification permissions, display, and notification sounds
// using the Web Audio API.

/**
 * Request browser push notification permission.
 * Returns the resulting permission state: "granted", "denied", or "default".
 *
 * @returns {Promise<string>} The permission state after the request.
 */
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  return Notification.requestPermission();
}

/**
 * Show a browser notification. Requests permission first if needed.
 * Returns the Notification instance or null if notifications are not available.
 *
 * @param {string} title - The notification title.
 * @param {string} [body]  - The notification body text.
 * @param {string} [icon]  - URL of an icon to display.
 * @returns {Promise<Notification|null>}
 */
export async function showNotification(title, body, icon) {
  if (!("Notification" in window)) return null;

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const options = {};
  if (body) options.body = body;
  if (icon) options.icon = icon;

  return new Notification(title, options);
}

/**
 * Play a subtle notification sound using the Web Audio API.
 * Generates a short, pleasant two-tone chime.
 * Safe to call even if AudioContext is not available.
 */
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone — higher pitch
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone — slightly lower, delayed
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.15); // D6
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);

    // Close the audio context after sounds finish
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Web Audio API not available — silently ignore
  }
}
