const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();

// Set theme
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'GrooveStack';
pptx.company = 'GrooveStack';
pptx.subject = 'Product Overview — Waves 1–15';

// Theme colors
const BG = '0f1117';
const WHITE = 'FFFFFF';
const GRAY = 'a1a1aa';
const ACCENT = '0ea5e9';
const DARK_CARD = '18181b';
const LIGHT_GRAY = 'd4d4d8';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addContentSlide(title, bullets) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };

  // Accent bar at top
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
  });

  // Title
  slide.addText(title, {
    x: 0.8, y: 0.4, w: 11.5, h: 0.8,
    fontSize: 32, fontFace: 'Arial',
    color: WHITE, bold: true
  });

  // Divider line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
  });

  // Bullet points
  if (bullets && bullets.length > 0) {
    const fontSize = bullets.length > 6 ? 16 : 18;
    const textRows = bullets.map(b => ({
      text: b,
      options: {
        fontSize, fontFace: 'Arial', color: GRAY,
        bullet: { type: 'bullet', color: ACCENT },
        paraSpaceAfter: 6,
        lineSpacingMultiple: 1.25
      }
    }));

    slide.addText(textRows, {
      x: 0.8, y: 1.6, w: 11.5, h: 5.5,
      valign: 'top'
    });
  }

  return slide;
}

function addTwoColumnSlide(title, leftTitle, leftBullets, rightTitle, rightBullets) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
  });

  slide.addText(title, {
    x: 0.8, y: 0.4, w: 11.5, h: 0.8,
    fontSize: 32, fontFace: 'Arial',
    color: WHITE, bold: true
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
  });

  // Left column card
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.6, w: 5.6, h: 5.3,
    fill: { color: DARK_CARD }, rectRadius: 0.1
  });

  slide.addText(leftTitle, {
    x: 1.1, y: 1.75, w: 5, h: 0.5,
    fontSize: 18, fontFace: 'Arial',
    color: ACCENT, bold: true
  });

  const leftRows = leftBullets.map(b => ({
    text: b,
    options: {
      fontSize: 15, fontFace: 'Arial', color: GRAY,
      bullet: { type: 'bullet', color: ACCENT },
      paraSpaceAfter: 5, lineSpacingMultiple: 1.2
    }
  }));
  slide.addText(leftRows, {
    x: 1.1, y: 2.35, w: 5, h: 4.4, valign: 'top'
  });

  // Right column card
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.9, y: 1.6, w: 5.6, h: 5.3,
    fill: { color: DARK_CARD }, rectRadius: 0.1
  });

  slide.addText(rightTitle, {
    x: 7.2, y: 1.75, w: 5, h: 0.5,
    fontSize: 18, fontFace: 'Arial',
    color: ACCENT, bold: true
  });

  const rightRows = rightBullets.map(b => ({
    text: b,
    options: {
      fontSize: 15, fontFace: 'Arial', color: GRAY,
      bullet: { type: 'bullet', color: ACCENT },
      paraSpaceAfter: 5, lineSpacingMultiple: 1.2
    }
  }));
  slide.addText(rightRows, {
    x: 7.2, y: 2.35, w: 5, h: 4.4, valign: 'top'
  });

  return slide;
}

function addCardGridSlide(title, cards) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
  });

  slide.addText(title, {
    x: 0.8, y: 0.4, w: 11.5, h: 0.8,
    fontSize: 32, fontFace: 'Arial',
    color: WHITE, bold: true
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
  });

  const cols = cards.length <= 4 ? 2 : 3;
  cards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cardW = cols === 2 ? 5.4 : 3.6;
    const gap = cols === 2 ? 6 : 4;
    const x = 0.8 + col * gap;
    const y = 1.7 + row * 2.5;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: cardW, h: 2,
      fill: { color: DARK_CARD }, rectRadius: 0.1
    });

    slide.addText(card.number, {
      x, y: y + 0.2, w: cardW, h: 1,
      fontSize: 36, fontFace: 'Arial',
      color: ACCENT, bold: true, align: 'center'
    });

    slide.addText(card.label, {
      x, y: y + 1.2, w: cardW, h: 0.6,
      fontSize: 16, fontFace: 'Arial',
      color: GRAY, align: 'center'
    });
  });

  return slide;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SLIDES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Title Slide ──────────────────────────────────────────────────────────
