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
  "Experimental":["Noise","Avant-Garde","Musique Concr\u00E8te"],
};

// Flat list of parent genre names — used by ExploreScreen filter pills and AddRecordModal tag pills
export const GENRES = Object.keys(GENRE_MAP);

// All subgenres as a flat set — used for tag validation
export const ALL_SUBGENRES = new Set(Object.values(GENRE_MAP).flat());

// Standardized Goldmine condition grades — used in AddRecordModal dropdown and condColor helper
export const CONDITIONS = ["M","NM","VG+","VG","G+","G","F","P"];

// Expanded condition grade descriptions for grading guide UI and tooltips
export const CONDITIONS_DETAIL = {
  "M":   { label: "Mint", description: "Unplayed, still sealed or absolutely perfect. No marks, no wear.", color: "#10b981" },
  "NM":  { label: "Near Mint", description: "Nearly perfect. Played carefully, no visible wear. Sleeve intact with minimal shelf wear.", color: "#22c55e" },
  "VG+": { label: "Very Good Plus", description: "Light marks that do not affect playback. Slight sleeve wear. Most collector-grade records.", color: "#84cc16" },
  "VG":  { label: "Very Good", description: "Noticeable surface marks, light scratches. Plays through without skipping. Some sleeve wear.", color: "#eab308" },
  "G+":  { label: "Good Plus", description: "Surface noise evident, some scratches. Still enjoyable but audible wear. Sleeve has ring wear or splits.", color: "#f59e0b" },
  "G":   { label: "Good", description: "Significant wear affecting playback. Scratches, scuffs. Sleeve damaged but intact.", color: "#f97316" },
  "F":   { label: "Fair", description: "Heavy wear, plays through with distortion and noise. Sleeve heavily damaged.", color: "#ef4444" },
  "P":   { label: "Poor", description: "Barely playable, may skip. For completion only. Sleeve may be missing or destroyed.", color: "#dc2626" },
};

// Physical media formats — used in AddRecordModal dropdown
export const FORMATS = [
  "LP","CD","EP","Single","Box Set","Picture Disc","Colored Vinyl","Cassette",
];

// Accent colors randomly assigned to new records when they are created
export const ACCENT_COLORS = [
  "#0ea5e9","#f59e0b","#10b981","#ec4899","#a78bfa",
  "#f97316","#06b6d4","#84cc16","#ef4444","#8b5cf6",
];

// Price range buckets for marketplace filter UI
export const PRICE_RANGES = [
  { label: "Under $10",    min: 0,   max: 10   },
  { label: "$10 – $25",    min: 10,  max: 25   },
  { label: "$25 – $50",    min: 25,  max: 50   },
  { label: "$50 – $100",   min: 50,  max: 100  },
  { label: "$100 – $250",  min: 100, max: 250  },
  { label: "$250 – $500",  min: 250, max: 500  },
  { label: "$500+",        min: 500, max: Infinity },
];

// Notification event types — used by NotificationScreen and notification badge
export const NOTIFICATION_TYPES = {
  LIKE:           "like",
  COMMENT:        "comment",
  FOLLOW:         "follow",
  OFFER:          "offer",
  OFFER_ACCEPTED: "offer_accepted",
  OFFER_DECLINED: "offer_declined",
  SALE:           "sale",
  PRICE_DROP:     "price_drop",
  WISHLIST_MATCH: "wishlist_match",
  MENTION:        "mention",
  NEW_RECORD:     "new_record",
  VERIFIED:       "verified",
};

// Order / transaction statuses — used by marketplace purchase flow
export const ORDER_STATUSES = {
  PENDING:    "pending",
  ACCEPTED:   "accepted",
  PAID:       "paid",
  SHIPPED:    "shipped",
  DELIVERED:  "delivered",
  COMPLETED:  "completed",
  CANCELLED:  "cancelled",
  REFUNDED:   "refunded",
  DISPUTED:   "disputed",
};

// Achievement badge definitions — unlocked based on collection milestones and listening activity
export const ACHIEVEMENTS = [
  { id: "first_spin",       icon: "play-circle",    title: "First Spin",         description: "Listen to your first record",                    threshold: 1,   type: "listens" },
  { id: "ten_spins",        icon: "disc",           title: "Getting Warmed Up",  description: "Listen to 10 records",                           threshold: 10,  type: "listens" },
  { id: "fifty_spins",      icon: "headphones",     title: "Audiophile",         description: "Listen to 50 records",                           threshold: 50,  type: "listens" },
  { id: "hundred_spins",    icon: "award",          title: "Vinyl Devotee",      description: "Listen to 100 records",                          threshold: 100, type: "listens" },
  { id: "first_record",     icon: "package",        title: "Crate Beginner",     description: "Add your first record to your collection",       threshold: 1,   type: "collection" },
  { id: "ten_records",      icon: "archive",        title: "Serious Collector",  description: "Own 10 records",                                 threshold: 10,  type: "collection" },
  { id: "fifty_records",    icon: "database",       title: "Crate Digger",       description: "Own 50 records",                                 threshold: 50,  type: "collection" },
  { id: "hundred_records",  icon: "shield",         title: "Vinyl Vault",        description: "Own 100 records",                                threshold: 100, type: "collection" },
  { id: "five_hundred",     icon: "crown",          title: "Record Royalty",     description: "Own 500 records",                                threshold: 500, type: "collection" },
  { id: "first_sale",       icon: "dollar-sign",    title: "First Sale",         description: "Sell your first record on the marketplace",      threshold: 1,   type: "sales" },
  { id: "ten_sales",        icon: "trending-up",    title: "Trusted Seller",     description: "Complete 10 sales",                              threshold: 10,  type: "sales" },
  { id: "streak_3",         icon: "zap",            title: "Three-Day Streak",   description: "Listen to vinyl 3 days in a row",                threshold: 3,   type: "streak" },
  { id: "streak_7",         icon: "flame",          title: "Week Warrior",       description: "Listen to vinyl 7 days in a row",                threshold: 7,   type: "streak" },
  { id: "streak_30",        icon: "star",           title: "Monthly Master",     description: "Listen to vinyl 30 days in a row",               threshold: 30,  type: "streak" },
  { id: "genre_explorer",   icon: "compass",        title: "Genre Explorer",     description: "Listen to records from 10 different genres",     threshold: 10,  type: "genres" },
  { id: "social_butterfly", icon: "users",          title: "Social Butterfly",   description: "Follow 20 other collectors",                     threshold: 20,  type: "following" },
  { id: "first_post",       icon: "edit",           title: "First Post",         description: "Share your first post on the feed",              threshold: 1,   type: "posts" },
  { id: "decade_diver",     icon: "clock",          title: "Decade Diver",       description: "Own records from 5 different decades",            threshold: 5,   type: "decades" },
  { id: "marathon",         icon: "music",          title: "Marathon Listener",  description: "Listen for 4+ hours in a single session",        threshold: 240, type: "session_minutes" },
  { id: "night_owl",        icon: "moon",           title: "Night Owl",          description: "Listen to vinyl after midnight 10 times",        threshold: 10,  type: "late_listens" },
];

