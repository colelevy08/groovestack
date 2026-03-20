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
  { id: "ls-009", username: "creator", deviceId: "AABB11223344", track: { title: "Goodbye Pork Pie Hat", artist: "Charles Mingus", album: "Mingus Ah Um", year: 1959 }, score: 92, timestamp: new Date(now - 2.5 * day).toISOString(), timestampMs: now - 2.5 * day },
  { id: "ls-010", username: "creator", deviceId: "AABB11223344", track: { title: "Chameleon", artist: "Herbie Hancock", album: "Head Hunters", year: 1973 }, score: 96, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },
  { id: "ls-011", username: "creator", deviceId: "AABB11223344", track: { title: "Teardrop", artist: "Massive Attack", album: "Mezzanine", year: 1998 }, score: 90, timestamp: new Date(now - 3.5 * day).toISOString(), timestampMs: now - 3.5 * day },
  { id: "ls-012", username: "creator", deviceId: "AABB11223344", track: { title: "Only Shallow", artist: "My Bloody Valentine", album: "Loveless", year: 1991 }, score: 94, timestamp: new Date(now - 4 * day).toISOString(), timestampMs: now - 4 * day },
  { id: "ls-013", username: "creator", deviceId: "AABB11223344", track: { title: "N.Y. State of Mind", artist: "Nas", album: "Illmatic", year: 1994 }, score: 97, timestamp: new Date(now - 5 * day).toISOString(), timestampMs: now - 5 * day },

  // ── mara.vinyl ──────────────────────────────────────────────────────────
  { id: "ls-101", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Svefn-g-englar", artist: "Sigur Ros", album: "Agaetis byrjun", year: 1999 }, score: 90, timestamp: new Date(now - 1 * hr).toISOString(), timestampMs: now - 1 * hr },
  { id: "ls-102", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Nude", artist: "Radiohead", album: "In Rainbows", year: 2007 }, score: 92, timestamp: new Date(now - 6 * hr).toISOString(), timestampMs: now - 6 * hr },
  { id: "ls-103", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Breathe", artist: "Pink Floyd", album: "The Dark Side of the Moon", year: 1973 }, score: 96, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
  { id: "ls-104", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Naima", artist: "John Coltrane", album: "Giant Steps", year: 1960 }, score: 95, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },
  { id: "ls-105", username: "mara.vinyl", deviceId: "CC1122334455", track: { title: "Blue in Green", artist: "Miles Davis", album: "Kind of Blue", year: 1959 }, score: 98, timestamp: new Date(now - 3.5 * day).toISOString(), timestampMs: now - 3.5 * day },

  // ── thomas.wax ──────────────────────────────────────────────────────────
  { id: "ls-201", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "A Love Supreme, Pt. 1", artist: "John Coltrane", album: "A Love Supreme", year: 1965 }, score: 98, timestamp: new Date(now - 3 * hr).toISOString(), timestampMs: now - 3 * hr },
  { id: "ls-202", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "Blue in Green", artist: "Miles Davis", album: "Kind of Blue", year: 1959 }, score: 95, timestamp: new Date(now - 10 * hr).toISOString(), timestampMs: now - 10 * hr },
  { id: "ls-203", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "My Favorite Things", artist: "John Coltrane", album: "My Favorite Things", year: 1961 }, score: 91, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },
  { id: "ls-204", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "Whole Lotta Love", artist: "Led Zeppelin", album: "Led Zeppelin II", year: 1969 }, score: 96, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },
  { id: "ls-205", username: "thomas.wax", deviceId: "DD2233445566", track: { title: "Baba O'Riley", artist: "The Who", album: "Who's Next", year: 1971 }, score: 93, timestamp: new Date(now - 4.5 * day).toISOString(), timestampMs: now - 4.5 * day },

  // ── juniper.sounds ──────────────────────────────────────────────────────
  { id: "ls-301", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Hyperballad", artist: "Bjork", album: "Post", year: 1995 }, score: 93, timestamp: new Date(now - 4 * hr).toISOString(), timestampMs: now - 4 * hr },
  { id: "ls-302", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Windowlicker", artist: "Aphex Twin", album: "Windowlicker", year: 1999 }, score: 87, timestamp: new Date(now - 12 * hr).toISOString(), timestampMs: now - 12 * hr },
  { id: "ls-303", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Archangel", artist: "Burial", album: "Untrue", year: 2007 }, score: 95, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },
  { id: "ls-304", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Roygbiv", artist: "Boards of Canada", album: "Music Has the Right to Children", year: 1998 }, score: 91, timestamp: new Date(now - 2.5 * day).toISOString(), timestampMs: now - 2.5 * day },
  { id: "ls-305", username: "juniper.sounds", deviceId: "EE3344556677", track: { title: "Da Funk", artist: "Daft Punk", album: "Homework", year: 1997 }, score: 88, timestamp: new Date(now - 4 * day).toISOString(), timestampMs: now - 4 * day },

  // ── nadia.rpm ───────────────────────────────────────────────────────────
  { id: "ls-401", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "Alright", artist: "Kendrick Lamar", album: "To Pimp a Butterfly", year: 2015 }, score: 94, timestamp: new Date(now - 2 * hr).toISOString(), timestampMs: now - 2 * hr },
  { id: "ls-402", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "Electric Feel", artist: "MGMT", album: "Oracular Spectacular", year: 2007 }, score: 90, timestamp: new Date(now - 18 * hr).toISOString(), timestampMs: now - 18 * hr },
  { id: "ls-403", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "C.R.E.A.M.", artist: "Wu-Tang Clan", album: "Enter the Wu-Tang (36 Chambers)", year: 1993 }, score: 96, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },
  { id: "ls-404", username: "nadia.rpm", deviceId: "FF4455667788", track: { title: "Juicy", artist: "The Notorious B.I.G.", album: "Ready to Die", year: 1994 }, score: 97, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },

  // ── felix.rpm ───────────────────────────────────────────────────────────
  { id: "ls-501", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", year: 1975 }, score: 99, timestamp: new Date(now - 7 * hr).toISOString(), timestampMs: now - 7 * hr },
  { id: "ls-502", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV", year: 1971 }, score: 97, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },
  { id: "ls-503", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Watermelon Man", artist: "Herbie Hancock", album: "Head Hunters", year: 1973 }, score: 93, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },
  { id: "ls-504", username: "felix.rpm", deviceId: "AA5566778899", track: { title: "Oye Como Va", artist: "Tito Puente", album: "Dance Mania", year: 1958 }, score: 91, timestamp: new Date(now - 5 * day).toISOString(), timestampMs: now - 5 * day },

  // ── yuki.vinyl ──────────────────────────────────────────────────────────
  { id: "ls-601", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "Plastic Love", artist: "Mariya Takeuchi", album: "Variety", year: 1984 }, score: 92, timestamp: new Date(now - 3 * hr).toISOString(), timestampMs: now - 3 * hr },
  { id: "ls-602", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "Stay With Me", artist: "Miki Matsubara", album: "Pocket Park", year: 1980 }, score: 86, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
  { id: "ls-603", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "Scenery", artist: "Ryo Fukui", album: "Scenery", year: 1976 }, score: 94, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },
  { id: "ls-604", username: "yuki.vinyl", deviceId: "BB6677889900", track: { title: "My Favorite Things", artist: "John Coltrane", album: "My Favorite Things", year: 1961 }, score: 97, timestamp: new Date(now - 4 * day).toISOString(), timestampMs: now - 4 * day },

  // ── cleo.spins ──────────────────────────────────────────────────────────
  { id: "ls-701", username: "cleo.spins", deviceId: "CC7788990011", track: { title: "When You Sleep", artist: "My Bloody Valentine", album: "Loveless", year: 1991 }, score: 96, timestamp: new Date(now - 1 * hr).toISOString(), timestampMs: now - 1 * hr },
  { id: "ls-702", username: "cleo.spins", deviceId: "CC7788990011", track: { title: "Alison", artist: "Slowdive", album: "Souvlaki", year: 1993 }, score: 93, timestamp: new Date(now - 8 * hr).toISOString(), timestampMs: now - 8 * hr },
  { id: "ls-703", username: "cleo.spins", deviceId: "CC7788990011", track: { title: "Mayonaise", artist: "The Smashing Pumpkins", album: "Siamese Dream", year: 1993 }, score: 90, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── otto.wax ────────────────────────────────────────────────────────────
  { id: "ls-801", username: "otto.wax", deviceId: "DD8899001122", track: { title: "Disorder", artist: "Joy Division", album: "Unknown Pleasures", year: 1979 }, score: 95, timestamp: new Date(now - 2 * hr).toISOString(), timestampMs: now - 2 * hr },
  { id: "ls-802", username: "otto.wax", deviceId: "DD8899001122", track: { title: "Bela Lugosi's Dead", artist: "Bauhaus", album: "In the Flat Field", year: 1980 }, score: 91, timestamp: new Date(now - 14 * hr).toISOString(), timestampMs: now - 14 * hr },
  { id: "ls-803", username: "otto.wax", deviceId: "DD8899001122", track: { title: "A Forest", artist: "The Cure", album: "Seventeen Seconds", year: 1980 }, score: 88, timestamp: new Date(now - 2.5 * day).toISOString(), timestampMs: now - 2.5 * day },

  // ── bjorn.grooves ───────────────────────────────────────────────────────
  { id: "ls-901", username: "bjorn.grooves", deviceId: "EE9900112233", track: { title: "Battery", artist: "Metallica", album: "Master of Puppets", year: 1986 }, score: 98, timestamp: new Date(now - 5 * hr).toISOString(), timestampMs: now - 5 * hr },
  { id: "ls-902", username: "bjorn.grooves", deviceId: "EE9900112233", track: { title: "War Pigs", artist: "Black Sabbath", album: "Paranoid", year: 1970 }, score: 95, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
  { id: "ls-903", username: "bjorn.grooves", deviceId: "EE9900112233", track: { title: "Raining Blood", artist: "Slayer", album: "Reign in Blood", year: 1986 }, score: 97, timestamp: new Date(now - 3.5 * day).toISOString(), timestampMs: now - 3.5 * day },

  // ── lena.records ────────────────────────────────────────────────────────
  { id: "ls-1001", username: "lena.records", deviceId: "FF0011223344", track: { title: "Respect", artist: "Aretha Franklin", album: "I Never Loved a Man the Way I Love You", year: 1967 }, score: 99, timestamp: new Date(now - 4 * hr).toISOString(), timestampMs: now - 4 * hr },
  { id: "ls-1002", username: "lena.records", deviceId: "FF0011223344", track: { title: "A Change Is Gonna Come", artist: "Sam Cooke", album: "Ain't That Good News", year: 1964 }, score: 96, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },
  { id: "ls-1003", username: "lena.records", deviceId: "FF0011223344", track: { title: "Try a Little Tenderness", artist: "Otis Redding", album: "Complete & Unbelievable", year: 1966 }, score: 94, timestamp: new Date(now - 4 * day).toISOString(), timestampMs: now - 4 * day },

  // ── max.plays ───────────────────────────────────────────────────────────
  { id: "ls-1101", username: "max.plays", deviceId: "AA1122334466", track: { title: "Flash Light", artist: "Parliament", album: "Funkentelechy vs. the Placebo Syndrome", year: 1977 }, score: 95, timestamp: new Date(now - 6 * hr).toISOString(), timestampMs: now - 6 * hr },
  { id: "ls-1102", username: "max.plays", deviceId: "AA1122334466", track: { title: "Maggot Brain", artist: "Funkadelic", album: "Maggot Brain", year: 1971 }, score: 98, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── soren.stacks ────────────────────────────────────────────────────────
  { id: "ls-1201", username: "soren.stacks", deviceId: "BB2233445577", track: { title: "1/1", artist: "Brian Eno", album: "Music for Airports", year: 1978 }, score: 90, timestamp: new Date(now - 9 * hr).toISOString(), timestampMs: now - 9 * hr },
  { id: "ls-1202", username: "soren.stacks", deviceId: "BB2233445577", track: { title: "In a Sentimental Mood", artist: "Duke Ellington & John Coltrane", album: "Duke Ellington & John Coltrane", year: 1963 }, score: 93, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── dax.wax ─────────────────────────────────────────────────────────────
  { id: "ls-1301", username: "dax.wax", deviceId: "CC3344556688", track: { title: "Superstition", artist: "Stevie Wonder", album: "Talking Book", year: 1972 }, score: 96, timestamp: new Date(now - 3 * hr).toISOString(), timestampMs: now - 3 * hr },
  { id: "ls-1302", username: "dax.wax", deviceId: "CC3344556688", track: { title: "Papa Was a Rollin' Stone", artist: "The Temptations", album: "All Directions", year: 1972 }, score: 89, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },

  // ── beau.plays ──────────────────────────────────────────────────────────
  { id: "ls-1401", username: "beau.plays", deviceId: "DD4455667799", track: { title: "Around the World", artist: "Daft Punk", album: "Homework", year: 1997 }, score: 94, timestamp: new Date(now - 5 * hr).toISOString(), timestampMs: now - 5 * hr },
  { id: "ls-1402", username: "beau.plays", deviceId: "DD4455667799", track: { title: "Giorgio by Moroder", artist: "Daft Punk", album: "Random Access Memories", year: 2013 }, score: 97, timestamp: new Date(now - 1 * day).toISOString(), timestampMs: now - 1 * day },
  { id: "ls-1403", username: "beau.plays", deviceId: "DD4455667799", track: { title: "I Feel Love", artist: "Donna Summer", album: "I Remember Yesterday", year: 1977 }, score: 92, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },

  // ── zara.grooves ────────────────────────────────────────────────────────
  { id: "ls-1501", username: "zara.grooves", deviceId: "EE5566778800", track: { title: "Stir It Up", artist: "Bob Marley & The Wailers", album: "Catch a Fire", year: 1973 }, score: 93, timestamp: new Date(now - 7 * hr).toISOString(), timestampMs: now - 7 * hr },
  { id: "ls-1502", username: "zara.grooves", deviceId: "EE5566778800", track: { title: "Chase the Devil", artist: "Max Romeo & The Upsetters", album: "War ina Babylon", year: 1976 }, score: 90, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── iris.rpm ────────────────────────────────────────────────────────────
  { id: "ls-1601", username: "iris.rpm", deviceId: "FF6677889911", track: { title: "Roundabout", artist: "Yes", album: "Fragile", year: 1971 }, score: 94, timestamp: new Date(now - 11 * hr).toISOString(), timestampMs: now - 11 * hr },
  { id: "ls-1602", username: "iris.rpm", deviceId: "FF6677889911", track: { title: "21st Century Schizoid Man", artist: "King Crimson", album: "In the Court of the Crimson King", year: 1969 }, score: 92, timestamp: new Date(now - 2 * day).toISOString(), timestampMs: now - 2 * day },

  // ── riku.records ────────────────────────────────────────────────────────
  { id: "ls-1701", username: "riku.records", deviceId: "AA7788990022", track: { title: "The Drapery Falls", artist: "Opeth", album: "Blackwater Park", year: 2001 }, score: 96, timestamp: new Date(now - 6 * hr).toISOString(), timestampMs: now - 6 * hr },
  { id: "ls-1702", username: "riku.records", deviceId: "AA7788990022", track: { title: "Aguas de Marco", artist: "Tom Jobim", album: "Matita Pere", year: 1973 }, score: 85, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },

  // ── cass.stacks ─────────────────────────────────────────────────────────
  { id: "ls-1801", username: "cass.stacks", deviceId: "BB8899001133", track: { title: "Rise Above", artist: "Black Flag", album: "Damaged", year: 1981 }, score: 95, timestamp: new Date(now - 4 * hr).toISOString(), timestampMs: now - 4 * hr },
  { id: "ls-1802", username: "cass.stacks", deviceId: "BB8899001133", track: { title: "Damaged Goods", artist: "Gang of Four", album: "Entertainment!", year: 1979 }, score: 91, timestamp: new Date(now - 1.5 * day).toISOString(), timestampMs: now - 1.5 * day },

  // ── milo.vinyl ──────────────────────────────────────────────────────────
  { id: "ls-1901", username: "milo.vinyl", deviceId: "CC9900112244", track: { title: "River Man", artist: "Nick Drake", album: "Five Leaves Left", year: 1969 }, score: 93, timestamp: new Date(now - 8 * hr).toISOString(), timestampMs: now - 8 * hr },
  { id: "ls-1902", username: "milo.vinyl", deviceId: "CC9900112244", track: { title: "Skinny Love", artist: "Bon Iver", album: "For Emma, Forever Ago", year: 2007 }, score: 89, timestamp: new Date(now - 2.5 * day).toISOString(), timestampMs: now - 2.5 * day },

  // ── petra.spins ─────────────────────────────────────────────────────────
  { id: "ls-2001", username: "petra.spins", deviceId: "DD0011223355", track: { title: "Goldberg Variations: Aria", artist: "Glenn Gould", album: "Goldberg Variations", year: 1955 }, score: 97, timestamp: new Date(now - 10 * hr).toISOString(), timestampMs: now - 10 * hr },
  { id: "ls-2002", username: "petra.spins", deviceId: "DD0011223355", track: { title: "Gymnopedies No. 1", artist: "Erik Satie", album: "Gymnopedies", year: 1888 }, score: 88, timestamp: new Date(now - 3 * day).toISOString(), timestampMs: now - 3 * day },
];

export default INITIAL_LISTENING;
