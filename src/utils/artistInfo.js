// Artist info fetching utility.
// Uses Wikipedia REST API (free, no key, CORS-enabled) to fetch artist bios and images.
// Caches results in memory + localStorage to avoid redundant API calls.

const memoryCache = new Map();
const inFlight = new Map();
const LS_PREFIX = "gs_artist_";

function cacheKey(artist) {
  return (artist || "").toLowerCase().trim();
}

function lsKey(key) {
  return LS_PREFIX + key;
}

function lsGet(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw !== null) return JSON.parse(raw);
  } catch { /* ignore */ }
  return undefined;
}

function lsSet(key, value) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch { /* quota exceeded */ }
}

/**
 * Fetch artist info (bio, image, description) from Wikipedia REST API.
 * Returns { name, bio, imageUrl, description } or a fallback.
 */
export async function getArtistInfo(artist) {
  if (!artist) return null;

  const key = cacheKey(artist);

  // 1. Memory cache
  if (memoryCache.has(key)) return memoryCache.get(key);

  // 2. localStorage
  const cached = lsGet(key);
  if (cached !== undefined) {
    memoryCache.set(key, cached);
    return cached;
  }

  // 3. Deduplicate in-flight
  if (inFlight.has(key)) return inFlight.get(key);

  // 4. Fetch from Wikipedia
  const promise = (async () => {
    try {
      // Wikipedia title format: replace spaces with underscores
      const title = encodeURIComponent(artist.trim());
      const resp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      // Check that we got a real article (not a disambiguation page)
      if (data.type === "disambiguation" || !data.extract) {
        // Try with "(band)" suffix for common disambiguation
        const bandResp = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${title}_(band)`
        );
        if (bandResp.ok) {
          const bandData = await bandResp.json();
          if (bandData.extract) {
            const result = {
              name: bandData.title || artist,
              bio: bandData.extract || "",
              imageUrl: bandData.thumbnail?.source?.replace(/\/\d+px-/, "/400px-") || null,
              description: bandData.description || "",
            };
            memoryCache.set(key, result);
            lsSet(key, result);
            return result;
          }
        }
      }

      const result = {
        name: data.title || artist,
        bio: data.extract || "",
        imageUrl: data.thumbnail?.source?.replace(/\/\d+px-/, "/400px-") || null,
        description: data.description || "",
      };
      memoryCache.set(key, result);
      lsSet(key, result);
      return result;
    } catch {
      // Cache null in memory only (allows retry next session)
      memoryCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
