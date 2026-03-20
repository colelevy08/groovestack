// Formatting utilities for display across the app.

/**
 * Format a price given in cents to a dollar string with two decimal places.
 *
 * @param {number} cents - Price in cents (e.g. 1999 → "$19.99").
 * @returns {string} Formatted price string, or "$0.00" for falsy input.
 */
export function formatPrice(cents) {
  if (cents == null || isNaN(cents)) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Returns "just now", "Xm ago", "Xh ago", "yesterday", or a short date.
 *
 * @param {number|string|Date} timestamp - A value parseable by `new Date()`.
 * @returns {string} Relative time string.
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return "";

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";

  const d = new Date(then);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Format a duration in seconds to a human-readable string.
 * Examples: 222 → "3m 42s", 3661 → "1h 1m 1s", 45 → "45s".
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Formatted duration string.
 */
export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return "0s";

  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

/**
 * Format a number with compact suffixes (k, M, B).
 * Examples: 1200 → "1.2k", 3400000 → "3.4M", 42 → "42".
 *
 * @param {number} n - The number to format.
 * @returns {string} Formatted number string.
 */
export function formatNumber(n) {
  if (n == null || isNaN(n)) return "0";

  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}${abs}`;
}

/**
 * Truncate text to a maximum length, appending an ellipsis if truncated.
 *
 * @param {string} text      - The text to truncate.
 * @param {number} maxLength - Maximum allowed length (including ellipsis).
 * @returns {string} Truncated text.
 */
export function truncateText(text, maxLength) {
  if (!text) return "";
  if (maxLength == null || maxLength < 1) return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "\u2026";
}

/** Map of condition codes to full display names. */
const CONDITION_NAMES = {
  M: "Mint",
  NM: "Near Mint",
  "VG+": "Very Good Plus",
  VG: "Very Good",
  "G+": "Good Plus",
  G: "Good",
  F: "Fair",
  P: "Poor",
};

/**
 * Expand a condition code to its full name.
 * Returns the code itself if unrecognized.
 *
 * @param {string} code - Condition code (e.g. "NM", "VG+").
 * @returns {string} Full condition name.
 */
export function formatCondition(code) {
  if (!code) return "";
  return CONDITION_NAMES[code] || code;
}