// Shipping rate tiers — used by marketplace checkout and seller settings
export const SHIPPING_RATES = {
  domestic: [
    { id: "us_media",    label: "USPS Media Mail",        price: 3.50,  estimatedDays: "5-8",   maxWeight: "70 lbs" },
    { id: "us_priority", label: "USPS Priority Mail",     price: 8.50,  estimatedDays: "2-3",   maxWeight: "70 lbs" },
    { id: "us_first",    label: "USPS First Class",       price: 5.00,  estimatedDays: "3-5",   maxWeight: "13 oz" },
  ],
  international: [
    { id: "intl_economy",  label: "International Economy",  price: 14.00, estimatedDays: "14-28", regions: ["Europe","Asia","Oceania","South America"] },
    { id: "intl_priority", label: "International Priority", price: 28.00, estimatedDays: "6-10",  regions: ["Europe","Asia","Oceania","South America"] },
    { id: "intl_canada",   label: "Canada Standard",        price: 10.00, estimatedDays: "7-14",  regions: ["Canada"] },
    { id: "intl_uk",       label: "UK / EU Standard",       price: 12.00, estimatedDays: "10-18", regions: ["Europe"] },
  ],
};

// Content moderation report reasons — used by ReportModal
export const REPORT_REASONS = [
  { id: "counterfeit",    label: "Counterfeit / Bootleg",         description: "This record appears to be a counterfeit or unauthorized pressing" },
  { id: "misgraded",      label: "Misgraded Condition",           description: "The listed condition does not match the actual state of the record" },
  { id: "spam",           label: "Spam / Scam",                   description: "This listing or post is spam, a scam, or misleading" },
  { id: "inappropriate",  label: "Inappropriate Content",         description: "This content contains offensive or inappropriate material" },
  { id: "wrong_info",     label: "Incorrect Information",         description: "The artist, album, pressing details, or year are wrong" },
  { id: "stolen",         label: "Stolen Property",               description: "This record may be stolen property" },
  { id: "harassment",     label: "Harassment",                    description: "This user is harassing or targeting another user" },
  { id: "duplicate",      label: "Duplicate Listing",             description: "This listing is a duplicate of another active listing" },
  { id: "other",          label: "Other",                         description: "Something else not covered above" },
];

// Genre accent colors — used for chart visualizations, genre pills, and analytics graphs
export const GENRE_COLORS = {
  "Rock":         "#ef4444",
  "Jazz":         "#3b82f6",
  "Electronic":   "#8b5cf6",
  "Hip-Hop":      "#f59e0b",
  "Metal":        "#1f2937",
  "Pop":          "#ec4899",
  "Punk":         "#f97316",
  "R&B":          "#a855f7",
  "Soul":         "#d946ef",
  "Folk":         "#84cc16",
  "Classical":    "#6366f1",
  "Funk":         "#14b8a6",
  "Alternative":  "#06b6d4",
  "Country":      "#ca8a04",
  "Reggae":       "#22c55e",
  "Blues":        "#2563eb",
  "World":        "#10b981",
  "Experimental": "#64748b",
};

// Notification sound identifiers — used by notification settings and playback
export const NOTIFICATION_SOUNDS = [
  { id: "needle_drop",   label: "Needle Drop",    file: "needle-drop.mp3" },
  { id: "vinyl_crackle",  label: "Vinyl Crackle",  file: "vinyl-crackle.mp3" },
  { id: "soft_chime",     label: "Soft Chime",     file: "soft-chime.mp3" },
  { id: "warm_tone",      label: "Warm Tone",      file: "warm-tone.mp3" },
  { id: "record_slide",   label: "Record Slide",   file: "record-slide.mp3" },
  { id: "none",           label: "Silent",         file: null },
];

// Currency display formats — internationalization prep for marketplace
export const CURRENCY_FORMATS = {
  USD: { symbol: "$",  code: "USD", locale: "en-US",  placement: "before", decimals: 2 },
  EUR: { symbol: "\u20AC", code: "EUR", locale: "de-DE",  placement: "after",  decimals: 2 },
  GBP: { symbol: "\u00A3",  code: "GBP", locale: "en-GB",  placement: "before", decimals: 2 },
  JPY: { symbol: "\u00A5",  code: "JPY", locale: "ja-JP",  placement: "before", decimals: 0 },
  CAD: { symbol: "CA$", code: "CAD", locale: "en-CA", placement: "before", decimals: 2 },
  AUD: { symbol: "A$",  code: "AUD", locale: "en-AU", placement: "before", decimals: 2 },
  SEK: { symbol: "kr",  code: "SEK", locale: "sv-SE", placement: "after",  decimals: 2 },
  DKK: { symbol: "kr",  code: "DKK", locale: "da-DK", placement: "after",  decimals: 2 },
};

