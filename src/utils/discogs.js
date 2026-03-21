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

// ---------------------------------------------------------------------------
// 6. Collection import from Discogs username
// ---------------------------------------------------------------------------

/**
 * Import a user's Discogs collection (all folders, paginated).
 * Returns an array of simplified release objects.
 *
 * @param {string} username           - Discogs username.
 * @param {Function} [onProgress]     - Optional callback receiving { loaded, total }.
 * @returns {Promise<Object[]>} Array of { id, title, artist, year, format, thumb }.
 */
export async function importCollection(username, onProgress) {
  if (!username) throw new Error("Discogs username is required");

  const allReleases = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/discogs-collection?username=${encodeURIComponent(username)}&page=${page}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Collection fetch failed (${res.status})`);
      return res.json();
    });

    pages = data.pagination?.pages || 1;

    const releases = (data.releases || []).map(r => ({
      id: r.id || r.basic_information?.id,
      title: r.basic_information?.title || r.title || "",
      artist: r.basic_information?.artists?.map(a => a.name).join(", ") || "",
      year: r.basic_information?.year || null,
      format: r.basic_information?.formats?.map(f => f.name).join(", ") || "",
      thumb: r.basic_information?.thumb || null,
    }));

    allReleases.push(...releases);

    if (onProgress) {
      onProgress({ loaded: allReleases.length, total: data.pagination?.items || allReleases.length });
    }

    page++;
  }

  return allReleases;
}

// ---------------------------------------------------------------------------
// 7. Wantlist import from Discogs
// ---------------------------------------------------------------------------

/**
 * Import a user's Discogs wantlist (paginated).
 * Returns an array of simplified want objects.
 *
 * @param {string} username           - Discogs username.
 * @param {Function} [onProgress]     - Optional callback receiving { loaded, total }.
 * @returns {Promise<Object[]>} Array of { id, title, artist, year, notes, thumb }.
 */
export async function importWantlist(username, onProgress) {
  if (!username) throw new Error("Discogs username is required");

  const allWants = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const data = await limiter.schedule(async () => {
      const res = await fetch(
        `${API_BASE}/api/prices/discogs-wantlist?username=${encodeURIComponent(username)}&page=${page}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`Wantlist fetch failed (${res.status})`);
      return res.json();
    });

    pages = data.pagination?.pages || 1;

    const wants = (data.wants || []).map(w => ({
      id: w.id || w.basic_information?.id,
      title: w.basic_information?.title || w.title || "",
      artist: w.basic_information?.artists?.map(a => a.name).join(", ") || "",
      year: w.basic_information?.year || null,
      notes: w.notes || "",
      thumb: w.basic_information?.thumb || null,
    }));

    allWants.push(...wants);

    if (onProgress) {
      onProgress({ loaded: allWants.length, total: data.pagination?.items || allWants.length });
    }

    page++;
  }

  return allWants;
}

// ---------------------------------------------------------------------------
// 8. Release version comparison
// ---------------------------------------------------------------------------

/**
 * Compare two release versions to determine which is more desirable.
 * Scores based on format, country, and year factors.
 *
 * @param {Object} a - First release { format, country, year, ... }.
 * @param {Object} b - Second release { format, country, year, ... }.
 * @returns {number} Negative if a is preferred, positive if b is preferred, 0 if equal.
 */
export function compareReleaseVersions(a, b) {
  // Format preference: original vinyl > reissue vinyl > CD > digital
  const FORMAT_SCORE = { vinyl: 4, lp: 4, "12\"": 4, "7\"": 3, cd: 2, cassette: 1, digital: 0 };
  const COUNTRY_BONUS = { US: 2, UK: 2, JP: 1, DE: 1 };

  function scoreRelease(release) {
    let score = 0;
    const fmt = (release.format || "").toLowerCase();

    // Format score — check each known format keyword
    for (const [key, value] of Object.entries(FORMAT_SCORE)) {
      if (fmt.includes(key)) { score += value; break; }
    }

    // Country bonus
    const country = (release.country || "").toUpperCase();
    score += COUNTRY_BONUS[country] || 0;

    // Original pressing bonus: earlier year = higher score (within reason)
    const year = parseInt(release.year, 10);
    if (!isNaN(year) && year > 1900) {
      score += Math.max(0, 2030 - year) * 0.01; // slight preference for earlier pressings
    }

    return score;
  }

  return scoreRelease(b) - scoreRelease(a);
}
