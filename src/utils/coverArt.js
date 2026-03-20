// Album cover art fetching utility.
// Uses iTunes Search API (no API key needed) to find album artwork.
// Caches results in memory + localStorage to avoid redundant API calls.

const memoryCache = new Map();
const inFlight = new Map();
const LS_PREFIX = "gs_cover_";

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;

// One-time cleanup: remove cached nulls from localStorage so failed lookups retry
try {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(LS_PREFIX) && localStorage.getItem(k) === "null") {
      localStorage.removeItem(k);
    }
  });
} catch { /* ignore */ }

function cacheKey(album, artist) {
  return `${(artist || "").toLowerCase().trim()}|${(album || "").toLowerCase().trim()}`;
}

function lsKey(key) {
  return LS_PREFIX + key;
}

// Read from localStorage
function lsGet(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw !== null) return JSON.parse(raw); // could be null (not found) or a URL string
  } catch { /* ignore */ }
  return undefined; // means "not cached"
}

// Write to localStorage
function lsSet(key, value) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch { /* quota exceeded — silently ignore */ }
}

// Upgrade iTunes artwork URL to higher resolution
function upgradeUrl(url, size = 600) {
  if (!url) return null;
  return url.replace(/\d+x\d+bb/, `${size}x${size}bb`);
}

// Internal fetch helper — tries a search query and returns artwork URL or null
async function trySearch(query) {
  const resp = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=1`
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data.results?.[0]?.artworkUrl100
    ? upgradeUrl(data.results[0].artworkUrl100)
    : null;
}

/**
 * Fetch album cover art URL for a given album + artist.
 * Returns a URL string or null if not found.
 * Results are cached in memory and localStorage (successes only persisted).
 */
export async function getCoverUrl(album, artist) {
  if (!album && !artist) return null;

  const key = cacheKey(album, artist);

  // 1. Check memory cache
  if (memoryCache.has(key)) {
    cacheHits++;
    return memoryCache.get(key);
  }

  // 2. Check localStorage
  const cached = lsGet(key);
  if (cached !== undefined) {
    cacheHits++;
    memoryCache.set(key, cached);
    return cached;
  }

  cacheMisses++;

  // 3. Deduplicate in-flight requests
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  // 4. Fetch from iTunes Search API with fallback queries
  const promise = (async () => {
    try {
      // Primary query: "artist album"
      const primaryQuery = `${artist || ""} ${album || ""}`.trim();
      let url = await trySearch(primaryQuery);

      // Fallback 1: "album artist" (reversed order)
      if (!url && artist && album) {
        url = await trySearch(`${album} ${artist}`);
      }

      // Fallback 2: album name only (handles cases where artist name confuses search)
      if (!url && album) {
        url = await trySearch(album);
      }

      memoryCache.set(key, url);
      // Only persist successes to localStorage — failures retry next session
      if (url) lsSet(key, url);
      return url;
    } catch {
      // On error (CORS, network, etc), cache null in memory only
      memoryCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/**
 * Fetch cover art URLs for multiple records with rate limiting.
 * Processes requests in batches to avoid overwhelming the iTunes API.
 *
 * @param {Object[]} records - Array of record objects with `album`/`title` and `artist` fields.
 * @param {number} [concurrency=3] - Maximum concurrent requests.
 * @returns {Promise<Map<string, string|null>>} Map of "artist|album" → URL (or null).
 */
export async function getCoverUrls(records, concurrency = 3) {
  if (!records || records.length === 0) return new Map();

  const results = new Map();
  const queue = [...records];

  async function processNext() {
    while (queue.length > 0) {
      const record = queue.shift();
      const album = record.album || record.title || "";
      const artist = record.artist || "";
      const key = cacheKey(album, artist);
      const url = await getCoverUrl(album, artist);
      results.set(key, url);
      // Small delay between requests to respect rate limits
      if (queue.length > 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  // Launch `concurrency` workers
  const workers = Array.from({ length: Math.min(concurrency, records.length) }, () => processNext());
  await Promise.all(workers);

  return results;
}

/**
 * Get cache hit/miss statistics for cover art lookups.
 *
 * @returns {{ hits: number, misses: number, hitRate: number, memoryCacheSize: number }}
 */
export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
    memoryCacheSize: memoryCache.size,
  };
}

/**
 * Preload cover art for an array of records.
 * Fetches covers in the background with rate limiting — useful for
 * prefetching art for records that are visible or about to be visible.
 *
 * @param {Object[]} records - Array of record objects with `album`/`title` and `artist` fields.
 * @returns {Promise<void>}
 */
export async function preloadCovers(records) {
  if (!records || records.length === 0) return;

  // Filter to only records not already cached
  const uncached = records.filter(r => {
    const album = r.album || r.title || "";
    const artist = r.artist || "";
    const key = cacheKey(album, artist);
    return !memoryCache.has(key) && lsGet(key) === undefined;
  });

  if (uncached.length === 0) return;

  // Use getCoverUrls with conservative concurrency for background loading
  await getCoverUrls(uncached, 2);
}
