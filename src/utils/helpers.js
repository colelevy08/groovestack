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

// ---------------------------------------------------------------------------
// 1. Date formatting utilities
// ---------------------------------------------------------------------------

/**
 * Format a Date (or date-like value) into a readable string.
 *
 * @param {Date|string|number} date - The date to format.
 * @param {Object} [opts]           - Intl.DateTimeFormat options override.
 * @returns {string} Formatted date string, e.g. "Mar 20, 2026".
 */
export function formatDate(date, opts) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const defaults = { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts || defaults).format(d);
}

/**
 * Format a date range into a concise string.
 * Collapses shared month/year when possible.
 *
 * @param {Date|string|number} start - Start date.
 * @param {Date|string|number} end   - End date.
 * @returns {string} e.g. "Mar 5 – 12, 2026" or "Mar 5, 2026 – Apr 1, 2026".
 */
export function formatDateRange(start, end) {
  if (!start || !end) return formatDate(start || end);
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();

  if (sameMonth) {
    return `${months[s.getMonth()]} ${s.getDate()} \u2013 ${e.getDate()}, ${s.getFullYear()}`;
  }
  if (sameYear) {
    return `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${formatDate(s)} \u2013 ${formatDate(e)}`;
}

// ---------------------------------------------------------------------------
// 2. Array utilities
// ---------------------------------------------------------------------------

/**
 * Return a new array with duplicate values removed.
 * Accepts an optional key function for object arrays.
 *
 * @param {Array} arr      - The source array.
 * @param {Function} [keyFn] - Optional function to derive a comparison key from each item.
 * @returns {Array} De-duplicated array.
 */
export function unique(arr, keyFn) {
  if (!arr) return [];
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn ? keyFn(item) : item;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Group an array of objects by a key derived from each item.
 *
 * @param {Array} arr             - The source array.
 * @param {string|Function} keyOrFn - Property name or function returning the group key.
 * @returns {Object} Object mapping group keys to arrays of items.
 */
export function groupBy(arr, keyOrFn) {
  if (!arr) return {};
  const fn = typeof keyOrFn === "function" ? keyOrFn : (item) => item[keyOrFn];
  const groups = {};
  for (const item of arr) {
    const k = fn(item) ?? "__none__";
    (groups[k] ||= []).push(item);
  }
  return groups;
}

/**
 * Sort an array by a key, returning a new array.
 *
 * @param {Array} arr             - The source array.
 * @param {string|Function} keyOrFn - Property name or function returning sortable value.
 * @param {"asc"|"desc"} [order="asc"] - Sort direction.
 * @returns {Array} Sorted copy.
 */
export function sortBy(arr, keyOrFn, order = "asc") {
  if (!arr) return [];
  const fn = typeof keyOrFn === "function" ? keyOrFn : (item) => item[keyOrFn];
  const dir = order === "desc" ? -1 : 1;
  return [...arr].sort((a, b) => {
    const va = fn(a);
    const vb = fn(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

/**
 * Shuffle an array using the Fisher-Yates algorithm.
 * Returns a new array; does not mutate the original.
 *
 * @param {Array} arr - The source array.
 * @returns {Array} Shuffled copy.
 */
export function shuffle(arr) {
  if (!arr) return [];
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// 3. String utilities
// ---------------------------------------------------------------------------

/**
 * Capitalize the first letter of a string.
 *
 * @param {string} str - Input string.
 * @returns {string} Capitalized string.
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a camelCase string to kebab-case.
 *
 * @param {string} str - camelCase or PascalCase string.
 * @returns {string} kebab-case string.
 */
export function camelToKebab(str) {
  if (!str) return "";
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Extract initials from a name string (first letter of each word, max 2).
 *
 * @param {string} name - Full name, e.g. "Miles Davis".
 * @returns {string} Initials, e.g. "MD".
 */
export function initials(name) {
  if (!name) return "";
  return name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

// ---------------------------------------------------------------------------
// 4. Number utilities
// ---------------------------------------------------------------------------

/**
 * Clamp a number to a [min, max] range.
 *
 * @param {number} value - The value to clamp.
 * @param {number} min   - Lower bound.
 * @param {number} max   - Upper bound.
 * @returns {number} Clamped value.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values.
 *
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Interpolation factor (0 = a, 1 = b).
 * @returns {number} Interpolated value.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map a value from one numeric range to another.
 *
 * @param {number} value   - Input value.
 * @param {number} inMin   - Input range minimum.
 * @param {number} inMax   - Input range maximum.
 * @param {number} outMin  - Output range minimum.
 * @param {number} outMax  - Output range maximum.
 * @returns {number} Mapped value.
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ---------------------------------------------------------------------------
// 5. Color utilities
// ---------------------------------------------------------------------------

/**
 * Convert a hex color string to an { r, g, b } object.
 *
 * @param {string} hex - Hex color, e.g. "#ff9900" or "ff9900".
 * @returns {{ r: number, g: number, b: number }|null} RGB object or null if invalid.
 */
export function hexToRgb(hex) {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "");
  const full = clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Convert an { r, g, b } object (or three separate args) to a hex string.
 *
 * @param {number|Object} rOrObj - Red channel (0-255), or { r, g, b } object.
 * @param {number} [g]          - Green channel.
 * @param {number} [b]          - Blue channel.
 * @returns {string} Hex color string, e.g. "#0ea5e9".
 */
export function rgbToHex(rOrObj, g, b) {
  let r;
  if (typeof rOrObj === "object" && rOrObj !== null) {
    ({ r, g, b } = rOrObj);
  } else {
    r = rOrObj;
  }
  const toHex = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Lighten a hex color by a given amount.
 *
 * @param {string} hex    - Hex color string.
 * @param {number} amount - Amount to lighten (0-1, where 1 = white).
 * @returns {string} Lightened hex color.
 */
export function lighten(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount,
  );
}

/**
 * Darken a hex color by a given amount.
 *
 * @param {string} hex    - Hex color string.
 * @param {number} amount - Amount to darken (0-1, where 1 = black).
 * @returns {string} Darkened hex color.
 */
export function darken(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r * (1 - amount),
    rgb.g * (1 - amount),
    rgb.b * (1 - amount),
  );
}

// ---------------------------------------------------------------------------
// 6. Image compression utility
// ---------------------------------------------------------------------------

/**
 * Compress an image file or blob by drawing it onto a canvas and exporting
 * at the requested quality and optional max dimensions.
 *
 * Works in browser environments only (requires Canvas / Image APIs).
 *
 * @param {File|Blob} file               - The source image file.
 * @param {Object}    [opts]             - Compression options.
 * @param {number}    [opts.maxWidth=1920]  - Maximum output width in pixels.
 * @param {number}    [opts.maxHeight=1920] - Maximum output height in pixels.
 * @param {number}    [opts.quality=0.8]    - JPEG/WebP quality (0-1).
 * @param {string}    [opts.type='image/jpeg'] - Output MIME type.
 * @returns {Promise<{blob: Blob, width: number, height: number, originalSize: number, compressedSize: number, ratio: number}>}
 */
export async function compressImage(file, opts = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    type = "image/jpeg",
  } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down proportionally if either dimension exceeds the max
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas toBlob returned null"));
          resolve({
            blob,
            width,
            height,
            originalSize: file.size,
            compressedSize: blob.size,
            ratio: Math.round((blob.size / file.size) * 100),
          });
        },
        type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// 7. Performance timing utility
// ---------------------------------------------------------------------------

/**
 * Measure the execution time of a synchronous or asynchronous function.
 *
 * @param {string}   label - A descriptive label for the measurement.
 * @param {Function} fn    - The function to measure. May be async.
 * @returns {Promise<{result: *, duration: number, label: string}>}
 *   An object containing the function's return value, the elapsed time in ms,
 *   and the label.
 *
 * @example
 * const { result, duration } = await measurePerformance('fetchRecords', () => fetch('/api/records'));
 * console.log(`${duration}ms`);
 */
export async function measurePerformance(label, fn) {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const result = await fn();
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    const duration = Math.round((end - start) * 100) / 100;
    return { result, duration, label };
  } catch (err) {
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    const duration = Math.round((end - start) * 100) / 100;
    err._perfDuration = duration;
    err._perfLabel = label;
    throw err;
  }
}

/**
 * Create a reusable performance tracker that accumulates multiple measurements.
 *
 * @returns {{ mark: Function, getMarks: Function, summary: Function }}
 *
 * @example
 * const perf = createPerfTracker();
 * perf.mark('db-query', 45.2);
 * perf.mark('render', 12.1);
 * console.log(perf.summary()); // { total: 57.3, marks: [...] }
 */
export function createPerfTracker() {
  const marks = [];

  return {
    /** Record a named timing measurement in milliseconds. */
    mark(label, durationMs) {
      marks.push({ label, duration: durationMs, timestamp: Date.now() });
    },
    /** Return all recorded marks. */
    getMarks() {
      return [...marks];
    },
    /** Return a summary with total time and all individual marks. */
    summary() {
      const total = marks.reduce((sum, m) => sum + m.duration, 0);
      return {
        total: Math.round(total * 100) / 100,
        count: marks.length,
        marks: marks.map(m => ({ label: m.label, duration: m.duration })),
      };
    },
  };
}
