// Shared utility functions used across multiple components.
import { USER_PROFILES } from '../constants';

// Maps a record condition grade to its display color — used by Badge and record list rows
export const condColor = (c) =>
  ({ M:"#10b981", NM:"#34d399", "VG+":"#60a5fa", VG:"#a78bfa",
     "G+":"#fb923c", G:"#f87171", F:"#9ca3af", P:"#6b7280" }[c] || "#666");

// Returns the user's profile data or a safe fallback object for unknown usernames
export const getProfile = (username) =>
  USER_PROFILES[username] || { displayName: username, bio: "", location: "", favGenre: "", accent: "#0ea5e9", followers: [] };

// Derives a 1-2 character avatar monogram by taking the first letter of each dot-separated name segment
export const getInitials = (username) =>
  username.split(".").map(w => w[0]?.toUpperCase() || "").join("").slice(0, 2);

// Picks a random color from the ACCENT_COLORS array — used when creating new records
export const randomAccent = (ACCENT_COLORS) =>
  ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];

/**
 * Create a debounced version of a function that delays invocation until
 * `delay` ms have elapsed since the last call.
 *
 * @param {Function} fn    - The function to debounce.
 * @param {number}   delay - Delay in milliseconds.
 * @returns {Function} Debounced function with a `.cancel()` method.
 */
export function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Create a throttled version of a function that invokes at most once
 * per `delay` ms.
 *
 * @param {Function} fn    - The function to throttle.
 * @param {number}   delay - Minimum interval in milliseconds.
 * @returns {Function} Throttled function.
 */
export function throttle(fn, delay) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = delay - (now - last);
    clearTimeout(timer);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else {
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * Deep equality comparison for two values.
 * Handles primitives, arrays, plain objects, null, and undefined.
 *
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {boolean} True if deeply equal.
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Generate a unique ID string. Uses crypto.randomUUID when available,
 * falls back to a timestamp + random hex string.
 *
 * @returns {string} A unique identifier.
 */
export function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compose CSS class names conditionally.
 * Accepts strings, objects (key = class, value = condition), arrays, and falsy values.
 *
 * @param {...(string|Object|Array|false|null|undefined)} args - Class descriptors.
 * @returns {string} Space-separated class string.
 *
 * @example
 * classNames("btn", { "btn-active": isActive }, null, ["extra"])
 * // => "btn btn-active extra"
 */
export function classNames(...args) {
  const classes = [];
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === "string") {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      const inner = classNames(...arg);
      if (inner) classes.push(inner);
    } else if (typeof arg === "object") {
      for (const [key, value] of Object.entries(arg)) {
        if (value) classes.push(key);
      }
    }
  }
  return classes.join(" ");
}

/**
 * Copy text to the clipboard. Uses the Clipboard API when available,
 * falls back to a hidden textarea + execCommand.
 *
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} True if the copy succeeded.
 */
export async function copyToClipboard(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to fallback */ }

  // Fallback: hidden textarea
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Return a pluralized string based on count.
 *
 * @param {number} count    - The quantity.
 * @param {string} singular - Singular form (e.g. "record").
 * @param {string} [plural] - Optional plural form; defaults to singular + "s".
 * @returns {string} e.g. "1 record", "3 records".
 */
export function pluralize(count, singular, plural) {
  const form = count === 1 ? singular : (plural || `${singular}s`);
  return `${count} ${form}`;
}

/**
 * Validate an email address format.
 * Uses a practical regex that catches most common formats.
 *
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email appears valid.
 */
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
