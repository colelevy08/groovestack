// Auth utility — JWT-based auth via the Express backend.
// Custom auth endpoints on the Railway server (signup, login, profile).
// Includes retry logic for failed API calls (#19).
import { API_BASE } from './api';

const TOKEN_KEY = 'gs_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Safe JSON parse — handles empty responses, HTML error pages, etc.
async function safeJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
}

// Retry logic for failed API calls (#19)
// Retries up to `maxRetries` times with exponential backoff for network errors and 5xx responses.
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry client errors (4xx), only server errors (5xx)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      // Server error — retry
      lastError = new Error(`Server error (${res.status})`);
    } catch (err) {
      // Network error — retry
      lastError = err;
    }

    // Wait before retrying: 500ms, 1000ms, 2000ms (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError || new Error('Request failed after retries');
}

// Sign up — returns { token, user } or throws
export async function signUp({ email, password, username, displayName }) {
  let res;
  try {
    res = await fetchWithRetry(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    }, 2);
  } catch (err) {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `Signup failed (${res.status})`);
  setToken(data.token);
  return data;
}

// Log in — returns { token, user } or throws
export async function signIn({ email, password }) {
  let res;
  try {
    res = await fetchWithRetry(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 2);
  } catch (err) {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  setToken(data.token);
  return data;
}

// Get current user profile from token
export async function getMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/auth/me`, { headers: authHeaders() }, 2);
    if (!res.ok) { setToken(null); return null; }
    return await safeJson(res);
  } catch {
    return null;
  }
}

// Update profile (with retry)
export async function updateProfile(profile) {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(profile),
    }, 3);
    return res.ok;
  } catch {
    return false;
  }
}

// Update username — returns new token (with retry)
export async function updateUsername(username) {
  const res = await fetchWithRetry(`${API_BASE}/api/auth/username`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  }, 2);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.error || 'Username change failed');
  if (data.token) setToken(data.token);
  return data;
}

// Check username availability (with retry)
export async function checkUsername(username) {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/auth/check-username/${encodeURIComponent(username)}`, {}, 1);
    const data = await safeJson(res);
    return data.available !== false;
  } catch {
    return true;
  }
}

// Sign out
export function signOut() {
  setToken(null);
}

// Backward compat — components used to check `if (supabase)`
export const supabase = null;

// ---------------------------------------------------------------------------
// 18. Request queue for offline support
// ---------------------------------------------------------------------------

const OFFLINE_QUEUE_KEY = "gs_offline_queue";

/**
 * Queue a request for later execution when the network is unavailable.
 * Requests are persisted in localStorage and replayed when connectivity returns.
 *
 * @param {string} url     - Request URL.
 * @param {Object} options - Fetch options (method, headers, body).
 */
export function enqueueOfflineRequest(url, options = {}) {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    queue.push({
      url,
      options: { ...options, body: options.body || null },
      ts: Date.now(),
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* storage full */ }
}

/**
 * Replay all queued offline requests sequentially.
 * Removes successfully sent requests from the queue.
 *
 * @returns {Promise<{ sent: number, failed: number }>} Results summary.
 */
export async function flushOfflineQueue() {
  let queue;
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return { sent: 0, failed: 0 };
  }

  if (queue.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const remaining = [];

  for (const entry of queue) {
    try {
      const res = await fetch(entry.url, entry.options);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Success or client error (don't retry client errors)
        sent++;
      } else {
        remaining.push(entry);
        failed++;
      }
    } catch {
      remaining.push(entry);
      failed++;
    }
  }

  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch { /* ignore */ }

  return { sent, failed };
}

// Auto-flush when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => flushOfflineQueue());
}

// ---------------------------------------------------------------------------
// 19. Response caching with TTL
// ---------------------------------------------------------------------------

const responseCache = new Map();

/**
 * Fetch with response caching. Returns cached data if still within TTL.
 *
 * @param {string} url          - Request URL.
 * @param {Object} [options={}] - Fetch options.
 * @param {number} [ttlMs=60000] - Cache TTL in milliseconds (default 60 seconds).
 * @returns {Promise<any>} Parsed JSON response.
 */