const titleSlide = pptx.addSlide();
titleSlide.background = { color: BG };

titleSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

titleSlide.addText('GrooveStack', {
  x: 0.8, y: 1.4, w: 11.5, h: 1.4,
  fontSize: 64, fontFace: 'Arial',
  color: WHITE, bold: true, align: 'center'
});

titleSlide.addText('+ Vinyl Buddy', {
  x: 0.8, y: 2.6, w: 11.5, h: 0.8,
  fontSize: 36, fontFace: 'Arial',
  color: ACCENT, align: 'center'
});

titleSlide.addText('The Social Marketplace for Vinyl Collectors', {
  x: 0.8, y: 3.6, w: 11.5, h: 0.7,
  fontSize: 22, fontFace: 'Arial',
  color: LIGHT_GRAY, align: 'center'
});

titleSlide.addText('Powered by AI  \u2022  Built for Collectors  \u2022  Connected by Music', {
  x: 0.8, y: 4.5, w: 11.5, h: 0.6,
  fontSize: 16, fontFace: 'Arial',
  color: GRAY, align: 'center'
});

titleSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: ACCENT }
});


// ─── 2. What Is GrooveStack ─────────────────────────────────────────────────
addContentSlide('What Is GrooveStack?', [
  'An all-in-one platform for vinyl record collectors',
  'Social marketplace: buy, sell, trade, and auction records',
  'Collection management with value tracking and analytics',
  'Social network: posts, stories, DMs, follows, and activity feed',
  'Hardware companion device (Vinyl Buddy) for turntable identification',
  'AI-powered verification with Claude and Discogs integration',
  'PWA with full mobile and desktop experience'
]);


// ─── 3. Key Features Summary ────────────────────────────────────────────────
addCardGridSlide('Key Features Summary', [
  { number: 'Marketplace', label: 'Buy, Sell, Trade, Auction' },
  { number: 'Social', label: 'Feed, Posts, Stories, DMs' },
  { number: 'Collections', label: 'Organize, Track, Value' },
  { number: 'Analytics', label: 'Charts, Stats, Insights' },
  { number: 'Vinyl Buddy', label: 'Hardware Identification' },
  { number: '200+ APIs', label: 'Full REST Backend' }
]);


// ─── 4. Marketplace — Buying & Selling ──────────────────────────────────────
addTwoColumnSlide('Marketplace \u2014 Buying & Selling',
  'Buying',
  [
    'Browse and search with advanced filters',
    'Condition grading (Goldmine scale)',
    'Secure Stripe Checkout payments',
    'Discogs-powered price suggestions',
    'One-click purchase flow',
    'Order tracking and history'
  ],
  'Selling',
  [
    'List records with photos and descriptions',
    'Set your own price or use AI suggestions',
    'Manage inventory and listings',
    'Seller dashboard with sales analytics',
    'Bulk import from CSV or Discogs',
    'Coupon and promo code support'
  ]
);


// ─── 5. Marketplace — Offers & Auctions ─────────────────────────────────────
addTwoColumnSlide('Marketplace \u2014 Offers & Auctions',
  'Offers & Trading',
  [
    'Cash, trade, or combo offers',
    'Fair trade indicator for balanced exchanges',
    'Counter-offer workflow',
    'Accept / decline with real-time notifications',
    'Address exchange for physical trades',
    'Offer history and status tracking'
  ],
  'Auctions',
  [
    'Timed auction listings with start/end dates',
    'Minimum bid and reserve price support',
    'Real-time bid tracking',
    'Auto-close with winner notification',
    'Bid history visible to all participants',
    'Sniping protection with time extension'
  ]
);


// ─── 6. Transaction System ──────────────────────────────────────────────────
addContentSlide('Transaction System', [
  '5% platform transaction fee (minimum $1) on all sales',
  '$6 flat shipping fee per order with carrier tracking',
  'Escrow system for high-value transactions',
  'Optional shipping insurance for added protection',
  'Stripe-powered secure payment processing',
  'Dispute resolution workflow with admin review',
  'Refund processing and return management',
  'Full transaction history with receipts'
]);


