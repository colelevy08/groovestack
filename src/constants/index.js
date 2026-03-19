// Static data constants shared across the entire app.
// USER_PROFILES is the source of truth for all non-current-user profile data (avatars, bios, followers).
// The current user's profile is stored separately in localStorage via App.js state.

// Genre → subgenre map. GENRES (flat list of parent genres) is derived below for backward compat.
export const GENRE_MAP = {
  "Rock":        ["Classic Rock","Indie Rock","Prog Rock","Psychedelic","Art Rock","Post-Rock"],
  "Jazz":        ["Bebop","Cool Jazz","Free Jazz","Fusion","Latin Jazz","Spiritual Jazz"],
  "Electronic":  ["House","Techno","Ambient","Drum & Bass","IDM","Synthwave","Downtempo"],
  "Hip-Hop":     ["Boom Bap","Trap","Conscious","Lo-Fi","Abstract"],
  "Metal":       ["Thrash","Death Metal","Black Metal","Doom","Prog Metal","Sludge"],
  "Pop":         ["Synth-Pop","Dream Pop","Art Pop","Indie Pop","K-Pop"],
  "Punk":        ["Hardcore","Post-Punk","Pop Punk","Crust","Straight Edge"],
  "R&B":         ["Neo-Soul","Contemporary R&B","Quiet Storm","New Jack Swing"],
  "Soul":        ["Northern Soul","Southern Soul","Psychedelic Soul"],
  "Folk":        ["Americana","Singer-Songwriter","Freak Folk","Celtic"],
  "Classical":   ["Baroque","Romantic","Contemporary","Minimalist"],
  "Funk":        ["P-Funk","Acid Funk","Go-Go","Afrobeat"],
  "Alternative": ["Shoegaze","Grunge","Britpop","Noise Rock","Post-Hardcore"],
  "Country":     ["Outlaw Country","Alt-Country","Bluegrass","Honky-Tonk"],
  "Reggae":      ["Dub","Roots Reggae","Dancehall","Ska","Rocksteady"],
  "Blues":       ["Delta Blues","Chicago Blues","Electric Blues"],
  "World":       ["Bossa Nova","Fado","Highlife","Cumbia"],
  "Experimental":["Noise","Avant-Garde","Musique Concrète"],
};

// Flat list of parent genre names — used by ExploreScreen filter pills and AddRecordModal tag pills
export const GENRES = Object.keys(GENRE_MAP);

// All subgenres as a flat set — used for tag validation
export const ALL_SUBGENRES = new Set(Object.values(GENRE_MAP).flat());

// Standardized Goldmine condition grades — used in AddRecordModal dropdown and condColor helper
export const CONDITIONS = ["M","NM","VG+","VG","G+","G","F","P"];

// Physical media formats — used in AddRecordModal dropdown
export const FORMATS = [
  "LP","CD","EP","Single","Box Set","Picture Disc","Colored Vinyl","Cassette",
];

// Accent colors randomly assigned to new records when they are created
export const ACCENT_COLORS = [
  "#0ea5e9","#f59e0b","#10b981","#ec4899","#a78bfa",
  "#f97316","#06b6d4","#84cc16","#ef4444","#8b5cf6",
];

