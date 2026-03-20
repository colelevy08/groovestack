const pptxgen = require('pptxgenjs');
const pptx = new pptxgen();

// Set theme
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'GrooveStack';
pptx.company = 'GrooveStack';
pptx.subject = 'Product Overview';

// Theme colors
const BG = '0a0a0a';
const WHITE = 'FFFFFF';
const GRAY = 'a1a1aa';
const ACCENT = '0ea5e9';
const DARK_CARD = '18181b';

// Helper: add a consistent slide with title and bullet points
function addContentSlide(title, bullets, options = {}) {
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
    const textRows = bullets.map(b => ({
      text: b,
      options: {
        fontSize: 18, fontFace: 'Arial', color: GRAY,
        bullet: { type: 'bullet', color: ACCENT },
        paraSpaceAfter: 8,
        lineSpacingMultiple: 1.3
      }
    }));

    slide.addText(textRows, {
      x: 0.8, y: 1.6, w: 11.5, h: 5.2,
      valign: 'top'
    });
  }

  return slide;
}

// ─── Slide 1: Title ───
const slide1 = pptx.addSlide();
slide1.background = { color: BG };

// Accent bar
slide1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

// Large title
slide1.addText('GrooveStack', {
  x: 0.8, y: 1.8, w: 11.5, h: 1.4,
  fontSize: 64, fontFace: 'Arial',
  color: WHITE, bold: true, align: 'center'
});

// Subtitle
slide1.addText('The Social Marketplace for Vinyl Collectors', {
  x: 0.8, y: 3.2, w: 11.5, h: 0.8,
  fontSize: 24, fontFace: 'Arial',
  color: ACCENT, align: 'center'
});

// Tagline
slide1.addText('Powered by AI  \u2022  Built for Collectors  \u2022  Connected by Music', {
  x: 0.8, y: 4.2, w: 11.5, h: 0.6,
  fontSize: 16, fontFace: 'Arial',
  color: GRAY, align: 'center'
});

// Bottom accent bar
slide1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

// ─── Slide 2: The Problem ───
addContentSlide('The Problem', [
  'Vinyl collecting is fragmented across dozens of platforms',
  'No single platform for buying, selling, trading, AND socializing',
  'No way to identify what\'s playing on your turntable automatically',
  'Pricing is inconsistent across platforms \u2014 collectors overpay or undersell'
]);

// ─── Slide 3: The Solution ───
addContentSlide('The Solution \u2014 GrooveStack', [
  'All-in-one vinyl collector platform',
  'Social marketplace + collection management in one place',
  'AI-powered record verification for authenticity',
  'Hardware integration with Vinyl Buddy for turntable identification'
]);

// ─── Slide 4: Key Features \u2014 Marketplace ───
addContentSlide('Key Features \u2014 Marketplace', [
  'Buy and sell with secure Stripe payments',
  'Discogs-powered pricing suggestions for fair deals',
  '5% platform transaction fee (min $1)',
  'Condition-based grading using the Goldmine scale',
  'Secure shipping address management'
]);

// ─── Slide 5: Key Features \u2014 Social ───
addContentSlide('Key Features \u2014 Social', [
  'Post, share, and discover vinyl with other collectors',
  'Follow collectors, comment, and like posts',
  'Direct messaging with read receipts',
  'Activity feed with trending content',
  'User profiles with wishlists and collections'
]);

// ─── Slide 6: Key Features \u2014 Trading ───
addContentSlide('Key Features \u2014 Trading', [
  'Cash, trade, or combo offers for flexible deals',
  'Fair trade indicator to ensure balanced exchanges',
  'Address exchange for physical trades',
  'Offer accept/decline with real-time notifications'
]);

// ─── Slide 7: Vinyl Buddy Hardware ───
addContentSlide('Vinyl Buddy Hardware', [
  'ESP32-DevKitC V4 microcontroller device',
  'Identifies records playing on your turntable automatically',
  'Audio fingerprinting via AudD API',
  'Real-time listening history tracking',
  'Genre stats and personalized recommendations',
  'Device health monitoring and diagnostics'
]);

// ─── Slide 8: AI Integration ───
addContentSlide('AI Integration', [
  'Claude Opus 4.6 for vinyl verification and insights',
  'Photo verification of physical records for authenticity',
  'Blue checkmark badge for verified vinyl',
  'Discogs API for real-time market pricing',
  'iTunes API for high-quality album artwork',
  'Wikipedia API for artist info and context'
]);

// ─── Slide 9: Technology Stack ───
const slide9 = pptx.addSlide();
slide9.background = { color: BG };

slide9.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

slide9.addText('Technology Stack', {
  x: 0.8, y: 0.4, w: 11.5, h: 0.8,
  fontSize: 32, fontFace: 'Arial',
  color: WHITE, bold: true
});

slide9.addShape(pptx.ShapeType.rect, {
  x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
});

const techItems = [
  { label: 'Frontend', value: 'React 19 + Tailwind CSS' },
  { label: 'Backend', value: 'Express.js + PostgreSQL' },
  { label: 'Auth', value: 'JWT with bcrypt' },
  { label: 'Payments', value: 'Stripe Checkout' },
  { label: 'Deploy', value: 'Vercel + Railway' },
  { label: 'Hardware', value: 'ESP32-DevKitC V4' }
];