export async function fetchWithCache(url, options = {}, ttlMs = 60000) {
  const cacheKey = `${options.method || "GET"}:${url}`;
  const cached = responseCache.get(cacheKey);

  if (cached && (Date.now() - cached.ts) < ttlMs) {
    return cached.data;
  }

  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  responseCache.set(cacheKey, { data, ts: Date.now() });

  // Evict old entries if the cache grows too large
  if (responseCache.size > 200) {
    const cutoff = Date.now() - ttlMs * 2;
    for (const [k, v] of responseCache) {
      if (v.ts < cutoff) responseCache.delete(k);
    }
  }

  return data;
}

/**
 * Invalidate a cached response.
 *
 * @param {string} url             - Request URL.
 * @param {string} [method="GET"]  - HTTP method.
 */
export function invalidateCache(url, method = "GET") {
  responseCache.delete(`${method}:${url}`);
}

/** Clear the entire response cache. */
export function clearResponseCache() {
  responseCache.clear();
}

// ---------------------------------------------------------------------------
// 20. Retry with circuit breaker pattern
// ---------------------------------------------------------------------------

/**
 * Circuit breaker for API calls. Prevents hammering a failing endpoint
 * by "opening" the circuit after repeated failures.
 */
class CircuitBreaker {
  /**
   * @param {number} [failureThreshold=5] - Failures before the circuit opens.
   * @param {number} [resetTimeMs=30000]  - Time in ms before attempting to close the circuit.
   */
  constructor(failureThreshold = 5, resetTimeMs = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeMs = resetTimeMs;
    this.failures = 0;
    this.state = "closed"; // "closed" (normal), "open" (failing), "half-open" (testing)
    this.nextAttempt = 0;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws immediately if the circuit is open (without calling fn).
   *
   * @param {Function} fn - Async function to execute.
   * @returns {Promise<*>} Result of fn.
   * @throws {Error} If circuit is open or fn throws.
   */
  async execute(fn) {
    if (this.state === "open") {
      if (Date.now() < this.nextAttempt) {
        throw new Error("Circuit breaker is open — request blocked");
      }
      // Transition to half-open: allow one test request
      this.state = "half-open";
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  /** @private */
  _onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  /** @private */
  _onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold || this.state === "half-open") {
      this.state = "open";
      this.nextAttempt = Date.now() + this.resetTimeMs;
    }
  }

  /** Current circuit state. */
  get isOpen() {
    return this.state === "open" && Date.now() < this.nextAttempt;
  }

  /** Reset the circuit breaker to closed state. */
  reset() {
    this.failures = 0;
    this.state = "closed";
    this.nextAttempt = 0;
  }
}

/**
 * Fetch with retry logic and circuit breaker protection.
 * Combines exponential backoff retries with circuit breaker to avoid
 * hammering endpoints that are persistently failing.
 *
 * @param {string} url                - Request URL.
 * @param {Object} [options={}]       - Fetch options.
 * @param {Object} [config]           - Retry / circuit breaker config.
 * @param {number} [config.maxRetries=3]          - Max retry attempts.
 * @param {number} [config.failureThreshold=5]    - Circuit breaker failure threshold.
 * @param {number} [config.resetTimeMs=30000]     - Circuit breaker reset time.
 * @returns {Promise<Response>} Fetch response.
 */
const circuitBreakers = new Map();

export async function fetchWithCircuitBreaker(url, options = {}, config = {}) {
  const { maxRetries = 3, failureThreshold = 5, resetTimeMs = 30000 } = config;

  // Use one circuit breaker per origin
  const origin = new URL(url, window.location.origin).origin;
  if (!circuitBreakers.has(origin)) {
    circuitBreakers.set(origin, new CircuitBreaker(failureThreshold, resetTimeMs));
  }
  const breaker = circuitBreakers.get(origin);

  return breaker.execute(async () => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok || (res.status >= 400 && res.status < 500)) return res;
        lastError = new Error(`Server error (${res.status})`);
      } catch (err) {
        lastError = err;
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
    throw lastError || new Error("Request failed after retries");
  });
}

/** Get or create a circuit breaker for a given origin. Exposed for testing / monitoring. */
export function getCircuitBreaker(origin) {
  return circuitBreakers.get(origin) || null;
}
