// Client-side analytics utility.
// Tracks page views, button clicks, and feature usage.
// Stores data in localStorage with daily aggregation.

const LS_KEY = "gs_analytics";

/**
 * Load the analytics store from localStorage.
 * @returns {Object} The full analytics object keyed by date string (YYYY-MM-DD).
 */
function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save the analytics store to localStorage.
 * @param {Object} store - The analytics object to persist.
 */
function saveStore(store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch { /* quota exceeded — silently ignore */ }
}

/**
 * Get today's date key in YYYY-MM-DD format.
 * @returns {string}
 */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ensure a day bucket exists and return a reference to it.
 * @param {Object} store
 * @param {string} day
 * @returns {Object} The day's analytics bucket.
 */
function ensureBucket(store, day) {
  if (!store[day]) {
    store[day] = { pageViews: {}, events: {} };
  }
  return store[day];
}

/**
 * Track a generic event with category, action, and optional label.
 * Events are aggregated as counts per (category/action/label) per day.
 *
 * @param {string} category - Event category (e.g. "button", "feature").
 * @param {string} action   - Event action (e.g. "click", "toggle").
 * @param {string} [label]  - Optional label for further detail.
 */
export function trackEvent(category, action, label) {
  if (!category || !action) return;

  const store = loadStore();
  const bucket = ensureBucket(store, todayKey());
  const eventKey = label ? `${category}/${action}/${label}` : `${category}/${action}`;

  bucket.events[eventKey] = (bucket.events[eventKey] || 0) + 1;
  saveStore(store);
}

/**
 * Track a page view. Views are aggregated as counts per page per day.
 *
 * @param {string} page - The page or route name (e.g. "/collection", "/explore").
 */
export function trackPageView(page) {
  if (!page) return;

  const store = loadStore();
  const bucket = ensureBucket(store, todayKey());

  bucket.pageViews[page] = (bucket.pageViews[page] || 0) + 1;
  saveStore(store);
}

/**
 * Retrieve the full analytics dataset.
 * Returns an object keyed by date (YYYY-MM-DD) with pageViews and events sub-objects.
 *
 * @returns {Object} The analytics store — { [date]: { pageViews: {}, events: {} } }
 */
export function getAnalytics() {
  return loadStore();
}