techItems.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.8 + col * 6;
  const y = 1.7 + row * 1.6;

  // Card background
  slide9.addShape(pptx.ShapeType.rect, {
    x: x, y: y, w: 5.4, h: 1.3,
    fill: { color: DARK_CARD },
    rectRadius: 0.1
  });

  // Label
  slide9.addText(item.label, {
    x: x + 0.3, y: y + 0.15, w: 4.8, h: 0.5,
    fontSize: 14, fontFace: 'Arial',
    color: ACCENT, bold: true
  });

  // Value
  slide9.addText(item.value, {
    x: x + 0.3, y: y + 0.6, w: 4.8, h: 0.5,
    fontSize: 18, fontFace: 'Arial',
    color: WHITE
  });
});

// ─── Slide 10: Platform Stats ───
const slide10 = pptx.addSlide();
slide10.background = { color: BG };

slide10.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

slide10.addText('Platform Stats', {
  x: 0.8, y: 0.4, w: 11.5, h: 0.8,
  fontSize: 32, fontFace: 'Arial',
  color: WHITE, bold: true
});

slide10.addShape(pptx.ShapeType.rect, {
  x: 0.8, y: 1.25, w: 2.5, h: 0.04, fill: { color: ACCENT }
});

const stats = [
  { number: '2,000+', label: 'Seed Records' },
  { number: '31', label: 'Collector Profiles' },
  { number: '18 / 85+', label: 'Genres / Subgenres' },
  { number: '45+', label: 'Social Posts' },
  { number: '73+', label: 'Listening Sessions' },
  { number: '21+', label: 'API Endpoints' }
];

stats.forEach((stat, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = 0.8 + col * 4;
  const y = 1.8 + row * 2.5;

  // Card background
  slide10.addShape(pptx.ShapeType.rect, {
    x: x, y: y, w: 3.5, h: 2,
    fill: { color: DARK_CARD },
    rectRadius: 0.1
  });

  // Number
  slide10.addText(stat.number, {
    x: x, y: y + 0.2, w: 3.5, h: 1,
    fontSize: 36, fontFace: 'Arial',
    color: ACCENT, bold: true, align: 'center'
  });

  // Label
  slide10.addText(stat.label, {
    x: x, y: y + 1.2, w: 3.5, h: 0.6,
    fontSize: 16, fontFace: 'Arial',
    color: GRAY, align: 'center'
  });
});

// ─── Slide 11: Revenue Model ───
addContentSlide('Revenue Model', [
  '5% transaction fee (min $1) on all marketplace sales',
  '$6 flat shipping fee per order',
  'Future: Premium subscription tiers for power collectors',
  'Future: Promoted listings for sellers',
  'Future: Vinyl Buddy hardware sales'
]);

// ─── Slide 12: Deployment ───
addContentSlide('Deployment', [
  'GitHub auto-deploy pipeline for continuous delivery',
  'Vercel for frontend hosting with global CDN',
  'Railway for backend + PostgreSQL database',
  'Stripe for secure payment processing',
  'Production URL: groovestack.vercel.app'
]);

// ─── Slide 13: What's Next ───
addContentSlide("What's Next", [
  'Mobile app (React Native) for iOS and Android',
  'Real-time notifications via WebSockets',
  'Vinyl Buddy v2 with WiFi + Bluetooth connectivity',
  'Social features: stories, live listening sessions',
  'AI-powered recommendations engine',
  'International shipping support'
]);

// ─── Slide 14: Thank You ───
const slide14 = pptx.addSlide();
slide14.background = { color: BG };

slide14.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

slide14.addText('GrooveStack', {
  x: 0.8, y: 1.5, w: 11.5, h: 1.2,
  fontSize: 56, fontFace: 'Arial',
  color: WHITE, bold: true, align: 'center'
});

slide14.addText('Where Vinyl Lives', {
  x: 0.8, y: 2.7, w: 11.5, h: 0.8,
  fontSize: 28, fontFace: 'Arial',
  color: ACCENT, align: 'center'
});

slide14.addText([
  { text: 'groovestack.vercel.app', options: { fontSize: 18, color: WHITE } },
  { text: '\n' },
  { text: 'github.com/colelevy08/groovestack', options: { fontSize: 16, color: GRAY } }
], {
  x: 0.8, y: 4.0, w: 11.5, h: 1.2,
  fontFace: 'Arial', align: 'center',
  lineSpacingMultiple: 1.5
});

slide14.addText('Built with \u2764\uFE0F and AI', {
  x: 0.8, y: 5.8, w: 11.5, h: 0.6,
  fontSize: 14, fontFace: 'Arial',
  color: GRAY, align: 'center'
});

slide14.addShape(pptx.ShapeType.rect, {
  x: 0, y: 7.44, w: 13.33, h: 0.06, fill: { color: ACCENT }
});

// Generate the file
const outputPath = '/Users/colelevy/Development/groovestack/GrooveStack_Overview.pptx';
pptx.writeFile({ fileName: outputPath })
  .then(() => console.log(`Presentation saved to: ${outputPath}`))
  .catch(err => console.error('Error:', err));