// Static profiles for all non-current users — keyed by username handle.
// Each profile includes a display name, bio, location, favorite genre, accent color, followers list,
// and avatar/header image URLs (DiceBear + Picsum for a polished look).
export const USER_PROFILES = {
  "mara.vinyl":     { displayName:"Mara Chen",       bio:"Jazz collector & audiophile. First pressings only. Based in Portland.",         location:"Portland, OR",   favGenre:"Jazz",        accent:"#ec4899", followers:["thomas.wax","juniper.sounds","felix.rpm","cleo.spins","creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=mara.vinyl", headerUrl:"https://picsum.photos/seed/mara.vinyl/1200/400" },
  "thomas.wax":     { displayName:"Thomas Wax",       bio:"Classic rock obsessive. I have too many Zeppelin pressings.",                   location:"Nashville, TN",  favGenre:"Rock",        accent:"#a78bfa", followers:["mara.vinyl","creator","nadia.rpm"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=thomas.wax", headerUrl:"https://picsum.photos/seed/thomas.wax/1200/400" },
  "juniper.sounds": { displayName:"Juniper Isley",    bio:'Electronic music archivist. Warp, Hyperdub, 4AD. Rare 12"s welcome.',          location:"London, UK",     favGenre:"Electronic",  accent:"#f97316", followers:["mara.vinyl","felix.rpm","creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=juniper.sounds", headerUrl:"https://picsum.photos/seed/juniper.sounds/1200/400" },
  "felix.rpm":      { displayName:"Felix Romero",     bio:"Latin jazz, soul, and everything in between. Vinyl only.",                      location:"Miami, FL",      favGenre:"Jazz",        accent:"#06b6d4", followers:["mara.vinyl","creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=felix.rpm", headerUrl:"https://picsum.photos/seed/felix.rpm/1200/400" },
  "cleo.spins":     { displayName:"Cleo Park",        bio:"90s indie and shoegaze. My Sub Pop collection is getting out of hand.",         location:"Seattle, WA",    favGenre:"Alternative", accent:"#84cc16", followers:["thomas.wax","creator","beau.plays"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=cleo.spins", headerUrl:"https://picsum.photos/seed/cleo.spins/1200/400" },
  "otto.wax":       { displayName:"Otto Wax",          bio:"Post-punk and goth. The darker the better.",                                   location:"Berlin, DE",     favGenre:"Alternative", accent:"#ef4444", followers:["juniper.sounds","creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=otto.wax", headerUrl:"https://picsum.photos/seed/otto.wax/1200/400" },
  "nadia.rpm":      { displayName:"Nadia Reeves",     bio:"Hip-hop head. Boom bap era forever. DJ on the weekends.",                       location:"Brooklyn, NY",   favGenre:"Hip-Hop",     accent:"#8b5cf6", followers:["creator","cleo.spins"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=nadia.rpm", headerUrl:"https://picsum.photos/seed/nadia.rpm/1200/400" },
  "soren.stacks":   { displayName:"Søren Dahl",       bio:"Scandinavian jazz and ambient. Quiet records for loud rooms.",                  location:"Copenhagen, DK", favGenre:"Jazz",        accent:"#0ea5e9", followers:["creator","mara.vinyl"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=soren.stacks", headerUrl:"https://picsum.photos/seed/soren.stacks/1200/400" },
  "yuki.vinyl":     { displayName:"Yuki Tanaka",      bio:"City pop, J-jazz, and Shibuya-kei. Also deeply into Coltrane.",                location:"Tokyo, JP",      favGenre:"Jazz",        accent:"#f59e0b", followers:["creator","juniper.sounds"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=yuki.vinyl", headerUrl:"https://picsum.photos/seed/yuki.vinyl/1200/400" },
  "bjorn.grooves":  { displayName:"Björn Larsen",    bio:"Metal and classic rock. If it ain't loud it ain't right.",                      location:"Stockholm, SE",  favGenre:"Metal",       accent:"#10b981", followers:["creator","otto.wax"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=bjorn.grooves", headerUrl:"https://picsum.photos/seed/bjorn.grooves/1200/400" },
  "lena.records":   { displayName:"Lena Fischer",     bio:"Soul and R&B from the 60s-70s. Atlantic Records completist.",                   location:"Frankfurt, DE",  favGenre:"Soul",        accent:"#ec4899", followers:["creator","yuki.vinyl"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=lena.records", headerUrl:"https://picsum.photos/seed/lena.records/1200/400" },
  "max.plays":      { displayName:"Max Ortega",       bio:"Record store owner by day, compulsive digger by night.",                        location:"Chicago, IL",    favGenre:"Funk",        accent:"#a78bfa", followers:["creator","nadia.rpm"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=max.plays", headerUrl:"https://picsum.photos/seed/max.plays/1200/400" },
  "iris.rpm":       { displayName:"Iris Monroe",      bio:"Prog and art rock. Yes, I own every Yes album.",                                location:"Austin, TX",     favGenre:"Rock",        accent:"#f97316", followers:["creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=iris.rpm", headerUrl:"https://picsum.photos/seed/iris.rpm/1200/400" },
  "dax.wax":        { displayName:"Dax Williams",     bio:"Crate digger. If it costs under $5 and sounds incredible, I want it.",         location:"Detroit, MI",    favGenre:"Funk",        accent:"#06b6d4", followers:["creator","max.plays"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=dax.wax", headerUrl:"https://picsum.photos/seed/dax.wax/1200/400" },
  "milo.vinyl":     { displayName:"Milo Jensen",      bio:"Folk and Americana. Nick Drake completist. Crying is allowed.",                 location:"Vermont",        favGenre:"Folk",        accent:"#84cc16", followers:["creator","cleo.spins"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=milo.vinyl", headerUrl:"https://picsum.photos/seed/milo.vinyl/1200/400" },
  "petra.spins":    { displayName:"Petra Novak",      bio:"Classical and contemporary composition. Vinyl sounds better, always.",          location:"Vienna, AT",     favGenre:"Classical",   accent:"#ef4444", followers:["creator","yuki.vinyl"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=petra.spins", headerUrl:"https://picsum.photos/seed/petra.spins/1200/400" },
  "riku.records":   { displayName:"Riku Mäkinen",    bio:"Finnish metal and progressive rock. Also weirdly into bossa nova.",             location:"Helsinki, FI",   favGenre:"Metal",       accent:"#8b5cf6", followers:["creator"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=riku.records", headerUrl:"https://picsum.photos/seed/riku.records/1200/400" },
  "cass.stacks":    { displayName:"Cass O'Brien",     bio:"Punk and post-punk archivist. Have pressed several records myself.",            location:"Dublin, IE",     favGenre:"Punk",        accent:"#0ea5e9", followers:["creator","bjorn.grooves"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=cass.stacks", headerUrl:"https://picsum.photos/seed/cass.stacks/1200/400" },
  "beau.plays":     { displayName:"Beau Laurent",     bio:"French house and disco. Every Saturday is a dance party.",                     location:"Paris, FR",      favGenre:"Electronic",  accent:"#f59e0b", followers:["creator","cleo.spins"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=beau.plays", headerUrl:"https://picsum.photos/seed/beau.plays/1200/400" },
  "zara.grooves":   { displayName:"Zara Khan",        bio:"Reggae and dub. Lee Scratch Perry is my spirit animal.",                       location:"Manchester, UK", favGenre:"Reggae",      accent:"#10b981", followers:["creator","lena.records"], avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=zara.grooves", headerUrl:"https://picsum.photos/seed/zara.grooves/1200/400" },
};

// Synthetic wishlists for static users — albums they're looking for.
// Some deliberately match records in INITIAL_RECORDS so the "Make Offer" feature can be demonstrated.
export const USER_WISHLISTS = {
  "mara.vinyl":     [{ id: "w1", album: "A Love Supreme", artist: "John Coltrane" }, { id: "w2", album: "Bitches Brew", artist: "Miles Davis" }],
  "thomas.wax":     [{ id: "w3", album: "Houses of the Holy", artist: "Led Zeppelin" }, { id: "w4", album: "Who's Next", artist: "The Who" }],
  "juniper.sounds": [{ id: "w5", album: "Selected Ambient Works 85-92", artist: "Aphex Twin" }, { id: "w6", album: "Dummy", artist: "Portishead" }],
  "felix.rpm":      [{ id: "w7", album: "Head Hunters", artist: "Herbie Hancock" }, { id: "w8", album: "Maiden Voyage", artist: "Herbie Hancock" }],
  "cleo.spins":     [{ id: "w9", album: "Loveless", artist: "My Bloody Valentine" }, { id: "w10", album: "Souvlaki", artist: "Slowdive" }],
  "otto.wax":       [{ id: "w11", album: "Unknown Pleasures", artist: "Joy Division" }],
  "nadia.rpm":      [{ id: "w12", album: "Illmatic", artist: "Nas" }, { id: "w13", album: "Ready to Die", artist: "The Notorious B.I.G." }],
  "soren.stacks":   [{ id: "w14", album: "In a Silent Way", artist: "Miles Davis" }],
  "yuki.vinyl":     [{ id: "w15", album: "Moanin'", artist: "Art Blakey" }, { id: "w16", album: "Pacific", artist: "Haruomi Hosono" }],
  "bjorn.grooves":  [{ id: "w17", album: "Master of Puppets", artist: "Metallica" }, { id: "w18", album: "Paranoid", artist: "Black Sabbath" }],
  "lena.records":   [{ id: "w19", album: "What's Going On", artist: "Marvin Gaye" }],
  "max.plays":      [{ id: "w20", album: "Maggot Brain", artist: "Funkadelic" }, { id: "w21", album: "Standing on the Verge of Getting It On", artist: "Funkadelic" }],
  "iris.rpm":       [{ id: "w22", album: "Close to the Edge", artist: "Yes" }],
  "dax.wax":        [{ id: "w23", album: "There's a Riot Goin' On", artist: "Sly & The Family Stone" }],
  "milo.vinyl":     [{ id: "w24", album: "Pink Moon", artist: "Nick Drake" }, { id: "w25", album: "For Emma, Forever Ago", artist: "Bon Iver" }],
  "petra.spins":    [{ id: "w26", album: "Goldberg Variations", artist: "Glenn Gould" }],
  "riku.records":   [{ id: "w27", album: "Blackwater Park", artist: "Opeth" }],
  "cass.stacks":    [{ id: "w28", album: "Damaged", artist: "Black Flag" }, { id: "w29", album: "Entertainment!", artist: "Gang of Four" }],
  "beau.plays":     [{ id: "w30", album: "Homework", artist: "Daft Punk" }],
  "zara.grooves":   [{ id: "w31", album: "Catch a Fire", artist: "Bob Marley & The Wailers" }],
};