// ─── 7. Social Features — Feed, Posts & Stories ─────────────────────────────
addTwoColumnSlide('Social Features \u2014 Feed, Posts & Stories',
  'Activity Feed',
  [
    'Chronological and trending content',
    'Rich post types: text, photo, record shares',
    'Like, comment, save, and bookmark',
    'Share records from your collection to the feed',
    'Trending posts algorithm',
    'Filtered views: following, popular, recent'
  ],
  'Stories',
  [
    'Ephemeral 24-hour stories',
    'Photo and text story formats',
    'Story ring indicator on profile avatars',
    'View count and viewer list',
    'Tap-through story navigation',
    'Story highlights on profile'
  ]
);


// ─── 8. Messaging System ────────────────────────────────────────────────────
addContentSlide('Messaging System', [
  'Real-time direct messaging between collectors',
  'Read receipts with delivered/read status indicators',
  'Message threads organized by conversation',
  'Typing indicators and online presence',
  'Share records and listings in messages',
  'Message search and conversation history',
  'Block and report for safety'
]);


// ─── 9. Collection Management ───────────────────────────────────────────────
addContentSlide('Collection Management', [
  'Add records manually or import from Discogs / CSV',
  'Organize with custom folders, tags, and categories',
  'Condition grading using the Goldmine standard',
  'Track purchase price, date acquired, and current value',
  'Collection value estimation powered by Discogs pricing',
  'Duplicate detection and merge tools',
  'Collection sharing with public/private visibility',
  'Export collection data as CSV'
]);


// ─── 10. Analytics Dashboard ────────────────────────────────────────────────
addContentSlide('Analytics Dashboard', [
  'Full dashboard with custom SVG charts (zero external deps)',
  'Collection value tracking over time with trend lines',
  'Genre distribution pie chart and condition breakdown',
  'Monthly spending analytics with bar charts',
  'Seller/buyer analytics with top partners and trends',
  'Listening pattern analysis from Vinyl Buddy data',
  'Most played artists, albums, and genre heatmaps',
  'Mood detection and taste evolution over time'
]);


// ─── 11. Explore & Discovery ────────────────────────────────────────────────
addContentSlide('Explore & Discovery', [
  'Browse records by genre, artist, era, condition, and price',
  'Full-text search across records, users, and posts',
  'Trending records and popular sellers highlighted',
  'Genre and subgenre taxonomy (18 genres, 85+ subgenres)',
  'New arrivals and recently listed sections',
  'Personalized recommendations based on collection and listening',
  'Artist profile pages with discography and related records'
]);


// ─── 12. User Profiles & Reputation ─────────────────────────────────────────
addTwoColumnSlide('User Profiles & Reputation',
  'Profiles',
  [
    'Customizable bio, avatar, and display name',
    'Public collection and wishlist showcase',
    'Post and sale history on profile',
    'Badge display (verified, achievements)',
    'Profile stats: records, posts, sales',
    'Privacy controls for collection visibility'
  ],
  'Reputation',
  [
    'Reputation score from sales and reviews',
    'Star ratings from buyers and sellers',
    'Dispute history factored into trust',
    'Seller tier badges (Bronze, Silver, Gold)',
    'Verified vinyl checkmark badge',
    'Community standing indicators'
  ]
);


// ─── 13. Following & Social Graph ───────────────────────────────────────────
addContentSlide('Following & Social Graph', [
  'Follow collectors to see their posts and listings in your feed',
  'Followers / following counts displayed on profiles',
  'Mutual follow detection for closer connections',
  'Follow suggestions based on shared tastes',
  'Activity notifications when followed users post or list',
  'Discover collectors with similar collections'
]);


// ─── 14. Wishlist & Price Alerts ────────────────────────────────────────────
addContentSlide('Wishlist & Price Alerts', [
  'Save any record to your personal wishlist',
  'Wishlist visible on your public profile (optional)',
  'Price alert notifications when wishlist items are listed',
  'Alert when wishlist items drop below target price',
  'One-click "add to wishlist" from any listing or search result',
  'Share wishlist links with friends or publicly'
]);


