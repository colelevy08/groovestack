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

// ---------------------------------------------------------------------------
// 15. Funnel tracking (view -> detail -> offer -> purchase)
// ---------------------------------------------------------------------------

/** Standard funnel stages for record browsing. */
export const FUNNEL_STAGES = ["view", "detail", "offer", "purchase"];

/**
 * Track a funnel step for a given item.
 * Stores each step with a timestamp so conversion rates can be computed.
 *
 * @param {string} itemId - Unique identifier for the item (e.g. record ID).
 * @param {string} stage  - Funnel stage ("view", "detail", "offer", "purchase").
 */
export function trackFunnelStep(itemId, stage) {
  if (!itemId || !FUNNEL_STAGES.includes(stage)) return;

  const store = loadStore();
  const day = todayKey();
  const bucket = ensureBucket(store, day);

  if (!bucket.funnel) bucket.funnel = {};
  if (!bucket.funnel[itemId]) bucket.funnel[itemId] = {};

  // Only record the first occurrence of each stage per item per day
  if (!bucket.funnel[itemId][stage]) {
    bucket.funnel[itemId][stage] = Date.now();
  }

  saveStore(store);
}

/**
 * Get funnel conversion rates for a given day.
 * Returns the count of items at each stage and drop-off rates.
 *
 * @param {string} [day] - Date key (YYYY-MM-DD). Defaults to today.
 * @returns {{ stages: Object<string, number>, conversions: Object<string, number> }}
 */
export function getFunnelStats(day) {
  const store = loadStore();
  const bucket = store[day || todayKey()];
  if (!bucket?.funnel) {
    return {
      stages: Object.fromEntries(FUNNEL_STAGES.map(s => [s, 0])),
      conversions: {},
    };
  }

  const items = Object.values(bucket.funnel);
  const stages = {};
  for (const stage of FUNNEL_STAGES) {
    stages[stage] = items.filter(item => item[stage]).length;
  }

  const conversions = {};
  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const from = FUNNEL_STAGES[i - 1];
    const to = FUNNEL_STAGES[i];
    conversions[`${from}_to_${to}`] = stages[from] > 0 ? stages[to] / stages[from] : 0;
  }

  return { stages, conversions };
}

// ---------------------------------------------------------------------------
// 16. Session recording (page views with timestamps)
// ---------------------------------------------------------------------------

const SESSION_KEY = "gs_session";
let currentSessionId = null;

/**
 * Start or resume a session. Generates a unique session ID.
 * @returns {string} The session ID.
 */
function ensureSession() {
  if (currentSessionId) return currentSessionId;
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      currentSessionId = parsed.id;
      return currentSessionId;
    }
  } catch { /* ignore */ }

  currentSessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: currentSessionId, started: Date.now() }));
  } catch { /* ignore */ }
  return currentSessionId;
}

/**
 * Record a page view with a timestamp in the current session.
 * Builds a detailed session timeline for replay/analysis.
 *
 * @param {string} page      - Page or route path.
 * @param {Object} [meta={}] - Optional metadata (e.g. scroll depth, referrer).
 */
export function recordSessionPageView(page, meta = {}) {
  if (!page) return;

  const sessionId = ensureSession();
  const store = loadStore();
  const day = todayKey();
  const bucket = ensureBucket(store, day);

  if (!bucket.sessions) bucket.sessions = {};
  if (!bucket.sessions[sessionId]) bucket.sessions[sessionId] = [];

  bucket.sessions[sessionId].push({
    page,
    ts: Date.now(),
    ...meta,
  });

  saveStore(store);
}

/**
 * Get all session recordings for a given day.
 *
 * @param {string} [day] - Date key (YYYY-MM-DD). Defaults to today.
 * @returns {Object} Map of sessionId -> array of page view entries.
 */
export function getSessionRecordings(day) {
  const store = loadStore();
  const bucket = store[day || todayKey()];
  return bucket?.sessions || {};
}

// ---------------------------------------------------------------------------
// 17. Event batching for performance
// ---------------------------------------------------------------------------

/**
 * Batches analytics events and flushes them periodically to reduce
 * the number of localStorage writes.
 */
class EventBatcher {
  /**
   * @param {number} [flushInterval=5000] - Flush interval in milliseconds.
   * @param {number} [maxBatchSize=20]    - Max events before auto-flush.
   */
  constructor(flushInterval = 5000, maxBatchSize = 20) {
    this.flushInterval = flushInterval;
    this.maxBatchSize = maxBatchSize;
    this.batch = [];
    this.timer = null;
  }

  /**
   * Add an event to the batch.
   *
   * @param {string} category - Event category.
   * @param {string} action   - Event action.
   * @param {string} [label]  - Optional label.
   */
  push(category, action, label) {
    this.batch.push({ category, action, label, ts: Date.now() });

    if (this.batch.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Flush all batched events to the analytics store immediately.
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) return;

    const events = [...this.batch];
    this.batch = [];

    const store = loadStore();
    const day = todayKey();
    const bucket = ensureBucket(store, day);

    for (const { category, action, label } of events) {
      const eventKey = label ? `${category}/${action}/${label}` : `${category}/${action}`;
      bucket.events[eventKey] = (bucket.events[eventKey] || 0) + 1;
    }

    saveStore(store);
  }

  /** Number of events waiting to be flushed. */
  get pending() {
    return this.batch.length;
  }
}

/** Shared event batcher instance — use instead of trackEvent for high-frequency events. */
export const eventBatcher = new EventBatcher();

// Flush pending events when the page is about to unload
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") eventBatcher.flush();
  });
  window.addEventListener("beforeunload", () => eventBatcher.flush());
}