// Static profiles for all non-current users — keyed by username handle.
// Each profile includes a display name, bio, location, favorite genre, accent color, followers list,
// follower/following counts, joined date, collection size,
// and avatar/header image URLs (DiceBear + Picsum for a polished look).
export const USER_PROFILES = {
  "mara.vinyl":     { displayName:"Mara Chen",       bio:"Jazz collector & audiophile. First pressings only. Based in Portland.",         location:"Portland, OR",   favGenre:"Jazz",        accent:"#ec4899", followers:["thomas.wax","juniper.sounds","felix.rpm","cleo.spins","creator","tova.vinyl","soren.stacks","ada.tracks"], following:["thomas.wax","felix.rpm","yuki.vinyl","soren.stacks","lena.records"], followerCount:312, followingCount:189, joinedDate:"2021-03-15", collectionSize:487, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=mara.vinyl", headerUrl:"https://picsum.photos/seed/mara.vinyl/1200/400" },
  "thomas.wax":     { displayName:"Thomas Wax",       bio:"Classic rock obsessive. I have too many Zeppelin pressings.",                   location:"Nashville, TN",  favGenre:"Rock",        accent:"#a78bfa", followers:["mara.vinyl","creator","nadia.rpm","bjorn.grooves","iris.rpm","hal.grooves","arlo.wax"], following:["mara.vinyl","bjorn.grooves","iris.rpm","cleo.spins"], followerCount:245, followingCount:134, joinedDate:"2020-11-22", collectionSize:623, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=thomas.wax", headerUrl:"https://picsum.photos/seed/thomas.wax/1200/400" },
  "juniper.sounds": { displayName:"Juniper Isley",    bio:"Electronic music archivist. Warp, Hyperdub, 4AD. Rare 12\"s welcome.",          location:"London, UK",     favGenre:"Electronic",  accent:"#f97316", followers:["mara.vinyl","felix.rpm","creator","beau.plays","kai.wax","romy.rpm"], following:["mara.vinyl","beau.plays","otto.wax","kai.wax"], followerCount:428, followingCount:201, joinedDate:"2021-01-08", collectionSize:892, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=juniper.sounds", headerUrl:"https://picsum.photos/seed/juniper.sounds/1200/400" },
  "felix.rpm":      { displayName:"Felix Romero",     bio:"Latin jazz, soul, and everything in between. Vinyl only.",                      location:"Miami, FL",      favGenre:"Jazz",        accent:"#06b6d4", followers:["mara.vinyl","creator","nico.crates","june.vinyl","tova.vinyl"], following:["mara.vinyl","lena.records","nico.crates","yuki.vinyl"], followerCount:198, followingCount:156, joinedDate:"2022-05-30", collectionSize:234, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=felix.rpm", headerUrl:"https://picsum.photos/seed/felix.rpm/1200/400" },
  "cleo.spins":     { displayName:"Cleo Park",        bio:"90s indie and shoegaze. My Sub Pop collection is getting out of hand.",         location:"Seattle, WA",    favGenre:"Alternative", accent:"#84cc16", followers:["thomas.wax","creator","beau.plays","kai.wax","wren.stacks","milo.vinyl"], following:["thomas.wax","otto.wax","milo.vinyl","kai.wax","wren.stacks"], followerCount:276, followingCount:211, joinedDate:"2021-07-14", collectionSize:341, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=cleo.spins", headerUrl:"https://picsum.photos/seed/cleo.spins/1200/400" },
  "otto.wax":       { displayName:"Otto Wax",          bio:"Post-punk and goth. The darker the better.",                                   location:"Berlin, DE",     favGenre:"Alternative", accent:"#ef4444", followers:["juniper.sounds","creator","cass.stacks","romy.rpm"], following:["cass.stacks","cleo.spins","juniper.sounds","romy.rpm"], followerCount:187, followingCount:98, joinedDate:"2022-02-19", collectionSize:412, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=otto.wax", headerUrl:"https://picsum.photos/seed/otto.wax/1200/400" },
  "nadia.rpm":      { displayName:"Nadia Reeves",     bio:"Hip-hop head. Boom bap era forever. DJ on the weekends.",                       location:"Brooklyn, NY",   favGenre:"Hip-Hop",     accent:"#8b5cf6", followers:["creator","cleo.spins","june.vinyl","dax.wax","max.plays"], following:["max.plays","dax.wax","june.vinyl","lena.records"], followerCount:534, followingCount:267, joinedDate:"2020-08-03", collectionSize:756, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=nadia.rpm", headerUrl:"https://picsum.photos/seed/nadia.rpm/1200/400" },
  "soren.stacks":   { displayName:"Soren Dahl",       bio:"Scandinavian jazz and ambient. Quiet records for loud rooms.",                  location:"Copenhagen, DK", favGenre:"Jazz",        accent:"#0ea5e9", followers:["creator","mara.vinyl","emi.spins","petra.spins"], following:["mara.vinyl","juniper.sounds","emi.spins"], followerCount:143, followingCount:87, joinedDate:"2022-09-11", collectionSize:198, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=soren.stacks", headerUrl:"https://picsum.photos/seed/soren.stacks/1200/400" },
  "yuki.vinyl":     { displayName:"Yuki Tanaka",      bio:"City pop, J-jazz, and Shibuya-kei. Also deeply into Coltrane.",                location:"Tokyo, JP",      favGenre:"Jazz",        accent:"#f59e0b", followers:["creator","juniper.sounds","nico.crates","felix.rpm","lena.records"], following:["mara.vinyl","juniper.sounds","felix.rpm","nico.crates"], followerCount:389, followingCount:145, joinedDate:"2021-04-20", collectionSize:567, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=yuki.vinyl", headerUrl:"https://picsum.photos/seed/yuki.vinyl/1200/400" },
  "bjorn.grooves":  { displayName:"Bjorn Larsen",    bio:"Metal and classic rock. If it ain't loud it ain't right.",                      location:"Stockholm, SE",  favGenre:"Metal",       accent:"#10b981", followers:["creator","otto.wax","riku.records","thomas.wax","cass.stacks"], following:["thomas.wax","riku.records","otto.wax","cass.stacks"], followerCount:221, followingCount:178, joinedDate:"2021-12-01", collectionSize:389, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=bjorn.grooves", headerUrl:"https://picsum.photos/seed/bjorn.grooves/1200/400" },
  "lena.records":   { displayName:"Lena Fischer",     bio:"Soul and R&B from the 60s-70s. Atlantic Records completist.",                   location:"Frankfurt, DE",  favGenre:"Soul",        accent:"#ec4899", followers:["creator","yuki.vinyl","june.vinyl","tova.vinyl","max.plays","zara.grooves"], following:["max.plays","zara.grooves","june.vinyl","nadia.rpm"], followerCount:267, followingCount:143, joinedDate:"2021-06-18", collectionSize:445, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=lena.records", headerUrl:"https://picsum.photos/seed/lena.records/1200/400" },
  "max.plays":      { displayName:"Max Ortega",       bio:"Record store owner by day, compulsive digger by night.",                        location:"Chicago, IL",    favGenre:"Funk",        accent:"#a78bfa", followers:["creator","nadia.rpm","dax.wax","sol.spins","lena.records"], following:["nadia.rpm","dax.wax","lena.records","felix.rpm","sol.spins"], followerCount:612, followingCount:334, joinedDate:"2019-10-05", collectionSize:2341, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=max.plays", headerUrl:"https://picsum.photos/seed/max.plays/1200/400" },
  "iris.rpm":       { displayName:"Iris Monroe",      bio:"Prog and art rock. Yes, I own every Yes album.",                                location:"Austin, TX",     favGenre:"Rock",        accent:"#f97316", followers:["creator","thomas.wax","riku.records"], following:["thomas.wax","riku.records","petra.spins"], followerCount:156, followingCount:112, joinedDate:"2022-01-27", collectionSize:278, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=iris.rpm", headerUrl:"https://picsum.photos/seed/iris.rpm/1200/400" },
  "dax.wax":        { displayName:"Dax Williams",     bio:"Crate digger. If it costs under $5 and sounds incredible, I want it.",         location:"Detroit, MI",    favGenre:"Funk",        accent:"#06b6d4", followers:["creator","max.plays","nadia.rpm","hal.grooves"], following:["max.plays","nadia.rpm","lena.records","hal.grooves"], followerCount:345, followingCount:256, joinedDate:"2020-05-12", collectionSize:1123, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=dax.wax", headerUrl:"https://picsum.photos/seed/dax.wax/1200/400" },
  "milo.vinyl":     { displayName:"Milo Jensen",      bio:"Folk and Americana. Nick Drake completist. Crying is allowed.",                 location:"Vermont",        favGenre:"Folk",        accent:"#84cc16", followers:["creator","cleo.spins","arlo.wax"], following:["cleo.spins","arlo.wax","thomas.wax"], followerCount:134, followingCount:98, joinedDate:"2022-08-09", collectionSize:167, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=milo.vinyl", headerUrl:"https://picsum.photos/seed/milo.vinyl/1200/400" },
  "petra.spins":    { displayName:"Petra Novak",      bio:"Classical and contemporary composition. Vinyl sounds better, always.",          location:"Vienna, AT",     favGenre:"Classical",   accent:"#ef4444", followers:["creator","yuki.vinyl","emi.spins","soren.stacks","iris.rpm"], following:["emi.spins","soren.stacks","yuki.vinyl"], followerCount:178, followingCount:67, joinedDate:"2021-11-03", collectionSize:312, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=petra.spins", headerUrl:"https://picsum.photos/seed/petra.spins/1200/400" },
  "riku.records":   { displayName:"Riku Makinen",    bio:"Finnish metal and progressive rock. Also weirdly into bossa nova.",             location:"Helsinki, FI",   favGenre:"Metal",       accent:"#8b5cf6", followers:["creator","bjorn.grooves","iris.rpm"], following:["bjorn.grooves","iris.rpm","nico.crates"], followerCount:189, followingCount:134, joinedDate:"2022-03-14", collectionSize:356, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=riku.records", headerUrl:"https://picsum.photos/seed/riku.records/1200/400" },
  "cass.stacks":    { displayName:"Cass O'Brien",     bio:"Punk and post-punk archivist. Have pressed several records myself.",            location:"Dublin, IE",     favGenre:"Punk",        accent:"#0ea5e9", followers:["creator","bjorn.grooves","otto.wax"], following:["bjorn.grooves","otto.wax","cleo.spins"], followerCount:213, followingCount:145, joinedDate:"2021-09-22", collectionSize:534, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=cass.stacks", headerUrl:"https://picsum.photos/seed/cass.stacks/1200/400" },
  "beau.plays":     { displayName:"Beau Laurent",     bio:"French house and disco. Every Saturday is a dance party.",                     location:"Paris, FR",      favGenre:"Electronic",  accent:"#f59e0b", followers:["creator","cleo.spins","juniper.sounds","romy.rpm"], following:["juniper.sounds","cleo.spins","romy.rpm","yuki.vinyl"], followerCount:298, followingCount:176, joinedDate:"2021-05-07", collectionSize:423, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=beau.plays", headerUrl:"https://picsum.photos/seed/beau.plays/1200/400" },
  "zara.grooves":   { displayName:"Zara Khan",        bio:"Reggae and dub. Lee Scratch Perry is my spirit animal.",                       location:"Manchester, UK", favGenre:"Reggae",      accent:"#10b981", followers:["creator","lena.records","sol.spins"], following:["lena.records","sol.spins","felix.rpm"], followerCount:176, followingCount:123, joinedDate:"2022-04-16", collectionSize:289, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=zara.grooves", headerUrl:"https://picsum.photos/seed/zara.grooves/1200/400" },
  "nico.crates":    { displayName:"Nico Alvarez",     bio:"Brazilian music obsessive. Bossa nova, tropicalia, MPB. Just moved to LA.",     location:"Los Angeles, CA",favGenre:"World",       accent:"#f97316", followers:["creator","felix.rpm","yuki.vinyl","sol.spins"], following:["felix.rpm","yuki.vinyl","sol.spins","riku.records"], followerCount:167, followingCount:134, joinedDate:"2023-01-20", collectionSize:213, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=nico.crates", headerUrl:"https://picsum.photos/seed/nico.crates/1200/400" },
  "ada.tracks":     { displayName:"Ada Osei",         bio:"Audiophile engineer. Acoustic treatment nerd. The room matters more than the gear.", location:"Atlanta, GA", favGenre:"R&B",         accent:"#ec4899", followers:["creator","thomas.wax","mara.vinyl","june.vinyl"], following:["thomas.wax","mara.vinyl","petra.spins","june.vinyl"], followerCount:234, followingCount:156, joinedDate:"2022-06-11", collectionSize:189, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=ada.tracks", headerUrl:"https://picsum.photos/seed/ada.tracks/1200/400" },
  "kai.wax":        { displayName:"Kai Brennan",      bio:"Radiohead completist. Every pressing, every format. Also into krautrock.",       location:"Portland, OR",   favGenre:"Alternative", accent:"#a78bfa", followers:["creator","cleo.spins","juniper.sounds","wren.stacks"], following:["cleo.spins","juniper.sounds","wren.stacks","thomas.wax"], followerCount:201, followingCount:167, joinedDate:"2022-10-05", collectionSize:278, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=kai.wax", headerUrl:"https://picsum.photos/seed/kai.wax/1200/400" },
  "sol.spins":      { displayName:"Sol Mensah",       bio:"Afrobeat and highlife. If it has polyrhythms, I need it on wax.",                location:"Accra, GH",      favGenre:"World",       accent:"#10b981", followers:["creator","zara.grooves","max.plays","nico.crates"], following:["zara.grooves","max.plays","nico.crates","lena.records"], followerCount:145, followingCount:112, joinedDate:"2023-03-08", collectionSize:178, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=sol.spins", headerUrl:"https://picsum.photos/seed/sol.spins/1200/400" },
  "tova.vinyl":     { displayName:"Tova Bergman",     bio:"Inherited my grandmother's collection. 50s-60s vocal jazz and standards.",       location:"Minneapolis, MN",favGenre:"Jazz",        accent:"#f59e0b", followers:["creator","mara.vinyl","lena.records","felix.rpm"], following:["mara.vinyl","lena.records","felix.rpm","soren.stacks"], followerCount:123, followingCount:89, joinedDate:"2023-06-14", collectionSize:234, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=tova.vinyl", headerUrl:"https://picsum.photos/seed/tova.vinyl/1200/400" },
  "wren.stacks":    { displayName:"Wren Kimura",      bio:"Modern psych and garage rock. Ty Segall hoarder. King Gizzard evangelist.",     location:"San Francisco, CA",favGenre:"Rock",      accent:"#84cc16", followers:["creator","cleo.spins","kai.wax"], following:["cleo.spins","kai.wax","dax.wax"], followerCount:189, followingCount:145, joinedDate:"2022-12-01", collectionSize:312, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=wren.stacks", headerUrl:"https://picsum.photos/seed/wren.stacks/1200/400" },
  "romy.rpm":       { displayName:"Romy Delacroix",   bio:"Synth-pop and new wave. Depeche Mode is a religion, not a band.",               location:"Lyon, FR",       favGenre:"Pop",         accent:"#8b5cf6", followers:["creator","beau.plays","otto.wax","cleo.spins"], following:["beau.plays","otto.wax","juniper.sounds"], followerCount:234, followingCount:156, joinedDate:"2022-07-28", collectionSize:267, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=romy.rpm", headerUrl:"https://picsum.photos/seed/romy.rpm/1200/400" },
  "hal.grooves":    { displayName:"Hal Nakamura",     bio:"Blues purist. Robert Johnson to Gary Clark Jr. The 12-bar is eternal.",          location:"Memphis, TN",    favGenre:"Blues",       accent:"#ef4444", followers:["creator","thomas.wax","dax.wax","arlo.wax"], following:["thomas.wax","dax.wax","arlo.wax","lena.records"], followerCount:156, followingCount:112, joinedDate:"2022-11-19", collectionSize:345, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=hal.grooves", headerUrl:"https://picsum.photos/seed/hal.grooves/1200/400" },
  "june.vinyl":     { displayName:"June Okafor",      bio:"Neo-soul and contemporary R&B. D'Angelo changed my life. Erykah Badu too.",    location:"Philadelphia, PA",favGenre:"R&B",        accent:"#06b6d4", followers:["creator","lena.records","nadia.rpm","ada.tracks"], following:["lena.records","nadia.rpm","ada.tracks","felix.rpm"], followerCount:267, followingCount:189, joinedDate:"2022-04-03", collectionSize:198, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=june.vinyl", headerUrl:"https://picsum.photos/seed/june.vinyl/1200/400" },
  "arlo.wax":       { displayName:"Arlo McBride",     bio:"Outlaw country and Americana. Townes Van Zandt is the greatest songwriter.",    location:"Austin, TX",     favGenre:"Country",     accent:"#f97316", followers:["creator","milo.vinyl","thomas.wax","hal.grooves"], following:["milo.vinyl","thomas.wax","hal.grooves"], followerCount:134, followingCount:98, joinedDate:"2023-02-10", collectionSize:156, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=arlo.wax", headerUrl:"https://picsum.photos/seed/arlo.wax/1200/400" },
  "emi.spins":      { displayName:"Emi Watanabe",     bio:"Minimalist composition and ambient. Steve Reich on repeat. Silence is music.",   location:"Kyoto, JP",      favGenre:"Classical",   accent:"#0ea5e9", followers:["creator","petra.spins","soren.stacks"], following:["petra.spins","soren.stacks","yuki.vinyl"], followerCount:112, followingCount:67, joinedDate:"2023-04-22", collectionSize:145, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=emi.spins", headerUrl:"https://picsum.photos/seed/emi.spins/1200/400" },
  // ── Additional profiles ────────────────────────────────────────────────────
  "vince.rpm":      { displayName:"Vince Morales",    bio:"Chicano soul and lowrider oldies. East LA born and raised. War and Thee Midniters forever.", location:"Los Angeles, CA", favGenre:"Soul", accent:"#ec4899", followers:["creator","felix.rpm","nico.crates","dax.wax"], following:["felix.rpm","nico.crates","dax.wax","lena.records"], followerCount:198, followingCount:134, joinedDate:"2022-08-15", collectionSize:289, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=vince.rpm", headerUrl:"https://picsum.photos/seed/vince.rpm/1200/400" },
  "freya.wax":      { displayName:"Freya Lindqvist",  bio:"Nordic jazz and ECM collector. Jan Garbarek, Bobo Stenson, Terje Rypdal.",       location:"Oslo, NO",       favGenre:"Jazz",        accent:"#3b82f6", followers:["creator","soren.stacks","mara.vinyl"], following:["soren.stacks","mara.vinyl","emi.spins"], followerCount:98, followingCount:76, joinedDate:"2023-05-19", collectionSize:167, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=freya.wax", headerUrl:"https://picsum.photos/seed/freya.wax/1200/400" },
  "dante.grooves":  { displayName:"Dante Russo",      bio:"Italian prog and library music. Goblin soundtracks are my comfort food.",        location:"Rome, IT",       favGenre:"Rock",        accent:"#a78bfa", followers:["creator","riku.records","iris.rpm","petra.spins"], following:["riku.records","iris.rpm","petra.spins","bjorn.grooves"], followerCount:145, followingCount:112, joinedDate:"2023-01-03", collectionSize:234, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=dante.grooves", headerUrl:"https://picsum.photos/seed/dante.grooves/1200/400" },
  "priya.stacks":   { displayName:"Priya Sharma",     bio:"Bollywood soundtracks and Indian classical on vinyl. RD Burman is king.",        location:"Mumbai, IN",     favGenre:"World",       accent:"#d946ef", followers:["creator","sol.spins","yuki.vinyl"], following:["sol.spins","yuki.vinyl","nico.crates"], followerCount:112, followingCount:89, joinedDate:"2023-07-22", collectionSize:145, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=priya.stacks", headerUrl:"https://picsum.photos/seed/priya.stacks/1200/400" },
  "lou.vinyl":      { displayName:"Lou Castellano",   bio:"Garage punk and power pop. The Sonics started everything. Budget bins only.",    location:"Philadelphia, PA",favGenre:"Punk",       accent:"#f97316", followers:["creator","cass.stacks","wren.stacks","dax.wax"], following:["cass.stacks","wren.stacks","dax.wax","cleo.spins"], followerCount:167, followingCount:134, joinedDate:"2022-09-30", collectionSize:456, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=lou.vinyl", headerUrl:"https://picsum.photos/seed/lou.vinyl/1200/400" },
  "maya.tracks":    { displayName:"Maya Jefferson",   bio:"Gospel and spiritual jazz. Alice Coltrane opened a door I never closed.",         location:"New Orleans, LA",favGenre:"Jazz",       accent:"#14b8a6", followers:["creator","mara.vinyl","lena.records","june.vinyl"], following:["mara.vinyl","lena.records","june.vinyl","tova.vinyl"], followerCount:134, followingCount:98, joinedDate:"2023-02-28", collectionSize:178, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=maya.tracks", headerUrl:"https://picsum.photos/seed/maya.tracks/1200/400" },
  "finn.crates":    { displayName:"Finn O'Sullivan",  bio:"Trad Irish and Celtic folk on vinyl. The Chieftains, Planxty, and De Dannan.",   location:"Galway, IE",     favGenre:"Folk",        accent:"#22c55e", followers:["creator","cass.stacks","milo.vinyl"], following:["cass.stacks","milo.vinyl","arlo.wax"], followerCount:89, followingCount:67, joinedDate:"2023-08-14", collectionSize:123, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=finn.crates", headerUrl:"https://picsum.photos/seed/finn.crates/1200/400" },
  "liam.stacks":    { displayName:"Liam Chen-Wu",     bio:"Synthwave and retrowave. Anything that sounds like a neon-lit 1985.",            location:"Toronto, CA",    favGenre:"Electronic",  accent:"#8b5cf6", followers:["creator","beau.plays","juniper.sounds","romy.rpm"], following:["beau.plays","juniper.sounds","romy.rpm","kai.wax"], followerCount:213, followingCount:167, joinedDate:"2022-11-05", collectionSize:198, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=liam.stacks", headerUrl:"https://picsum.photos/seed/liam.stacks/1200/400" },
  "nina.grooves":   { displayName:"Nina Petrovic",    bio:"Balkan brass and Eastern European folk. Also Yugo-rock. Bijelo Dugme is life.",  location:"Belgrade, RS",   favGenre:"World",       accent:"#ca8a04", followers:["creator","dante.grooves","priya.stacks"], following:["dante.grooves","priya.stacks","sol.spins"], followerCount:78, followingCount:56, joinedDate:"2023-09-01", collectionSize:98, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=nina.grooves", headerUrl:"https://picsum.photos/seed/nina.grooves/1200/400" },
  "theo.plays":     { displayName:"Theo Washington",  bio:"Go-go and DC funk. Rare Groove is my religion. Chuck Brown forever.",            location:"Washington, DC", favGenre:"Funk",        accent:"#06b6d4", followers:["creator","max.plays","nadia.rpm","dax.wax"], following:["max.plays","nadia.rpm","dax.wax","june.vinyl"], followerCount:189, followingCount:145, joinedDate:"2022-07-11", collectionSize:312, avatarUrl:"https://api.dicebear.com/9.x/notionists-neutral/svg?seed=theo.plays", headerUrl:"https://picsum.photos/seed/theo.plays/1200/400" },
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
  "nico.crates":    [{ id: "w32", album: "Getz/Gilberto", artist: "Stan Getz & Joao Gilberto" }, { id: "w33", album: "Tropicalia", artist: "Various Artists" }, { id: "w34", album: "Africa Brasil", artist: "Jorge Ben Jor" }],
  "ada.tracks":     [{ id: "w35", album: "Voodoo", artist: "D'Angelo" }, { id: "w36", album: "Channel Orange", artist: "Frank Ocean" }],
  "kai.wax":        [{ id: "w37", album: "Kid A", artist: "Radiohead" }, { id: "w38", album: "In Rainbows", artist: "Radiohead" }, { id: "w39", album: "Future Days", artist: "Can" }],
  "sol.spins":      [{ id: "w40", album: "Zombie", artist: "Fela Kuti" }, { id: "w41", album: "Expensive Shit", artist: "Fela Kuti" }],
  "tova.vinyl":     [{ id: "w42", album: "Ella and Louis", artist: "Ella Fitzgerald & Louis Armstrong" }, { id: "w43", album: "In the Wee Small Hours", artist: "Frank Sinatra" }],
  "wren.stacks":    [{ id: "w44", album: "Nonagon Infinity", artist: "King Gizzard & The Lizard Wizard" }, { id: "w45", album: "Manipulator", artist: "Ty Segall" }],
  "romy.rpm":       [{ id: "w46", album: "Violator", artist: "Depeche Mode" }, { id: "w47", album: "Disintegration", artist: "The Cure" }],
  "hal.grooves":    [{ id: "w48", album: "King of the Delta Blues Singers", artist: "Robert Johnson" }, { id: "w49", album: "Born Under a Bad Sign", artist: "Albert King" }],
  "june.vinyl":     [{ id: "w50", album: "Voodoo", artist: "D'Angelo" }, { id: "w51", album: "Baduizm", artist: "Erykah Badu" }],
  "arlo.wax":       [{ id: "w52", album: "Townes Van Zandt", artist: "Townes Van Zandt" }, { id: "w53", album: "Red Headed Stranger", artist: "Willie Nelson" }],
  "emi.spins":      [{ id: "w54", album: "Music for 18 Musicians", artist: "Steve Reich" }, { id: "w55", album: "The Disintegration Loops", artist: "William Basinski" }],
  "vince.rpm":      [{ id: "w56", album: "War", artist: "War" }, { id: "w57", album: "Low Rider", artist: "War" }],
  "freya.wax":      [{ id: "w58", album: "Officium", artist: "Jan Garbarek & The Hilliard Ensemble" }],
  "dante.grooves":  [{ id: "w59", album: "Suspiria", artist: "Goblin" }, { id: "w60", album: "Profondo Rosso", artist: "Goblin" }],
  "priya.stacks":   [{ id: "w61", album: "Sholay", artist: "RD Burman" }, { id: "w62", album: "Hare Rama Hare Krishna", artist: "RD Burman" }],
  "lou.vinyl":      [{ id: "w63", album: "Here Are the Sonics!!!", artist: "The Sonics" }],
  "maya.tracks":    [{ id: "w64", album: "Journey in Satchidananda", artist: "Alice Coltrane" }, { id: "w65", album: "Ptah, the El Daoud", artist: "Alice Coltrane" }],
  "finn.crates":    [{ id: "w66", album: "The Chieftains 4", artist: "The Chieftains" }],
  "liam.stacks":    [{ id: "w67", album: "Drive OST", artist: "Cliff Martinez" }, { id: "w68", album: "Turbo Kid OST", artist: "Le Matos" }],
  "nina.grooves":   [{ id: "w69", album: "Kad Bi Svi Ljudi Na Svijetu", artist: "Bijelo Dugme" }],
  "theo.plays":     [{ id: "w70", album: "Any Other Way to Go?", artist: "Chuck Brown" }, { id: "w71", album: "We Need Some Money", artist: "Chuck Brown" }],
};

// Marketplace browse categories — used by MarketplaceScreen category pills and featured sections
export const MARKETPLACE_CATEGORIES = [
  { id: "new_arrivals",   label: "New Arrivals",     icon: "clock",        description: "Listed in the last 7 days",                    filter: { sortBy: "postedAt", sortOrder: "desc", maxAge: 7 } },
  { id: "staff_picks",    label: "Staff Picks",      icon: "award",        description: "Hand-picked by the GrooveStack team",          filter: { curated: true } },
  { id: "under_20",       label: "Under $20",        icon: "dollar-sign",  description: "Great vinyl without breaking the bank",        filter: { maxPrice: 20 } },
  { id: "under_50",       label: "Under $50",        icon: "tag",          description: "Quality records at fair prices",               filter: { maxPrice: 50 } },
  { id: "rare_finds",     label: "Rare Finds",       icon: "search",       description: "Original pressings and limited editions",      filter: { conditions: ["M", "NM"], minPrice: 100 } },
  { id: "near_mint",      label: "Near Mint",        icon: "star",         description: "Collector-grade records in top condition",      filter: { conditions: ["M", "NM"] } },
  { id: "just_reduced",   label: "Just Reduced",     icon: "trending-down",description: "Recent price drops",                           filter: { priceDropped: true } },
  { id: "first_pressings",label: "First Pressings",  icon: "disc",         description: "Original pressings only",                      filter: { tags: ["Original Pressing"] } },
  { id: "box_sets",       label: "Box Sets",         icon: "package",      description: "Multi-disc collections and anthologies",       filter: { formats: ["Box Set"] } },
  { id: "local_sellers",  label: "Local Sellers",    icon: "map-pin",      description: "Records from sellers near you",                filter: { local: true, radius: 50 } },
  { id: "verified_sellers",label: "Verified Sellers", icon: "check-circle", description: "Trusted sellers with proven track records",    filter: { verified: true } },
  { id: "ending_soon",    label: "Ending Soon",      icon: "alert-circle", description: "Offers and auctions closing within 24 hours",  filter: { endingSoon: true } },
];

// Vinyl record weight classes — used by AddRecordModal and listing detail views
export const VINYL_WEIGHTS = [
  { id: "standard",     label: "Standard",         grams: 120, description: "Standard weight vinyl, most common for mass-market pressings" },
  { id: "standard_140", label: "Standard 140g",     grams: 140, description: "Slightly heavier standard pressing, common since the 2000s" },
  { id: "heavyweight",  label: "Heavyweight 180g",  grams: 180, description: "Audiophile-grade heavyweight vinyl with reduced vibration and improved bass response" },
  { id: "super_heavy",  label: "Super Heavy 200g",  grams: 200, description: "Ultra-premium pressing for maximum fidelity and durability. Typically reserved for high-end reissues" },
  { id: "ultra_heavy",  label: "Ultra Heavy 220g",  grams: 220, description: "Extremely rare pressing weight, found on select audiophile labels like Analogue Productions" },
];

// Pressing type classifications — used by AddRecordModal, listing filters, and collection stats
export const PRESSING_TYPES = [
  { id: "original",        label: "Original Pressing",  description: "First commercial pressing from the original master tapes",              collectibility: "high" },
  { id: "reissue",         label: "Reissue",            description: "Later pressing of a previously released album, same or different label", collectibility: "medium" },
  { id: "remaster",        label: "Remaster",           description: "New pressing from remastered audio, often with improved dynamics",       collectibility: "medium" },
  { id: "limited_edition", label: "Limited Edition",     description: "Numbered or restricted pressing run, often with bonus material",        collectibility: "high" },
  { id: "colored_vinyl",   label: "Colored Vinyl",       description: "Pressed on non-black vinyl (splatter, marble, translucent, etc.)",      collectibility: "medium" },
  { id: "picture_disc",    label: "Picture Disc",        description: "Vinyl with artwork embedded in the playing surface",                    collectibility: "medium" },
  { id: "promo",           label: "Promo / White Label", description: "Promotional copy distributed to DJs and media, not for retail sale",    collectibility: "high" },
  { id: "test_pressing",   label: "Test Pressing",       description: "Pre-production pressing for label approval, extremely limited",         collectibility: "very_high" },
  { id: "bootleg",         label: "Bootleg",             description: "Unauthorized pressing, often of live recordings or unreleased material", collectibility: "low" },
  { id: "mono",            label: "Mono Pressing",       description: "Monaural mix pressing, often preferred by collectors for 1950s-60s titles", collectibility: "high" },
];

// Order lifecycle messages — used by order confirmation, shipping, and delivery notification screens
export const ORDER_MESSAGES = {
  confirmation: {
    title: "Order Confirmed",
    heading: "Thanks for your purchase!",
    body: "Your order has been confirmed and the seller has been notified. You'll receive a shipping update once your record is on its way.",
    cta: "View Order Details",
  },
  payment_received: {
    title: "Payment Received",
    heading: "Payment successful",
    body: "Your payment has been processed securely. The seller will ship your record within the timeframe listed on the order.",
    cta: "Track Order",
  },
  shipped: {
    title: "Order Shipped",
    heading: "Your record is on its way!",
    body: "The seller has shipped your order. You can track the package using the tracking number below. Handle with care when it arrives!",
    cta: "Track Package",
  },
  out_for_delivery: {
    title: "Out for Delivery",
    heading: "Almost there!",
    body: "Your record is out for delivery and should arrive today. Make sure someone is available to receive the package if a signature is required.",
    cta: "View Delivery Details",
  },
  delivered: {
    title: "Delivered",
    heading: "Your record has arrived!",
    body: "Your order has been delivered. Please inspect the record and confirm it matches the listed condition. You have 48 hours to open a dispute if there are any issues.",
    cta: "Confirm Receipt",
  },
  review_prompt: {
    title: "Leave a Review",
    heading: "How was your experience?",
    body: "Help the community by rating this transaction. Your feedback helps other collectors make informed decisions.",
    cta: "Write Review",
  },
  cancelled: {
    title: "Order Cancelled",
    heading: "Order has been cancelled",
    body: "This order has been cancelled. If a payment was made, your refund will be processed within 5-7 business days.",
    cta: "Return to Marketplace",
  },
  refunded: {
    title: "Refund Issued",
    heading: "Your refund is on the way",
    body: "A refund has been issued for this order. Depending on your payment method, it may take 5-7 business days to appear in your account.",
    cta: "View Refund Details",
  },
  dispute_opened: {
    title: "Dispute Opened",
    heading: "We are looking into it",
    body: "Your dispute has been submitted and our team is reviewing it. We aim to resolve all disputes within 72 hours. Both parties will be notified of the outcome.",
    cta: "View Dispute Status",
  },
};

// Onboarding walkthrough steps — used by OnboardingModal and new user welcome flow
export const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Welcome to GrooveStack",
    description: "The vinyl collector community where you can catalog your records, discover new music, and buy or sell with fellow enthusiasts.",
    icon: "disc",
    action: null,
  },
  {
    id: "add_first_record",
    title: "Add Your First Record",
    description: "Start building your collection by adding a record. Enter the album, artist, year, condition, and a quick review to share with the community.",
    icon: "plus-circle",
    action: "openAddRecord",
  },
  {
    id: "explore_genres",
    title: "Explore by Genre",
    description: "Browse records across 18 genres and dozens of subgenres. Use filter pills to find exactly what you are looking for, from Delta Blues to Drum & Bass.",
    icon: "compass",
    action: "openExplore",
  },
  {
    id: "follow_collectors",
    title: "Follow Other Collectors",
    description: "Find collectors with similar taste and follow them to see their latest additions, reviews, and marketplace listings in your feed.",
    icon: "users",
    action: "openDiscover",
  },
  {
    id: "marketplace_intro",
    title: "Buy & Sell Vinyl",
    description: "List records for sale, browse the marketplace, and make offers. Every transaction is protected and sellers are verified by the community.",
    icon: "shopping-bag",
    action: "openMarketplace",
  },
  {
    id: "grading_guide",
    title: "Learn the Grading Scale",
    description: "Vinyl condition is everything. Familiarize yourself with the Goldmine grading scale from Mint to Poor so you know exactly what you are buying and selling.",
    icon: "book-open",
    action: "openGradingGuide",
  },
  {
    id: "notifications_setup",
    title: "Stay in the Loop",
    description: "Enable notifications to get alerts when someone likes your records, when a wishlist item becomes available, or when a seller drops their price.",
    icon: "bell",
    action: "openNotificationSettings",
  },
  {
    id: "ready",
    title: "You're All Set!",
    description: "Your collection awaits. Start digging through crates, connecting with fellow vinyl lovers, and building the collection of your dreams.",
    icon: "check-circle",
    action: null,
  },
];