// ─── 15. Settings & Customization ───────────────────────────────────────────
addContentSlide('Settings & Customization', [
  'Account settings: email, username, password, 2FA',
  'Notification preferences: email, push, in-app',
  'Privacy controls: collection visibility, profile access',
  'Dark / light theme toggle with system preference detection',
  'Shipping address management with multiple saved addresses',
  'Linked accounts: Discogs, Stripe',
  'Data export (GDPR) and account deletion'
]);


// ─── 16. What Is Vinyl Buddy ────────────────────────────────────────────────
addContentSlide('What Is Vinyl Buddy?', [
  'A hardware companion device for your turntable',
  'Automatically identifies records as they play',
  'Audio fingerprinting powered by AudD recognition API',
  'Logs every listening session to your GrooveStack profile',
  'Tracks genre stats, listening streaks, and mood patterns',
  'Connects to GrooveStack via WiFi for real-time sync',
  'Shazam-style pulsing animation during identification'
]);


// ─── 17. Vinyl Buddy Features ───────────────────────────────────────────────
addTwoColumnSlide('Vinyl Buddy Features',
  'Identification & Tracking',
  [
    'Real-time audio fingerprinting',
    'Listening history with timestamps',
    'Genre classification per session',
    'Mood detection from listening patterns',
    'Listening streaks and goals',
    'Achievement badges (First Spin, Century Club, etc.)'
  ],
  'Stats & Insights',
  [
    'Most played artists and albums',
    'Genre evolution chart over time',
    'Peak listening hours heatmap',
    'Personalized recommendations',
    'Weekly and monthly listening reports',
    'Taste comparison with friends'
  ]
);


// ─── 18. Vinyl Buddy Device Management ──────────────────────────────────────
addContentSlide('Vinyl Buddy \u2014 Device Management', [
  'Device pairing and unpairing via GrooveStack app',
  'Real-time device health monitoring and diagnostics',
  'Firmware version checking and update notifications',
  'Audio calibration wizard for optimal identification',
  'Battery level monitoring and low-power alerts',
  'Multi-device support: pair multiple Vinyl Buddies',
  'Device naming and location tagging'
]);


// ─── 19. ESP32 Hardware Specs ───────────────────────────────────────────────
const hwSlide = pptx.addSlide();
hwSlide.background = { color: BG };

hwSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

hwSlide.addText('ESP32 Hardware Specs', {
  x: 0.8, y: 0.4, w: 11.5, h: 0.8,
  fontSize: 32, fontFace: 'Arial',
  color: WHITE, bold: true
});

hwSlide.addShape(pptx.ShapeType.rect, {
  x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
});

const hwSpecs = [
  { label: 'Microcontroller', value: 'ESP32-DevKitC V4' },
  { label: 'Connectivity', value: 'WiFi 802.11 b/g/n + BLE 4.2' },
  { label: 'Audio Input', value: 'I2S MEMS Microphone (INMP441)' },
  { label: 'Processor', value: 'Dual-core Xtensa LX6 @ 240 MHz' },
  { label: 'Memory', value: '520 KB SRAM + 4 MB Flash' },
  { label: 'Power', value: 'USB-C 5V / Li-Po battery option' }
];

hwSpecs.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 6;
  const y = 1.7 + row * 1.6;

  hwSlide.addShape(pptx.ShapeType.rect, {
    x, y, w: 5.4, h: 1.3,
    fill: { color: DARK_CARD }, rectRadius: 0.1
  });

  hwSlide.addText(item.label, {
    x: x + 0.3, y: y + 0.15, w: 4.8, h: 0.5,
    fontSize: 14, fontFace: 'Arial',
    color: ACCENT, bold: true
  });

  hwSlide.addText(item.value, {
    x: x + 0.3, y: y + 0.6, w: 4.8, h: 0.5,
    fontSize: 18, fontFace: 'Arial',
    color: WHITE
  });
});


