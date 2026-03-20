// Artist info fetching utility.
// Uses Wikipedia REST API (free, no key, CORS-enabled) to fetch artist bios and images.
// Caches results in memory + localStorage to avoid redundant API calls.

const memoryCache = new Map();
const inFlight = new Map();
const LS_PREFIX = "gs_artist_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheKey(artist) {
  return (artist || "").toLowerCase().trim();
}

function lsKey(key) {
  return LS_PREFIX + key;
}

/**
 * Read from localStorage, respecting the 24-hour TTL.
 * Returns undefined if not cached or expired.
 */
function lsGet(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      // Support old format (no timestamp) and new format ({ data, ts })
      if (parsed && typeof parsed === "object" && parsed.ts) {
        if (Date.now() - parsed.ts > CACHE_TTL_MS) {
          localStorage.removeItem(lsKey(key));
          return undefined; // expired
        }
        return parsed.data;
      }
      // Legacy format — treat as valid but it will be refreshed on next write
      return parsed;
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Write to localStorage with a timestamp for TTL-based expiry.
 */
function lsSet(key, value) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify({ data: value, ts: Date.now() }));
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

/**
 * Fetch an artist's discography (list of albums) from MusicBrainz.
 * Returns an array of { title, year, type } objects sorted by year.
 *
 * @param {string} artist - The artist name.
 * @returns {Promise<Object[]|null>} Array of album objects or null on failure.
 */
export async function getArtistDiscography(artist) {
  if (!artist) return null;

  const key = `disco_${cacheKey(artist)}`;

  // Check memory cache
  if (memoryCache.has(key)) return memoryCache.get(key);

  // Check localStorage (with TTL)
  const cached = lsGet(key);
  if (cached !== undefined) {
    memoryCache.set(key, cached);
    return cached;
  }

  // Deduplicate in-flight
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      // Step 1: Search for the artist on MusicBrainz
      const searchResp = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`,
        { headers: { "User-Agent": "GrooveStack/1.0 (https://groovestack.app)" } }
      );
      if (!searchResp.ok) throw new Error(`HTTP ${searchResp.status}`);
      const searchData = await searchResp.json();
      const mbid = searchData.artists?.[0]?.id;
      if (!mbid) return null;

      // Step 2: Fetch release groups (albums) for this artist
      const rgResp = await fetch(
        `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&type=album&fmt=json&limit=100`,
        { headers: { "User-Agent": "GrooveStack/1.0 (https://groovestack.app)" } }
      );
      if (!rgResp.ok) throw new Error(`HTTP ${rgResp.status}`);
      const rgData = await rgResp.json();

      const albums = (rgData["release-groups"] || []).map(rg => ({
        title: rg.title,
        year: rg["first-release-date"]?.slice(0, 4) || "",
        type: rg["primary-type"] || "Album",
      })).sort((a, b) => (a.year || "9999").localeCompare(b.year || "9999"));

      memoryCache.set(key, albums);
      lsSet(key, albums);
      return albums;
    } catch {
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
 * Find related / similar artists using MusicBrainz artist relations.
 * Returns an array of { name, type } objects representing related artists.
 *
 * @param {string} artist - The artist name.
 * @returns {Promise<Object[]|null>} Array of related artist objects or null on failure.
 */
export async function getRelatedArtists(artist) {
  if (!artist) return null;

  const key = `related_${cacheKey(artist)}`;

  // Check memory cache
  if (memoryCache.has(key)) return memoryCache.get(key);

  // Check localStorage (with TTL)
  const cached = lsGet(key);
  if (cached !== undefined) {
    memoryCache.set(key, cached);
    return cached;
  }

  // Deduplicate in-flight
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      // Search for the artist on MusicBrainz
      const searchResp = await fetch(
        `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artist)}&fmt=json&limit=1`,
        { headers: { "User-Agent": "GrooveStack/1.0 (https://groovestack.app)" } }
      );
      if (!searchResp.ok) throw new Error(`HTTP ${searchResp.status}`);
      const searchData = await searchResp.json();
      const mbid = searchData.artists?.[0]?.id;
      if (!mbid) return null;

      // Fetch artist relations
      const relResp = await fetch(
        `https://musicbrainz.org/ws/2/artist/${mbid}?inc=artist-rels&fmt=json`,
        { headers: { "User-Agent": "GrooveStack/1.0 (https://groovestack.app)" } }
      );
      if (!relResp.ok) throw new Error(`HTTP ${relResp.status}`);
      const relData = await relResp.json();

      const related = (relData.relations || [])
        .filter(r => r.type === "member of band" || r.type === "collaboration" ||
                     r.type === "supporting musician" || r.type === "tribute")
        .map(r => ({
          name: r.artist?.name || r.target?.name || "",
          type: r.type,
        }))
        .filter(r => r.name && r.name.toLowerCase() !== artist.toLowerCase());

      // Deduplicate by name
      const seen = new Set();
      const unique = related.filter(r => {
        const lower = r.name.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });

      memoryCache.set(key, unique);
      lsSet(key, unique);
      return unique;
    } catch {
      memoryCache.set(key, null);
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
