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

/**
 * Convert a string to a URL-friendly slug.
 *
 * @param {string} str - The input string.
 * @returns {string} Slugified string.
 */
export function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Return a human-readable relative time string (e.g. "3 minutes ago").
 *
 * @param {Date|string|number} date - The date to compare against now.
 * @returns {string} Relative time string.
 */
export function relativeTime(date) {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

/**
 * Split an array into chunks of the given size.
 *
 * @param {Array} arr  - The array to chunk.
 * @param {number} size - Maximum chunk size.
 * @returns {Array[]} Array of chunks.
 */
export function chunk(arr, size) {
  if (!arr || size < 1) return [];
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Format a number in compact notation (e.g. 1200 -> "1.2K").
 *
 * @param {number} num - The number to format.
 * @returns {string} Compact formatted string.
 */
export function formatCompact(num) {
  if (num == null || isNaN(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${(num / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${(num / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(num);
}

/**
 * Parse URL query string into an object.
 *
 * @param {string} queryString - The query string (with or without leading ?).
 * @returns {Object} Parsed key-value pairs.
 */
export function parseQuery(queryString) {
  const str = queryString.startsWith("?") ? queryString.slice(1) : queryString;
  if (!str) return {};
  const result = {};
  for (const pair of str.split("&")) {
    const [key, ...rest] = pair.split("=");
    result[decodeURIComponent(key)] = decodeURIComponent(rest.join("="));
  }
  return result;
}

/**
 * Build a query string from an object.
 *
 * @param {Object} params - Key-value pairs.
 * @returns {string} Query string with leading "?", or empty string if no params.
 */
export function buildQuery(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/**
 * Set an item in localStorage with an optional expiry (in milliseconds).
 *
 * @param {string} key   - Storage key.
 * @param {*}      value - Value to store (will be JSON-serialized).
 * @param {number} [ttl] - Time-to-live in milliseconds. Omit for no expiry.
 */
export function setStorageItem(key, value, ttl) {
  const item = { value };
  if (ttl) item.expiry = Date.now() + ttl;
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/**
 * Get an item from localStorage, returning null if expired or missing.
 *
 * @param {string} key - Storage key.
 * @returns {*} The stored value, or null.
 */
export function getStorageItem(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (item.expiry && Date.now() > item.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return item.value;
  } catch {
    return null;
  }
}