// ─── 20. Marketplace Monetization ───────────────────────────────────────────
addTwoColumnSlide('Marketplace Monetization',
  'Fees & Revenue',
  [
    '5% transaction fee (min $1) on all sales',
    '$6 flat shipping fee per order',
    'Optional shipping insurance add-on',
    'Escrow fee for high-value transactions',
    'Future: promoted listing placements',
    'Future: Vinyl Buddy hardware sales'
  ],
  'Seller Tiers & Promotions',
  [
    'Bronze / Silver / Gold seller tiers',
    'Tier benefits: lower fees, priority support',
    'Coupon and promo code system for sellers',
    'Bulk listing discounts',
    'Future: premium subscription for power sellers',
    'Future: storefront customization'
  ]
);


// ─── 21. API Overview ───────────────────────────────────────────────────────
addCardGridSlide('API Overview \u2014 200+ Endpoints', [
  { number: '35+', label: 'Marketplace & Checkout' },
  { number: '25+', label: 'Social & Feed' },
  { number: '20+', label: 'Collection & Records' },
  { number: '30+', label: 'Vinyl Buddy / Hardware' },
  { number: '20+', label: 'Auth & User Management' },
  { number: '70+', label: 'Analytics, Admin & Misc' }
]);


// ─── 22. Technology Stack ───────────────────────────────────────────────────
const techSlide = pptx.addSlide();
techSlide.background = { color: BG };

techSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

techSlide.addText('Technology Stack', {
  x: 0.8, y: 0.4, w: 11.5, h: 0.8,
  fontSize: 32, fontFace: 'Arial',
  color: WHITE, bold: true
});

techSlide.addShape(pptx.ShapeType.rect, {
  x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
});

const techItems = [
  { label: 'Frontend', value: 'React 19 + Tailwind CSS' },
  { label: 'Backend', value: 'Express.js + Node.js' },
  { label: 'Database', value: 'PostgreSQL (Railway)' },
  { label: 'Auth', value: 'JWT + bcrypt + TOTP 2FA' },
  { label: 'Payments', value: 'Stripe Checkout + Connect' },
  { label: 'AI', value: 'Claude API + Discogs + AudD' },
  { label: 'Deploy', value: 'Vercel + Railway CI/CD' },
  { label: 'Hardware', value: 'ESP32-DevKitC V4 (C++)' }
];

techItems.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 6;
  const y = 1.7 + row * 1.4;

  techSlide.addShape(pptx.ShapeType.rect, {
    x, y, w: 5.4, h: 1.15,
    fill: { color: DARK_CARD }, rectRadius: 0.1
  });

  techSlide.addText(item.label, {
    x: x + 0.3, y: y + 0.1, w: 4.8, h: 0.45,
    fontSize: 14, fontFace: 'Arial',
    color: ACCENT, bold: true
  });

  techSlide.addText(item.value, {
    x: x + 0.3, y: y + 0.55, w: 4.8, h: 0.45,
    fontSize: 18, fontFace: 'Arial',
    color: WHITE
  });
});


// ─── 23. PWA & Mobile Experience ────────────────────────────────────────────
addContentSlide('PWA & Mobile Experience', [
  'Progressive Web App \u2014 installable on iOS and Android',
  'Responsive design from mobile to ultrawide desktop',
  'Touch-optimized: swipe gestures for like, save, dismiss',
  'Offline-capable with service worker caching',
  'Push notification support via service workers',
  'App-like navigation with bottom tab bar on mobile',
  'Fast load times with code splitting and lazy loading'
]);


// ─── 24. Accessibility & Themes ─────────────────────────────────────────────
addContentSlide('Accessibility & Themes', [
  'Full keyboard navigation with visible focus indicators',
  'Keyboard shortcuts: 1-9 for tabs, Cmd+K command palette',
  'Command palette with fuzzy search across records, users, and actions',
  'Dark and light theme with system preference auto-detection',
  'Reduced motion support for users who prefer less animation',
  'High contrast mode for improved visibility',
  'Screen reader announcements and ARIA labels throughout',
  'Skip-to-content links and logical heading hierarchy'
]);


