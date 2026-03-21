const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();

// Set theme
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'GrooveStack';
pptx.company = 'GrooveStack';
pptx.subject = 'Product Overview — Waves 1–20';

// Theme colors
const BG = '0f1117';
const WHITE = 'FFFFFF';
const GRAY = 'a1a1aa';
const ACCENT = '0ea5e9';
const DARK_CARD = '18181b';
const LIGHT_GRAY = 'd4d4d8';
const GREEN = '22c55e';

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
    const fontSize = bullets.length > 8 ? 14 : bullets.length > 6 ? 16 : 18;
    const textRows = bullets.map(b => ({
      text: b,
      options: {
        fontSize, fontFace: 'Arial', color: GRAY,
        bullet: { type: 'bullet', color: ACCENT },
        paraSpaceAfter: 5,
        lineSpacingMultiple: 1.2
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

  const leftFontSize = leftBullets.length > 7 ? 13 : 15;
  const leftRows = leftBullets.map(b => ({
    text: b,
    options: {
      fontSize: leftFontSize, fontFace: 'Arial', color: GRAY,
      bullet: { type: 'bullet', color: ACCENT },
      paraSpaceAfter: 4, lineSpacingMultiple: 1.15
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

  const rightFontSize = rightBullets.length > 7 ? 13 : 15;
  const rightRows = rightBullets.map(b => ({
    text: b,
    options: {
      fontSize: rightFontSize, fontFace: 'Arial', color: GRAY,
      bullet: { type: 'bullet', color: ACCENT },
      paraSpaceAfter: 4, lineSpacingMultiple: 1.15
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

function addSpecGridSlide(title, specs) {
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

  specs.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + col * 6;
    const y = 1.7 + row * 1.4;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 5.4, h: 1.15,
      fill: { color: DARK_CARD }, rectRadius: 0.1
    });

    slide.addText(item.label, {
      x: x + 0.3, y: y + 0.1, w: 4.8, h: 0.45,
      fontSize: 14, fontFace: 'Arial',
      color: ACCENT, bold: true
    });

    slide.addText(item.value, {
      x: x + 0.3, y: y + 0.55, w: 4.8, h: 0.45,
      fontSize: 18, fontFace: 'Arial',
      color: WHITE
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

titleSlide.addText('Waves 1\u201320  \u2022  Final Comprehensive Edition', {
  x: 0.8, y: 5.2, w: 11.5, h: 0.5,
  fontSize: 14, fontFace: 'Arial',
  color: GRAY, align: 'center'
});

titleSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: ACCENT }
});


// ─── 2. What Is GrooveStack ─────────────────────────────────────────────────
addContentSlide('What Is GrooveStack?', [
  'An all-in-one platform for vinyl record collectors',
  'Social marketplace: buy, sell, trade, and auction records',
  'Collection management with value tracking, analytics, and virtual scrolling',
  'Social network: posts, stories, DMs, follows, and activity feed',
  'Hardware companion device (Vinyl Buddy) with BLE, OLED, SD card, and gesture control',
  'AI-powered verification with Claude and Discogs integration',
  'PWA with full mobile and desktop experience, card flip animations, and drawer modals',
  'ESP-NOW mesh networking for multi-device communication',
  '1,800+ improvements across 20 development waves'
]);


// ─── 3. Platform Stats ──────────────────────────────────────────────────────
addCardGridSlide('Platform Stats', [
  { number: '1,800+', label: 'Total Improvements' },
  { number: '275+', label: 'API Endpoints' },
  { number: '51', label: 'Collector Profiles' },
  { number: '100+', label: 'Seed Records' },
  { number: '20', label: 'Development Waves' },
  { number: '18 / 85+', label: 'Genres / Subgenres' }
]);


// ─── 4. Key Features Summary ────────────────────────────────────────────────
addCardGridSlide('Key Features Summary', [
  { number: 'Marketplace', label: 'Buy, Sell, Trade, Auction' },
  { number: 'Social', label: 'Feed, Posts, Stories, DMs' },
  { number: 'Collections', label: 'Organize, Track, Value' },
  { number: 'Analytics', label: 'Charts, Stats, Insights' },
  { number: 'Vinyl Buddy', label: 'BLE + OLED + SD + Gesture' },
  { number: '275+ APIs', label: 'Full REST Backend' }
]);


// ─── 5. Marketplace — Buying & Selling ──────────────────────────────────────
addTwoColumnSlide('Marketplace \u2014 Buying & Selling',
  'Buying',
  [
    'Browse and search with advanced filters',
    'Condition grading (Goldmine scale)',
    'Secure Stripe Checkout payments',
    'Discogs-powered price suggestions',
    'One-click purchase flow',
    'Order tracking and history',
    'Virtual scrolling for large result sets',
    'Card flip animations for record details'
  ],
  'Selling',
  [
    'List records with photos and descriptions',
    'Set your own price or use AI suggestions',
    'Manage inventory and listings',
    'Seller dashboard with sales analytics',
    'Bulk import from CSV or Discogs',
    'Coupon and promo code support',
    'Featured listing placements',
    'Seller tier benefits and fee discounts'
  ]
);


// ─── 6. Marketplace — Offers & Auctions ─────────────────────────────────────
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


// ─── 7. Marketplace Monetization ────────────────────────────────────────────
addTwoColumnSlide('Marketplace Monetization',
  'Fees & Revenue',
  [
    '5% transaction fee (min $1) on all sales',
    '$6 flat shipping fee per order',
    'Optional shipping insurance add-on',
    'Escrow fee for high-value transactions',
    'Featured listing placement fees',
    'Premium seller subscription tiers',
    'Vinyl Buddy hardware sales revenue'
  ],
  'Seller Tiers & Loyalty',
  [
    'Bronze / Silver / Gold / Platinum seller tiers',
    'Tier benefits: lower fees, priority support, badges',
    'Loyalty points system for repeat buyers',
    'Points redeemable for listing credits and discounts',
    'Coupon and promo code system for sellers',
    'Bulk listing discounts for power sellers',
    'Storefront customization for top-tier sellers'
  ]
);


// ─── 8. Transaction System ──────────────────────────────────────────────────
addContentSlide('Transaction System', [
  '5% platform transaction fee (minimum $1) on all sales',
  '$6 flat shipping fee per order with carrier tracking',
  'Escrow system for high-value transactions',
  'Optional shipping insurance for added protection',
  'Stripe-powered secure payment processing',
  'Dispute resolution workflow with admin review',
  'Refund processing and return management',
  'Full transaction history with receipts',
  'Fee calculator so sellers preview net proceeds before listing'
]);


// ─── 9. Social Features — Feed, Posts & Stories ─────────────────────────────
addTwoColumnSlide('Social Features \u2014 Feed, Posts & Stories',
  'Activity Feed',
  [
    'Chronological and trending content',
    'Rich post types: text, photo, record shares',
    'Like, comment, save, and bookmark',
    'Share records from your collection to the feed',
    'Trending posts algorithm',
    'Filtered views: following, popular, recent',
    'Virtual scrolling for infinite feed performance'
  ],
  'Stories',
  [
    'Ephemeral 24-hour stories',
    'Photo and text story formats',
    'Story ring indicator on profile avatars',
    'View count and viewer list',
    'Tap-through story navigation',
    'Story highlights on profile',
    'Card flip transitions between stories'
  ]
);


// ─── 10. Messaging System ───────────────────────────────────────────────────
addContentSlide('Messaging System', [
  'Real-time direct messaging between collectors',
  'Read receipts with delivered/read status indicators',
  'Message threads organized by conversation',
  'Typing indicators and online presence',
  'Share records and listings in messages',
  'Message reactions and pinned messages',
  'Scheduled messages — compose now, send later',
  'Conversation archiving for inbox management',
  'Attachment support: images, audio, documents',
  'Drawer modal interface for quick DM access'
]);


// ─── 11. Collection Management ──────────────────────────────────────────────
addContentSlide('Collection Management', [
  'Add records manually or import from Discogs / CSV',
  'Organize with custom folders, tags, and categories',
  'Condition grading using the Goldmine standard',
  'Track purchase price, date acquired, and current value',
  'Collection value estimation powered by Discogs pricing',
  'Duplicate detection and merge tools',
  'Collection sharing with public/private visibility',
  'Export collection data as CSV',
  'Virtual scrolling for collections with 1,000+ records',
  'Card flip animations for quick record preview'
]);


// ─── 12. Analytics Dashboard ────────────────────────────────────────────────
addContentSlide('Analytics Dashboard', [
  'Full dashboard with custom SVG charts (zero external deps)',
  'Collection value tracking over time with trend lines',
  'Genre distribution pie chart and condition breakdown',
  'Monthly spending analytics with bar charts',
  'Seller/buyer analytics with top partners and trends',
  'Listening pattern analysis from Vinyl Buddy data',
  'Most played artists, albums, and genre heatmaps',
  'Mood detection and taste evolution over time',
  'Time range filtering: all time, 12mo, 6mo, 3mo, 30 days'
]);


// ─── 13. Explore & Discovery ────────────────────────────────────────────────
addContentSlide('Explore & Discovery', [
  'Browse records by genre, artist, era, condition, and price',
  'Full-text search across records, users, and posts',
  'Trending records and popular sellers highlighted',
  'Genre and subgenre taxonomy (18 genres, 85+ subgenres)',
  'New arrivals and recently listed sections',
  'Personalized recommendations based on collection and listening',
  'Artist profile pages with discography and related records',
  'Virtual scrolling for smooth browsing of large catalogs'
]);


// ─── 14. User Profiles & Reputation ─────────────────────────────────────────
addTwoColumnSlide('User Profiles & Reputation',
  'Profiles',
  [
    'Customizable bio, avatar, header image, and accent color',
    'Public collection and wishlist showcase',
    'Six profile tabs: Posts, Listening, Records, For Sale, Saved, Wishlist',
    'Badge display (verified, achievements, tier)',
    'Profile stats: records, posts, sales',
    'QR code generation for easy sharing',
    'Activity heatmap showing engagement over time'
  ],
  'Reputation',
  [
    'Reputation score from sales and reviews',
    'Star ratings from buyers and sellers',
    'Dispute history factored into trust',
    'Seller tier badges (Bronze, Silver, Gold, Platinum)',
    'Verified vinyl checkmark badge',
    'Tiered identity verification (email, phone, ID)',
    'Top Collector badge for high-ranking users'
  ]
);


// ─── 15. Following & Social Graph ───────────────────────────────────────────
addContentSlide('Following & Social Graph', [
  'Follow collectors to see their posts and listings in your feed',
  'Followers / following counts displayed on profiles',
  'Mutual follow detection for closer connections',
  'Follow suggestions based on shared tastes',
  'Activity notifications when followed users post or list',
  'Discover collectors with similar collections',
  'Content bookmarking for saving posts to read later'
]);


// ─── 16. Wishlist & Price Alerts ────────────────────────────────────────────
addContentSlide('Wishlist & Price Alerts', [
  'Save any record to your personal wishlist',
  'Priority levels: High, Medium, Low with color-coded indicators',
  'Price alert notifications when wishlist items are listed',
  'Alert when wishlist items drop below target price',
  'Automatic matching when marketplace listings match wishlist items',
  'Discogs wantlist import',
  'Share wishlist links with friends or publicly',
  'Sorting and filtering by date, priority, price, or artist'
]);


// ─── 17. Notifications System ───────────────────────────────────────────────
addContentSlide('Notifications System', [
  'Categorized notifications: offers, messages, follows, likes, price alerts, system',
  'Inline actions: accept/decline offers directly from notifications',
  'Mark as read individually or mark all as read',
  'Email notification triggers for critical events',
  'Unread count badges in navigation',
  'Granular notification preferences by category',
  'Push notification support via service workers'
]);


// ─── 18. Settings & Customization ───────────────────────────────────────────
addContentSlide('Settings & Customization', [
  'Account settings: email, username, password, 2FA',
  'Appearance: dark/light theme, 8 accent colors, font size',
  'Language: i18n-ready with 8 language support',
  'Customizable keyboard shortcuts for navigation and actions',
  'Connected accounts: Discogs, Spotify, Last.fm, Apple Music',
  'Shipping address management with multiple saved addresses',
  'Privacy controls: profile visibility, search indexing, data sharing',
  'Session management: view and revoke active sessions',
  'GDPR data export and full account deletion'
]);


// ─── 19. UI Innovations — Card Flip & Drawer Modals ────────────────────────
addTwoColumnSlide('UI Innovations',
  'Card Flip Animations',
  [
    '3D CSS card flip for record previews',
    'Front: album art, artist, price',
    'Back: condition, pressing details, quick actions',
    'Smooth 0.6s transform with perspective',
    'Touch-friendly tap-to-flip on mobile',
    'Used across Explore, Collection, and Wishlist'
  ],
  'Drawer Modals & Virtual Scrolling',
  [
    'Bottom drawer modals for mobile-first UX',
    'Swipe-down to dismiss gesture support',
    'Snap points: collapsed, half, full screen',
    'Virtual scrolling for 1,000+ item lists',
    'Only renders visible rows for 60fps performance',
    'Lazy image loading with placeholder shimmer'
  ]
);


// ─── 20. Performance Optimizations ──────────────────────────────────────────
addContentSlide('Performance Optimizations', [
  'Virtual scrolling renders only visible items in long lists',
  'React.lazy and Suspense for code-split screen loading',
  'Lazy image loading with IntersectionObserver',
  'Debounced search inputs to reduce API calls',
  'Memoized components with React.memo and useMemo',
  'Gzip compression on all API responses',
  'Service worker caching for offline-capable PWA',
  'Optimistic UI updates for likes, saves, and follows',
  'Batch API endpoint for combining multiple requests'
]);


// ─── 21. What Is Vinyl Buddy ────────────────────────────────────────────────
addContentSlide('What Is Vinyl Buddy?', [
  'A hardware companion device for your turntable',
  'Automatically identifies records as they play',
  'Audio fingerprinting powered by AudD recognition API',
  'Logs every listening session to your GrooveStack profile',
  'Tracks genre stats, listening streaks, and mood patterns',
  'Connects via WiFi and BLE for real-time sync',
  'OLED display shows track info, connection status, and device code',
  'SD card slot for offline session caching',
  'Gesture sensor for hands-free control'
]);


// ─── 22. Vinyl Buddy Features ───────────────────────────────────────────────
addTwoColumnSlide('Vinyl Buddy Features',
  'Identification & Tracking',
  [
    'Real-time audio fingerprinting via AudD',
    'Listening history with timestamps',
    'Genre classification per session',
    'Mood detection from listening patterns',
    'Listening streaks and goals',
    'Achievement badges (First Spin, Century Club, etc.)',
    'Side A/B and RPM (33/45/78) tracking'
  ],
  'Stats & Insights',
  [
    'Most played artists and albums',
    'Genre evolution chart over time',
    'Peak listening hours heatmap',
    'Personalized recommendations',
    'Weekly and monthly listening reports',
    'Taste comparison with friends',
    'Now Playing display with equalizer visualization'
  ]
);


// ─── 23. Vinyl Buddy Device Management ──────────────────────────────────────
addContentSlide('Vinyl Buddy \u2014 Device Management', [
  'Device pairing via 12-character activation code on OLED',
  'Real-time device health monitoring and diagnostics',
  'Firmware version checking and OTA update support',
  'Audio calibration wizard for optimal identification',
  'Battery level monitoring and low-power alerts',
  'Multi-device support: pair up to 4 Vinyl Buddies',
  'Device naming and location tagging',
  'Heartbeat monitoring every 30 seconds'
]);


// ─── 24. Vinyl Buddy Hardware — Complete Specs ──────────────────────────────
addSpecGridSlide('Vinyl Buddy Hardware \u2014 Complete Specs', [
  { label: 'Microcontroller', value: 'ESP32-DevKitC V4 (Dual-core @ 240 MHz)' },
  { label: 'Connectivity', value: 'WiFi 802.11 b/g/n + BLE 4.2 + ESP-NOW' },
  { label: 'Audio Input', value: 'I2S MEMS Microphone (INMP441)' },
  { label: 'Display', value: 'SSD1306 OLED 128x64 (I2C)' },
  { label: 'Storage', value: 'SD Card slot for offline session caching' },
  { label: 'Sensors', value: 'APDS-9960 gesture sensor (wave control)' },
  { label: 'Audio Processing', value: 'Active noise cancellation + auto-gain' },
  { label: 'Power', value: 'USB-C 5V / Li-Po battery option' }
]);


// ─── 25. ESP-NOW Mesh Networking ────────────────────────────────────────────
addContentSlide('ESP-NOW Mesh Networking', [
  'Peer-to-peer communication between Vinyl Buddy devices',
  'No WiFi router required for device-to-device data transfer',
  'Multi-room listening session synchronization',
  'Automatic peer discovery within range',
  'Low-latency data exchange (< 10ms)',
  'Encrypted payload transfer between paired devices',
  'Mesh topology allows relay through intermediate nodes',
  'Enables "listen along" feature across rooms'
]);


// ─── 26. Vinyl Buddy Firmware Features ──────────────────────────────────────
addTwoColumnSlide('Vinyl Buddy Firmware',
  'Core Firmware',
  [
    'FreeRTOS task-based architecture',
    'I2S audio capture at 16 kHz / 16-bit',
    'WiFi auto-reconnect with exponential backoff',
    'BLE pairing and configuration mode',
    'OTA firmware update support',
    'Watchdog timer for crash recovery',
    'Deep sleep mode for power saving'
  ],
  'Advanced Features',
  [
    'Active noise cancellation for cleaner audio',
    'Auto-gain control for varying room volumes',
    'SD card logging for offline sessions',
    'OLED display: track info, status, animations',
    'APDS-9960 gesture: wave to skip, swipe to control',
    'ESP-NOW mesh for multi-device sync',
    'LED status indicators (WiFi, BLE, listening)'
  ]
);


// ─── 27. Security & Privacy ─────────────────────────────────────────────────
addContentSlide('Security & Privacy', [
  'JWT authentication with bcrypt password hashing',
  'TOTP-based two-factor authentication (2FA)',
  'Rate limiting: 100 req/min general, 10 req/min auth',
  'CSRF token protection on state-changing requests',
  'CORS configuration with allowed origin management',
  'GDPR-compliant data export and full account deletion',
  'Password reset flow with secure token expiry',
  'Content reporting and moderation queue',
  'Request tracing and audit logging with unique request IDs',
  'Input validation and SQL injection prevention'
]);


// ─── 28. Accessibility Features ─────────────────────────────────────────────
addContentSlide('Accessibility Features', [
  'Full keyboard navigation with visible focus indicators',
  'Keyboard shortcuts: 1-9 for tabs, Cmd+K command palette',
  'Command palette with fuzzy search across records, users, and actions',
  'Dark and light theme with system preference auto-detection',
  'Reduced motion support for users who prefer less animation',
  'High contrast mode for improved visibility',
  'Screen reader announcements and ARIA labels throughout',
  'Skip-to-content links and logical heading hierarchy',
  'Font size adjustment in settings'
]);


// ─── 29. PWA & Mobile Experience ────────────────────────────────────────────
addContentSlide('PWA & Mobile Experience', [
  'Progressive Web App \u2014 installable on iOS and Android',
  'Responsive design from mobile to ultrawide desktop',
  'Touch-optimized: swipe gestures for like, save, dismiss',
  'Offline-capable with service worker caching',
  'Push notification support via service workers',
  'App-like navigation with bottom tab bar on mobile',
  'Fast load times with code splitting and lazy loading',
  'Drawer modals with swipe-to-dismiss on mobile',
  'Card flip animations for engaging record browsing'
]);


// ─── 30. API Overview ───────────────────────────────────────────────────────
addCardGridSlide('API Overview \u2014 275+ Endpoints', [
  { number: '40+', label: 'Marketplace & Checkout' },
  { number: '30+', label: 'Social & Feed' },
  { number: '25+', label: 'Collection & Records' },
  { number: '35+', label: 'Vinyl Buddy / Hardware' },
  { number: '25+', label: 'Auth & User Management' },
  { number: '120+', label: 'Analytics, Admin, Utility & Misc' }
]);


// ─── 31. Technology Stack ───────────────────────────────────────────────────
addSpecGridSlide('Technology Stack', [
  { label: 'Frontend', value: 'React 19 + Tailwind CSS 3.4' },
  { label: 'Backend', value: 'Express.js 5 + Node.js 18+' },
  { label: 'Database', value: 'PostgreSQL (35+ tables, Railway)' },
  { label: 'Auth', value: 'JWT + bcrypt + TOTP 2FA' },
  { label: 'Payments', value: 'Stripe Checkout + Connect' },
  { label: 'AI', value: 'Claude API + Discogs + AudD' },
  { label: 'Deploy', value: 'Vercel + Railway CI/CD' },
  { label: 'Hardware', value: 'ESP32 + BLE + OLED + SD + Gesture' }
]);


// ─── 32. Deployment & Infrastructure ────────────────────────────────────────
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
    'Database migration versioning (8+ versions)',
    'Scheduled backup system (configurable)',
    'Server start time and request tracing',
    'OpenAPI spec and API documentation endpoint',
    'Changelog endpoint for version tracking'
  ]
);


// ─── 33. Development Journey — Waves 1–10 ───────────────────────────────────
addContentSlide('Development Journey \u2014 Waves 1\u201310', [
  'Wave 1: Collection management, CRUD, JWT auth, search, profiles',
  'Wave 2: Marketplace, offers, Discogs pricing, analytics, dark mode',
  'Wave 3: Messaging, wishlist, notifications, Stripe Checkout',
  'Wave 4: Vinyl Buddy ESP32, audio fingerprinting, achievements',
  'Wave 5: Social feed, posts, comments, follows, trending',
  'Wave 6: AI condition grading, onboarding, marketplace stats',
  'Wave 7: Country origins, decade themes, community badges, labels',
  'Wave 8: Escrow, disputes, provenance, scheduled messages',
  'Wave 9: Vinyl care guides, Goldmine grading guide, 200+ records',
  'Wave 10: Stories, profile enhancements, RSS feed, batch API'
]);


// ─── 34. Development Journey — Waves 11–20 ──────────────────────────────────
addContentSlide('Development Journey \u2014 Waves 11\u201320', [
  'Wave 11: Auction system, loyalty points, seller tiers',
  'Wave 12: Virtual scrolling, performance optimizations',
  'Wave 13: Card flip animations, drawer modals, swipe gestures',
  'Wave 14: BLE device pairing, OLED display improvements',
  'Wave 15: SD card offline caching, gesture sensor integration',
  'Wave 16: ESP-NOW mesh networking, multi-room sync',
  'Wave 17: Active noise cancellation, auto-gain control',
  'Wave 18: Featured listings, storefront customization',
  'Wave 19: Advanced analytics, taste evolution, mood detection',
  'Wave 20: Final polish, 275+ endpoints, comprehensive documentation'
]);


// ─── 35. Roadmap / Future Plans ─────────────────────────────────────────────
addContentSlide('Roadmap \u2014 Future Plans', [
  'Mobile app (React Native) for iOS and Android',
  'Real-time notifications and chat via WebSockets',
  'Vinyl Buddy v2: improved form factor and enclosure design',
  'Live listening sessions \u2014 listen along with friends in real time',
  'International shipping and multi-currency support',
  'Premium subscription tiers for power collectors',
  'Marketplace search ads and promoted listings',
  'Record label partnerships and exclusive drops',
  'Vinyl Buddy retail sales and distribution'
]);


// ─── 36. Thank You / Contact ────────────────────────────────────────────────
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
  { text: '1,800+ improvements  \u2022  275+ API endpoints  \u2022  20 waves', options: { fontSize: 16, color: GREEN } },
  { text: '\n' },
  { text: 'groovestack.vercel.app', options: { fontSize: 18, color: WHITE } },
  { text: '\n' },
  { text: 'github.com/colelevy08/groovestack', options: { fontSize: 16, color: GRAY } }
], {
  x: 0.8, y: 4.3, w: 11.5, h: 1.5,
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
  .then(() => console.log(`Presentation saved to: ${outputPath} (36 slides)`))
  .catch(err => console.error('Error:', err));
