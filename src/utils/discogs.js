// Discogs price lookup — fetches market prices for vinyl records.
// Uses Discogs search API (free, rate-limited to 60/min with user agent).
import { API_BASE } from './api';
import { getToken } from './supabase';

const cache = new Map();

/**
 * Simple rate-limiting queue to stay within Discogs API limits.
 * Ensures at most `maxPerInterval` requests per `interval` ms.
 */
class RateLimiter {
  constructor(maxPerInterval = 55, interval = 60000) {
    this.maxPerInterval = maxPerInterval;
    this.interval = interval;
    this.timestamps = [];
    this.queue = [];
    this.processing = false;
  }

  async schedule(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter(t => now - t < this.interval);

      if (this.timestamps.length >= this.maxPerInterval) {
        const waitTime = this.timestamps[0] + this.interval - now;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.timestamps.push(Date.now());
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    }

    this.processing = false;
  }
}

const limiter = new RateLimiter();

/** Build auth headers for API calls. */
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getDiscogsPrice(album, artist) {
  const key = `${artist}||${album}`.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/lookup?album=${encodeURIComponent(album)}&artist=${encodeURIComponent(artist)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return null;
      return res.json();
    });
    if (data) cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Search for a release by barcode or catalog number.
 *
 * @param {string} query - Barcode or catalog number string.
 * @returns {Promise<Object|null>} First matching release or null.
 */
export async function searchByBarcode(query) {
  const key = `barcode:${query}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/search?barcode=${encodeURIComponent(query)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return null;
      return res.json();
    });
    if (data) cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch an artist's discography (list of releases).
 *
 * @param {string} artistName - The artist name to look up.
 * @param {number} [page=1]   - Page number for pagination.
 * @returns {Promise<Object|null>} Discography data or null.
 */
export async function getArtistDiscography(artistName, page = 1) {
  const key = `discog:${artistName.toLowerCase()}:${page}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/discography?artist=${encodeURIComponent(artistName)}&page=${page}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return null;
      return res.json();
    });
    if (data) cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch detailed information for a specific release by its Discogs ID.
 *
 * @param {string|number} releaseId - The Discogs release ID.
 * @returns {Promise<Object|null>} Release details or null.
 */
export async function getReleaseDetails(releaseId) {
  const key = `release:${releaseId}`;
  if (cache.has(key)) return cache.get(key);

  try {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/release/${encodeURIComponent(releaseId)}`,
        { headers: authHeaders() }
      );
      if (!res.ok) return null;
      return res.json();
    });
    if (data) cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