// ─── 25. Security & Privacy ─────────────────────────────────────────────────
addContentSlide('Security & Privacy', [
  'JWT authentication with bcrypt password hashing',
  'TOTP-based two-factor authentication (2FA)',
  'Rate limiting per endpoint to prevent abuse',
  'CSRF token protection on state-changing requests',
  'GDPR-compliant data export and full account deletion',
  'Password reset flow with secure token expiry',
  'Content reporting and moderation tools',
  'Request tracing and audit logging'
]);


// ─── 26. Deployment & Infrastructure ────────────────────────────────────────
addTwoColumnSlide('Deployment & Infrastructure',
  'Hosting & CI/CD',
  [
    'Vercel for frontend with global CDN',
    'Railway for backend + PostgreSQL',
    'GitHub auto-deploy on push to main',
    'Environment-based config (dev/staging/prod)',
    'Gzip compression and response optimization',
    'Graceful shutdown handling'
  ],
  'Monitoring & Ops',
  [
    'Health check endpoint with uptime stats',
    'Database migration versioning system',
    'Scheduled backup system (configurable)',
    'Server start time and request tracing',
    'OpenAPI spec and API documentation endpoint',
    'Changelog endpoint for version tracking'
  ]
);


// ─── 27. Platform Stats ─────────────────────────────────────────────────────
addCardGridSlide('Platform Stats', [
  { number: '2,000+', label: 'Seed Records' },
  { number: '41', label: 'Collector Profiles' },
  { number: '18 / 85+', label: 'Genres / Subgenres' },
  { number: '200+', label: 'API Endpoints' },
  { number: '169+', label: 'Listening Sessions' },
  { number: '15', label: 'Development Waves' }
]);


// ─── 28. Roadmap / Future Plans ─────────────────────────────────────────────
addContentSlide('Roadmap \u2014 Future Plans', [
  'Mobile app (React Native) for iOS and Android',
  'Real-time notifications and chat via WebSockets',
  'Vinyl Buddy v2: improved WiFi + Bluetooth + OLED display',
  'Live listening sessions \u2014 listen along with friends',
  'International shipping and multi-currency support',
  'Premium subscription tiers for power collectors',
  'Marketplace search ads and promoted listings',
  'Record label partnerships and exclusive drops'
]);


// ─── 29. Thank You / Contact ────────────────────────────────────────────────
const thankYouSlide = pptx.addSlide();
thankYouSlide.background = { color: BG };

thankYouSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

thankYouSlide.addText('GrooveStack', {
  x: 0.8, y: 1.2, w: 11.5, h: 1.2,
  fontSize: 56, fontFace: 'Arial',
  color: WHITE, bold: true, align: 'center'
});

thankYouSlide.addText('+ Vinyl Buddy', {
  x: 0.8, y: 2.3, w: 11.5, h: 0.7,
  fontSize: 28, fontFace: 'Arial',
  color: ACCENT, align: 'center'
});

thankYouSlide.addText('Where Vinyl Lives', {
  x: 0.8, y: 3.3, w: 11.5, h: 0.7,
  fontSize: 22, fontFace: 'Arial',
  color: LIGHT_GRAY, align: 'center'
});

thankYouSlide.addText([
  { text: 'groovestack.vercel.app', options: { fontSize: 18, color: WHITE } },
  { text: '\n' },
  { text: 'github.com/colelevy08/groovestack', options: { fontSize: 16, color: GRAY } }
], {
  x: 0.8, y: 4.3, w: 11.5, h: 1.2,
  fontFace: 'Arial', align: 'center',
  lineSpacingMultiple: 1.5
});

thankYouSlide.addText('Thank you!', {
  x: 0.8, y: 5.8, w: 11.5, h: 0.6,
  fontSize: 18, fontFace: 'Arial',
  color: GRAY, align: 'center'
});

thankYouSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: ACCENT }
});


// ═══════════════════════════════════════════════════════════════════════════════
// Generate
// ═══════════════════════════════════════════════════════════════════════════════

const outputPath = '/Users/colelevy/Development/groovestack/GrooveStack_Overview.pptx';
pptx.writeFile({ fileName: outputPath })
  .then(() => console.log(`Presentation saved to: ${outputPath}`))
  .catch(err => console.error('Error:', err));
