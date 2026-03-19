// Album cover art fetching utility.
// Uses iTunes Search API (no API key needed) to find album artwork.
// Caches results in memory + localStorage to avoid redundant API calls.

const memoryCache = new Map();
const inFlight = new Map();
const LS_PREFIX = "gs_cover_";

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
    return memoryCache.get(key);
  }

  // 2. Check localStorage
  const cached = lsGet(key);
  if (cached !== undefined) {
    memoryCache.set(key, cached);
    return cached;
  }

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
