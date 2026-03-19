// Seed listening history — simulates Vinyl Buddy sessions for demo purposes.
// When the Vinyl Buddy server is running, real sessions are merged in.
// Shape matches the server's /api/vinyl-buddy/history/:user response.

const now = Date.now();
const hr = 3600000;
const day = 86400000;

const INITIAL_LISTENING = [
  // ── creator (current user) ──────────────────────────────────────────────
  { id: "ls-001", username: "creator", deviceId: "AABB11223344", track: { title: "Wish You Were Here", artist: "Pink Floyd", album: "Wish You Were Here", year: 1975 }, score: 97, timestamp: new Date(now - 0.5 * hr).toISOString(), timestampMs: now - 0.5 * hr },
  { id: "ls-002", username: "creator", deviceId: "AABB11223344", track: { title: "So What", artist: "Miles Davis", album: "Kind of Blue", year: 1959 }, score: 94, timestamp: new Date(now - 2 * hr).toISOString(), timestampMs: now - 2 * hr },
  { id: "ls-003", username: "creator", deviceId: "AABB11223344", track: { title: "Paranoid Android", artist: "Radiohead", album: "OK Computer", year: 1997 }, score: 91, timestamp: new Date(now - 5 * hr).toISOString(), timestampMs: now - 5 * hr },
  { id: "ls-004", username: "creator", deviceId: "AABB11223344", track: { title: "Nights", artist: "Frank Ocean", album: "Blonde", year: 2016 }, score: 89, timestamp: new Date(now - 8 * hr).toISOString(), timestampMs: now - 8 * hr },
  { id: "ls-005", username: "creator", deviceId: "AABB11223344", track: { title: "Flim", artist: "Aphex Twin", album: "Come to Daddy", year: 1997 }, score: 93, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
  { id: "ls-006", username: "creator", deviceId: "AABB11223344", track: { title: "Everything In Its Right Place", artist: "Radiohead", album: "Kid A", year: 2000 }, score: 96, timestamp: new Date(now - 1.2 * day).toISOString(), timestampMs: now - 1.2 * day },
  { id: "ls-007", username: "creator", deviceId: "AABB11223344", track: { title: "Maiden Voyage", artist: "Herbie Hancock", album: "Maiden Voyage", year: 1965 }, score: 88, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },
  { id: "ls-008", username: "creator", deviceId: "AABB11223344", track: { title: "Redbone", artist: "Childish Gambino", album: "Awaken, My Love!", year: 2016 }, score: 95, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── mara.vinyl ──────────────────────────────────────────────────────────
  { id: "ls-101", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Svefn-g-englar", artist: "Sigur Ros", album: "Agaetis byrjun", year: 1999 }, score: 90, timestamp: new Date(now - 1 * hr).toISOString(), timestampMs: now - 1 * hr },
  { id: "ls-102", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Nude", artist: "Radiohead", album: "In Rainbows", year: 2007 }, score: 92, timestamp: new Date(now - 6 * hr).toISOString(), timestampMs: now - 6 * hr },
  { id: "ls-103", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Breathe", artist: "Pink Floyd", album: "The Dark Side of the Moon", year: 1973 }, score: 96, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },

  // ── thomas.wax ──────────────────────────────────────────────────────────
  { id: "ls-201", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "A Love Supreme, Pt. 1", artist: "John Coltrane", album: "A Love Supreme", year: 1965 }, score: 98, timestamp: new Date(now - 3 * hr).toISOString(), timestampMs: now - 3 * hr },
  { id: "ls-202", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "Blue in Green", artist: "Miles Davis", album: "Kind of Blue", year: 1959 }, score: 95, timestamp: new Date(now - 10 * hr).toISOString(), timestampMs: now - 10 * hr },
  { id: "ls-203", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "My Favorite Things", artist: "John Coltrane", album: "My Favorite Things", year: 1961 }, score: 91, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── juniper.sounds ──────────────────────────────────────────────────────
  { id: "ls-301", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Hyperballad", artist: "Bjork", album: "Post", year: 1995 }, score: 93, timestamp: new Date(now - 4 * hr).toISOString(), timestampMs: now - 4 * hr },
  { id: "ls-302", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Windowlicker", artist: "Aphex Twin", album: "Windowlicker", year: 1999 }, score: 87, timestamp: new Date(now - 12 * hr).toISOString(), timestampMs: now - 12 * hr },

  // ── nadia.rpm ───────────────────────────────────────────────────────────
  { id: "ls-401", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "Alright", artist: "Kendrick Lamar", album: "To Pimp a Butterfly", year: 2015 }, score: 94, timestamp: new Date(now - 2 * hr).toISOString(), timestampMs: now - 2 * hr },
  { id: "ls-402", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "Electric Feel", artist: "MGMT", album: "Oracular Spectacular", year: 2007 }, score: 90, timestamp: new Date(now - 18 * hr).toISOString(), timestampMs: now - 18 * hr },

  // ── felix.rpm ───────────────────────────────────────────────────────────
  { id: "ls-501", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", year: 1975 }, score: 99, timestamp: new Date(now - 7 * hr).toISOString(), timestampMs: now - 7 * hr },
  { id: "ls-502", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV", year: 1971 }, score: 97, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },

  // ── yuki.vinyl ──────────────────────────────────────────────────────────
  { id: "ls-601", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "Plastic Love", artist: "Mariya Takeuchi", album: "Variety", year: 1984 }, score: 92, timestamp: new Date(now - 3 * hr).toISOString(), timestampMs: now - 3 * hr },
  { id: "ls-602", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "Stay With Me", artist: "Miki Matsubara", album: "Pocket Park", year: 1980 }, score: 86, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
];

export default INITIAL_LISTENING;
