# GrooveStack

**The social marketplace for vinyl record collectors.**

GrooveStack is a full-stack web application where collectors buy, sell, trade, and discover vinyl records within an active community. It combines a Discogs-powered marketplace, a social feed, deep collection analytics, and a custom ESP32 hardware device (Vinyl Buddy) that identifies records playing on your turntable in real time.

Built across nine development waves, the platform includes 1,100+ improvements, 170+ API endpoints, 35+ database tables, and supports 41 active users.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Vinyl Buddy Hardware](#vinyl-buddy-hardware)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

---

## Features

### Marketplace

- **Browse and search** listings with full-text search across records, users, and posts
- **Discogs-powered pricing** with real-time market value lookups and price history tracking
- **Stripe Checkout** integration with a 5% platform fee and webhook-driven order confirmation
- **Offers and negotiations** — send cash, trade, or combo offers with counter-offer support and full negotiation history
- **Escrow holds** — funds held in escrow until buyer confirms receipt; supports release and refund flows
- **Disputes** — file and resolve disputes on transactions with admin review
- **Promo codes and referrals** — create and validate promotional codes; referral tracking with credit system
- **Shipping rate calculator** with address validation and tax estimation
- **Bulk price updates** for sellers managing large inventories
- **Fee calculator** so sellers can preview net proceeds before listing
- **Order management** — purchase history, order tracking, and cancellation with reason logging
- **AI condition grading** via Claude vision analysis of uploaded record photos
- **Condition verification log** — community-verified condition reports with timestamped history
- **Provenance tracking** — document ownership history and pressing details for high-value records
- **Authenticity queue** — submit records for authenticity review; admin verification workflow
- **Catalog number generation** for standardized record identification
- **Price suggestion engine** based on condition, pressing, and comparable sales
- **Record comparison** — side-by-side comparison of multiple listings
- **Availability checking** with real-time stock status
- **RSS feed** for new listings (`/api/feed/new-listings.rss`)

### Social

- **Social feed** with posts, record tags, likes, bookmarks, and comments
- **Create posts** with text, record references, and image attachments
- **Comments** on both records and posts with threaded replies
- **Follow system** — follow other collectors, view follower/following lists
- **Activity feed** filtered by followed users
- **Artist profile pages** with Wikipedia-sourced bios and discography
- **Content bookmarking** for saving posts to read later
- **Trending content** — algorithmically surfaced popular records and posts
- **Recommendations** — personalized record suggestions based on collection and activity
- **User search** with profile previews
- **Blocking and reporting** — block users and flag content for moderation review

### Collection Management

- **Full CRUD** for vinyl records with rich metadata (artist, album, year, genre, condition, pressing details, notes)
- **Collection statistics** — total value, genre distribution, condition breakdown, decade spread, average price
- **Duplicate detection** before adding records to prevent accidental duplicates
- **Bulk import** from CSV or JSON files
- **Discogs import** — pull your existing Discogs collection directly into GrooveStack
- **Collection sharing** — generate shareable links with unique tokens for public viewing
- **Collection merging** — combine and compare collections across accounts
- **Export** — download collection data for backup or migration
- **Record views tracking** with view counts and analytics
- **Record image upload** support
- **Condition change history** — full audit trail when a record's condition is updated

### Analytics

- **Dashboard** with collection value over time, genre distribution, condition breakdown, and monthly spending
- **Pure SVG charts** — line charts, bar charts, donut charts, and heatmaps with no external charting library
- **Time range filtering** — view analytics across all time, 12 months, 6 months, 3 months, or 30 days
- **Seller analytics** — revenue, average sale price, top-selling records, and buyer demographics
- **Buyer analytics** — spending trends, purchase frequency, average order value, and category breakdown
- **Top sellers and top records** leaderboards
- **Genre distribution** across the platform
- **Price trends** over time
- **Activity metrics** — platform-wide engagement statistics
- **Most valuable records** and top artists in your collection
- **Price paid vs. market value** comparisons

### Vinyl Buddy

- **ESP32 hardware device** that captures 2-second audio samples from your turntable
- **Audio fingerprinting** via AudD API — automatically identifies the track playing
- **Listening history** with timestamped session logs
- **Listening statistics** — total sessions, unique tracks, favorite artists, genre breakdown
- **Device pairing** with 12-character activation codes displayed on the OLED screen
- **Multi-device support** — pair and manage multiple Vinyl Buddy units
- **Device calibration** for optimal audio capture
- **Firmware update checking** with version management
- **Heartbeat monitoring** — device health status and connectivity tracking
- **Achievement system** — earn badges for listening milestones
- **Streaks** — track consecutive days of vinyl listening
- **Mood detection** — music mood tagging based on listening patterns
- **Now Playing** display with equalizer visualization
- **Overview, History, Stats, and Device** tabs in a dedicated dashboard

### User Profiles

- **Custom avatars and header images** with accent color theming
- **Bio, location, and social links**
- **Profile completion indicator** with actionable tips
- **Member tiers** — Bronze, Silver, Gold, and Platinum based on activity score
- **Reputation system** with numeric scores derived from transaction history
- **Verification levels** — tiered identity verification (email, phone, ID, address)
- **QR code generation** for easy profile sharing
- **Profile views counter**
- **Featured records** showcase
- **Activity heatmap** showing engagement over time
- **Collection value trend** line on profile
- **Top Collector badge** for high-ranking users
- **Six profile tabs**: Posts, Listening, Records, For Sale, Saved, Wishlist
- **Public user profile pages** with records, stats, and reputation visible to others

### Messaging

- **Direct messages** between users with real-time conversation threads
- **Conversation sidebar** with search, unread badges, and online status indicators
- **Message reactions** and pinned messages
- **Attachment support** — images, audio files, and documents
- **Read receipts** and typing indicators
- **Conversation archiving** for inbox management
- **Scheduled messages** — compose now, send later
- **Dedicated Messages screen** with full conversation management

### Wishlist

- **Priority levels** — High, Medium, Low with color-coded indicators
- **Price alerts** — set target prices and get notified when listings match
- **Matching listings** — automatic detection when marketplace listings match wishlist items
- **Discogs import** — pull your Discogs wantlist into GrooveStack
- **Wishlist sharing** with public links
- **Sorting and filtering** — by date, priority, price, or artist
- **Genre and decade filters** for narrowing down wants
- **Price range preferences** per item

### Notifications

- **Categorized notifications** — offers, messages, follows, likes, price alerts, system announcements
- **Inline actions** — accept/decline offers, reply to messages directly from notifications
- **Mark as read** individually or mark all as read
- **Email notification triggers** for critical events
- **Unread count badges** in the navigation
- **Notification preferences** — granular control over which categories generate alerts

### Settings

- **Appearance** — dark mode (default), accent color selection from 8 options, font size adjustment
- **Language** — i18n-ready with support for 8 languages (English, Spanish, French, German, Japanese, Portuguese, Korean, Italian)
- **Keyboard shortcuts** — customizable shortcuts for search, new post, navigation, messages, and settings
- **Connected accounts** — link Discogs, Spotify, Last.fm, and Apple Music
- **Shipping addresses** — manage saved addresses for marketplace purchases
- **Privacy controls** — profile visibility, search indexing, data sharing preferences
- **Notification preferences** — toggle alerts by category
- **Activity log** — view recent account activity with device, IP, and timestamp
- **Account management** — change password, deactivate account, or permanently delete with data purge
- **GDPR data export** — download all personal data in a structured format
- **Session management** — view and revoke active sessions

### Security

- **JWT authentication** with bcrypt password hashing
- **Two-factor authentication (TOTP)** — setup and verification with authenticator app support
- **CSRF token generation** for form protection
- **Rate limiting** — 100 requests/minute general, 10 requests/minute for auth endpoints
- **Email verification** with token-based confirmation flow
- **Password reset** with secure token generation and expiry
- **User blocking** at the application level
- **Content moderation queue** with reporting and admin review
- **Request ID tracing** — every request tagged with a unique ID for debugging
- **Input validation** and SQL injection prevention
- **CORS** configuration with allowed origin management
- **Request body size limits** — 10 MB for JSON, 1 MB for URL-encoded

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Tailwind CSS 3.4, Create React App |
| **Backend** | Express.js 5, Node.js 18+ |
| **Database** | PostgreSQL (35+ tables, auto-migration on startup) |
| **Payments** | Stripe Checkout Sessions with webhook verification |
| **AI** | Claude Opus 4.6 (record verification and condition grading) |
| **Audio ID** | AudD API (audio fingerprinting for Vinyl Buddy) |
| **Pricing** | Discogs API (market value lookups) |
| **Album Art** | iTunes Search API |
| **Artist Info** | Wikipedia API |
| **Auth** | JWT + bcrypt + TOTP |
| **Deployment** | Vercel (frontend), Railway (backend + PostgreSQL) |
| **Hardware** | ESP32-DevKitC V4 with INMP441 MEMS microphone and SSD1306 OLED |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or use Railway for a hosted database)

### Installation

```bash
git clone https://github.com/colelevy08/groovestack.git
cd groovestack
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for JWT token signing |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for payment processing |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude AI verification |
| `AUDD_API_TOKEN` | Yes | AudD API token for Vinyl Buddy audio identification |
| `REACT_APP_API_URL` | No | Backend URL (leave empty for local development) |
| `FRONTEND_URL` | No | Frontend URL (set in Railway for CORS configuration) |
| `DISCOGS_TOKEN` | No | Discogs personal access token (increases rate limit) |

When no `DATABASE_URL` is set, the server runs in **in-memory fallback mode** for local testing without a database.

### Running Locally

```bash
# Start both frontend and backend concurrently
npm run dev

# Frontend only (port 3000)
npm start

# Backend only (port 3001)
npm run server
```

### Production Build

```bash
npm run build
```

The frontend proxies API requests to `localhost:3001` during development via the `proxy` field in `package.json`.

---

## API Reference

The server exposes 170+ RESTful endpoints organized into the following groups. Full documentation is available at `GET /api/docs` and an OpenAPI spec at `GET /api/openapi.json`.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create a new account |
| POST | `/api/auth/login` | Authenticate and receive JWT |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/profile` | Update profile fields |
| PUT | `/api/auth/username` | Change username |
| GET | `/api/auth/check-username/:username` | Check username availability |
| PUT | `/api/auth/change-password` | Change password |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/request-password-reset` | Generate reset token |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/email-verification` | Send verification email |
| POST | `/api/auth/verify-email` | Confirm email with token |
| POST | `/api/auth/totp/setup` | Initialize 2FA TOTP |
| POST | `/api/auth/totp/verify` | Verify and enable 2FA |
| GET | `/api/auth/sessions` | List active sessions |
| DELETE | `/api/auth/sessions` | Revoke all sessions |
| GET | `/api/auth/export` | GDPR data export |
| POST | `/api/auth/deactivate` | Deactivate account |
| DELETE | `/api/auth/delete-account` | Permanently delete account |

### Records

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/records` | Create a listing |
| GET | `/api/records` | List records with pagination and filters |
| GET | `/api/records/search` | Full-text search |
| GET | `/api/records/:id` | Get record details |
| PUT | `/api/records/:id` | Update a listing |
| DELETE | `/api/records/:id` | Remove a listing |
| POST | `/api/records/:id/like` | Like / unlike a record |
| POST | `/api/records/:id/save` | Save / unsave a record |
| POST | `/api/records/:id/view` | Log a view |
| GET | `/api/records/:id/views` | Get view count |
| GET | `/api/records/:id/price-history` | Price history |
| GET | `/api/records/:id/price-suggestion` | AI price suggestion |
| GET | `/api/records/:id/availability` | Stock status |
| GET | `/api/records/:id/condition-history` | Condition change log |
| POST | `/api/records/:id/authenticity` | Submit for authenticity review |
| POST | `/api/records/:id/image` | Upload record image |
| POST | `/api/records/import` | Bulk import from CSV/JSON |
| POST | `/api/records/import-discogs` | Import from Discogs |
| POST | `/api/records/ai-grade` | AI condition grading |
| GET | `/api/records/compare` | Compare multiple records |
| GET | `/api/records/duplicates/check` | Duplicate detection |
| PUT | `/api/records/bulk-price` | Bulk price update |

### Marketplace

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/checkout/create-session` | Create Stripe checkout session |
| GET | `/api/checkout/fee` | Get platform fee percentage |
| POST | `/api/offers` | Send an offer |
| GET | `/api/offers` | List offers (sent and received) |
| PUT | `/api/offers/:id/accept` | Accept an offer |
| PUT | `/api/offers/:id/decline` | Decline an offer |
| POST | `/api/offers/:id/counter` | Counter-offer |
| GET | `/api/offers/:id/history` | Negotiation history |
| GET | `/api/orders` | List orders |
| POST | `/api/orders/:id/cancel` | Cancel an order |
| POST | `/api/escrow` | Create escrow hold |
| PUT | `/api/escrow/:id/release` | Release escrow funds |
| PUT | `/api/escrow/:id/refund` | Refund escrow |
| GET | `/api/escrow` | List escrow holds |
| POST | `/api/disputes` | File a dispute |
| GET | `/api/disputes` | List disputes |
| PUT | `/api/disputes/:id/resolve` | Resolve a dispute |

### Social

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/posts` | Create a post |
| GET | `/api/posts` | List posts |
| POST | `/api/posts/:id/like` | Like / unlike a post |
| POST | `/api/posts/:id/bookmark` | Bookmark / unbookmark |
| POST | `/api/comments` | Add a comment |
| GET | `/api/comments/:recordId` | Comments on a record |
| GET | `/api/comments/post/:postId` | Comments on a post |
| POST | `/api/follows` | Follow a user |
| DELETE | `/api/follows/:username` | Unfollow a user |
| GET | `/api/follows/:username` | Get follower/following lists |
| GET | `/api/feed` | Activity feed |

### Vinyl Buddy

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/vinyl-buddy/identify` | Submit audio for identification |
| POST | `/api/vinyl-buddy/heartbeat` | Device heartbeat |
| POST | `/api/vinyl-buddy/pair` | Pair a new device |
| DELETE | `/api/vinyl-buddy/unpair/:deviceId` | Unpair a device |
| POST | `/api/vinyl-buddy/calibrate` | Calibrate audio capture |
| GET | `/api/vinyl-buddy/calibration/:deviceId` | Get calibration data |
| POST | `/api/vinyl-buddy/firmware-check` | Check for firmware updates |
| GET | `/api/vinyl-buddy/history/:username` | Listening history |
| GET | `/api/vinyl-buddy/stats/:username` | Listening statistics |
| GET | `/api/vinyl-buddy/devices/:username` | List paired devices |
| GET | `/api/vinyl-buddy/recent/:username` | Recent identifications |
| GET | `/api/vinyl-buddy/debug/last-identify` | Debug last identification |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/analytics/top-sellers` | Top sellers leaderboard |
| GET | `/api/analytics/top-records` | Most popular records |
| GET | `/api/analytics/genre-distribution` | Genre breakdown |
| GET | `/api/analytics/price-trends` | Price trends over time |
| GET | `/api/analytics/activity` | Platform activity metrics |
| GET | `/api/analytics/seller` | Seller-specific analytics |
| GET | `/api/analytics/buyer` | Buyer-specific analytics |
| GET | `/api/collection/stats` | Collection statistics |
| GET | `/api/dashboard/stats` | Dashboard summary |

### Utility

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/health/detailed` | Detailed health with DB, Stripe, and memory stats |
| GET | `/api/prices/lookup` | Discogs price lookup |
| GET | `/api/search` | Universal search (records, users, posts) |
| GET | `/api/search/suggestions` | Search autocomplete |
| GET | `/api/trending` | Trending content |
| GET | `/api/recommendations` | Personalized recommendations |
| GET | `/api/stats` | Platform-wide statistics |
| POST | `/api/batch` | Batch multiple API calls |
| GET | `/api/sitemap` | XML sitemap |
| GET | `/api/feed/new-listings.rss` | RSS feed |
| GET | `/api/openapi.json` | OpenAPI specification |
| GET | `/api/docs` | API documentation |
| GET | `/api/changelog` | API changelog |
| GET | `/api/csrf-token` | CSRF token |

---

## Architecture

### Project Structure

```
groovestack/
├── server.js                          # Express API server (5,900+ lines)
├── package.json                       # Dependencies and scripts
├── tailwind.config.js                 # Tailwind configuration
├── Procfile                           # Railway deployment config
├── firmware/                          # ESP32 Vinyl Buddy firmware
├── scripts/
│   └── generate-deck.js               # Pitch deck generator
├── public/                            # Static assets
└── src/
    ├── App.js                         # Root component — all shared state
    ├── constants/
    │   ├── index.js                   # User profiles, genres, accent colors
    │   ├── records.js                 # Seed record data
    │   ├── posts.js                   # Seed post data
    │   └── listening.js               # Seed listening history
    ├── utils/
    │   ├── supabase.js                # Auth helpers (getToken, getMe, signOut)
    │   ├── api.js                     # API base URL configuration
    │   └── helpers.js                 # Shared utility functions
    └── components/
        ├── AuthScreen.jsx             # Login / signup flow
        ├── Sidebar.jsx                # Desktop sidebar + mobile bottom nav
        ├── Card.jsx                   # Record card component
        ├── Paginated.jsx              # Pagination wrapper
        ├── UserChip.jsx               # Inline user reference
        ├── UserLink.jsx               # Clickable user link
        ├── screens/
        │   ├── ExploreScreen.jsx      # Marketplace browsing
        │   ├── SocialFeedScreen.jsx   # Social feed with posts
        │   ├── CollectionScreen.jsx   # Collection management
        │   ├── ProfileScreen.jsx      # Current user profile
        │   ├── UserProfilePage.jsx    # Public user profiles
        │   ├── FollowingScreen.jsx    # Following feed
        │   ├── TransactionsScreen.jsx # Orders, offers, cart
        │   ├── VinylBuddyScreen.jsx   # Vinyl Buddy dashboard
        │   ├── AnalyticsScreen.jsx    # Collection analytics
        │   ├── MessagesScreen.jsx     # Direct messages
        │   ├── WishlistScreen.jsx     # Wishlist management
        │   └── SettingsScreen.jsx     # App settings
        ├── modals/
        │   ├── AddRecordModal.jsx     # Add / edit record form
        │   ├── DetailModal.jsx        # Record detail view
        │   ├── BuyModal.jsx           # Purchase flow
        │   ├── OfferModal.jsx         # Send offer
        │   ├── CommentsModal.jsx      # Comments thread
        │   ├── CreatePostModal.jsx    # New post composer
        │   ├── DMModal.jsx            # Quick DM overlay
        │   ├── ProfileEditModal.jsx   # Edit profile
        │   ├── UserProfileModal.jsx   # View other user profile
        │   ├── ArtistProfileModal.jsx # Artist info page
        │   ├── VerifyRecordModal.jsx  # AI verification
        │   └── NotificationsPanel.jsx # Notification center
        └── ui/
            ├── AlbumArt.jsx           # Album artwork display
            ├── Avatar.jsx             # User avatar
            ├── Badge.jsx              # Status badges
            ├── CommandPalette.jsx     # Cmd+K search palette
            ├── Confetti.jsx           # Celebration animation
            ├── DataSyncIndicator.jsx  # Sync status indicator
            ├── Empty.jsx              # Empty state illustrations
            ├── ErrorBoundary.jsx      # React error boundary
            ├── FormInput.jsx          # Styled input field
            ├── FormSelect.jsx         # Styled select dropdown
            ├── FormTextarea.jsx       # Styled textarea
            ├── ImageLightbox.jsx      # Full-screen image viewer
            ├── KeyboardShortcutsHelp.jsx # Shortcut reference overlay
            ├── Modal.jsx              # Base modal component
            ├── OfflineBanner.jsx      # Offline status bar
            ├── OfflineFallback.jsx    # Offline fallback content
            ├── OnboardingTour.jsx     # First-run guided tour
            ├── ScrollToTop.jsx        # Scroll-to-top button
            ├── SearchBar.jsx          # Global search input
            ├── SkipToContent.jsx      # Accessibility skip link
            ├── Stars.jsx              # Star rating display
            ├── SwipeHandler.jsx       # Mobile swipe gestures
            ├── Toast.jsx              # Toast notifications
            ├── Toggle.jsx             # Toggle switch
            └── VinylDisc.jsx          # Spinning vinyl animation
```

### Frontend Architecture

- **Single-page application** with all shared state managed in `App.js`
- **Screen-based navigation** — `nav` state determines which screen renders (no client-side router)
- **Modal system** for overlays (record details, offers, messaging, profiles)
- **Lazy-loaded screens** via `React.lazy` and `Suspense` for faster initial load
- **localStorage persistence** for user data, records, following lists, and DM history
- **Responsive layout** — desktop sidebar navigation + mobile bottom tab bar
- **Undo/redo system** with a 30-step history stack
- **Command palette** (Cmd+K) for quick search and navigation
- **Swipe gestures** for mobile navigation
- **Onboarding tour** for new users
- **i18n preparation** with translation key structure for 8 languages

### Backend Architecture

- **Express.js 5** REST API with JWT authentication
- **PostgreSQL** with 35+ tables and an 8-version migration system that auto-applies on startup
- **In-memory rate limiting** — configurable per-bucket with sliding windows
- **Stripe webhook handling** for payment confirmation
- **API response envelope** — standardized `{ data, meta, error }` format with request IDs
- **Request tracing** — every response includes an `X-Request-Id` header
- **Graceful shutdown** — drains active connections, stops schedulers, closes DB pool
- **In-memory fallback** when no database is configured (for local development)
- **Database backup scheduling** with configurable intervals

### Database Tables

The database contains 35+ tables organized by domain:

**Core:** `profiles`, `records`, `schema_migrations`

**Social:** `posts`, `comments`, `follows`, `post_likes`, `post_bookmarks`, `record_likes`, `record_saves`

**Marketplace:** `offers`, `offer_negotiations`, `purchases`, `order_cancellations`, `escrow_holds`, `disputes`, `promo_codes`, `referrals`

**Messaging:** `messages`, `notifications`

**Collection:** `wishlist`, `price_history`, `price_alerts`, `record_views`, `condition_verification_log`, `condition_change_history`, `collection_shares`, `record_provenance`, `authenticity_queue`

**Vinyl Buddy:** `vinyl_sessions`, `vinyl_devices`

**Account:** `user_preferences`, `user_verification`, `user_blocks`, `activity_log`, `api_keys`, `webhooks`, `moderation_queue`

---

## Vinyl Buddy Hardware

The Vinyl Buddy is an ESP32-based device that sits near your turntable and automatically identifies the record you are playing.

### How It Works

1. The INMP441 MEMS microphone captures a 2-second audio sample from the room
2. The ESP32 sends raw PCM audio data to the GrooveStack server over Wi-Fi
3. The server converts the PCM data to WAV format and queries the AudD API for fingerprint matching
4. The identified track, artist, and album appear in your listening history on GrooveStack
5. The SSD1306 OLED screen displays the device code, connection status, and currently identified track

### Components

| Part | Purpose |
|---|---|
| ESP32-DevKitC V4 | Main microcontroller with Wi-Fi |
| INMP441 MEMS Microphone | I2S digital audio capture |
| SSD1306 OLED Display (128x64) | Device status and track info |
| Micro-USB cable | Power and firmware flashing |

### Wiring

The INMP441 connects to the ESP32 via the I2S bus:

- **SCK** (Serial Clock) to GPIO 26
- **WS** (Word Select) to GPIO 25
- **SD** (Serial Data) to GPIO 33
- **VDD** to 3.3V
- **GND** to GND
- **L/R** to GND (left channel select)

The SSD1306 OLED connects via I2C on the default SDA/SCL pins (GPIO 21 / GPIO 22).

### Setup

1. Flash the firmware from the `firmware/` directory to the ESP32
2. Power on the device — it will display a 12-character device code on the OLED
3. In GrooveStack, navigate to the Vinyl Buddy tab and enter the device code to pair
4. The device sends heartbeats every 30 seconds to confirm connectivity
5. Place the device near your turntable speaker and start playing a record

### Features

- **Auto-identification** — continuously listens and identifies tracks
- **Calibration mode** — adjust sensitivity for your room acoustics
- **Firmware updates** — check for and apply OTA updates from the app
- **Multi-device** — pair up to 4 Vinyl Buddy units per account
- **Health monitoring** — heartbeat status and signal quality indicators

---

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set the build command to `npm run build` and output directory to `build`
3. Add the environment variable `REACT_APP_API_URL` pointing to your Railway backend URL
4. Push to `main` to trigger auto-deploy

### Backend (Railway)

1. Create a new Railway project from your GitHub repository
2. Add a PostgreSQL database service — Railway auto-injects `DATABASE_URL` and `PORT`
3. Set the remaining environment variables (`JWT_SECRET`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `AUDD_API_TOKEN`, `FRONTEND_URL`)
4. The `Procfile` configures Railway to run `node server.js`
5. Push to `main` to trigger auto-deploy

### Post-Deploy Checklist

- Verify `GET /api/health/detailed` returns healthy status for all services
- Configure the Stripe webhook endpoint to `https://your-backend.railway.app/api/webhook`
- Set `FRONTEND_URL` in Railway to your Vercel domain for CORS
- Confirm database migrations applied by checking `GET /api/admin/migrations`

---

## Troubleshooting

### Common Issues

**Port 3001 already in use**

Another process is using the backend port. Find and kill it:

```bash
lsof -ti:3001 | xargs kill -9
npm run server
```

**Database connection refused**

- Verify `DATABASE_URL` is set correctly in your `.env` file
- Ensure PostgreSQL is running: `pg_isready`
- If using Railway, check that the database service is active and the connection string is current
- The server falls back to in-memory mode if no database is configured, so missing `DATABASE_URL` will not crash the server but data will not persist

**Migrations fail on startup**

- Check `GET /api/admin/migrations` to see which migrations have been applied
- Ensure the database user has `CREATE TABLE` and `ALTER TABLE` permissions
- If a migration is partially applied, check the `schema_migrations` table and manually resolve the state
- Delete and recreate the database as a last resort: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`

**Stripe webhooks not received**

- Verify the webhook endpoint URL is correct: `https://your-backend.railway.app/api/webhook`
- Check that `STRIPE_SECRET_KEY` matches the key for the same Stripe account as the webhook
- In development, use the Stripe CLI to forward events: `stripe listen --forward-to localhost:3001/api/webhook`
- Confirm the webhook is configured to send `checkout.session.completed` events

**Vinyl Buddy device not pairing**

- Ensure the device is powered on and displaying a 12-character code on the OLED screen
- Check that the device is connected to the same Wi-Fi network that has internet access
- Verify the backend URL in the firmware matches your GrooveStack server
- Try power-cycling the device and waiting 30 seconds for the code to regenerate

**Frontend shows blank screen**

- Open browser DevTools (F12) and check the Console tab for errors
- Clear localStorage: `localStorage.clear()` in the console, then refresh
- Ensure `REACT_APP_API_URL` is set correctly if the backend is not on `localhost:3001`
- Run `npm run build` to check for build errors

**CORS errors in the browser**

- Set `FRONTEND_URL` in your backend environment to your frontend's URL (e.g., `https://your-app.vercel.app`)
- In development, the `proxy` field in `package.json` handles CORS automatically
- Ensure the frontend and backend are not on different ports without the proxy configured

**Discogs API rate limited**

- The Discogs API allows 60 requests per minute for authenticated requests (with `DISCOGS_TOKEN`) and 25 for unauthenticated
- Add a `DISCOGS_TOKEN` to your environment variables to increase the rate limit
- Price lookups are cached to reduce API calls

**AI grading returns errors**

- Verify `ANTHROPIC_API_KEY` is set and valid
- Image files must be under 10 MB in JPG or PNG format
- The AI grading endpoint requires an active internet connection to reach the Claude API

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and ensure they follow the existing code style
4. Test locally with `npm run dev`
5. Commit with a descriptive message
6. Push to your fork and open a pull request against `main`

### Code Style

- Frontend components are functional React with hooks
- One component per file, named to match the export
- Tailwind CSS for all styling — no external CSS files beyond `App.css` and `index.css`
- Backend endpoints follow RESTful conventions with the `/api/` prefix
- All API responses use the standardized envelope format

### Reporting Issues

Open a GitHub issue with a clear description, steps to reproduce, and expected vs. actual behavior.

---

## Changelog

### Wave 9 (March 2025)

- Added marketplace tips constant with 20 tips for buyers and sellers
- Added comprehensive vinyl care guide with 10 detailed care instructions
- Added detailed Goldmine grading guide with examples, buyer tips, and price multipliers
- Added keyboard shortcuts reference constant with navigation, action, and browsing shortcuts
- Added app configuration constant with feature flags, limits, and defaults
- Added social proof constant with testimonials, platform stats, and milestones
- Added contextual onboarding tips for every major screen in the app
- Added user-friendly error messages for all error categories (network, auth, marketplace, social, Vinyl Buddy)
- Expanded record catalog with 20 new records covering classical, world, reggae, and blues
- Added catalog number, weight, and pressing type fields to records
- Added previous price field to records for price change indicators
- Expanded social feed to 100 posts with reaction counts and view counts
- Added side (A/B) and RPM (33/45/78) fields to all listening sessions
- Added troubleshooting section to documentation

### Wave 8 (January 2025)

- Escrow and dispute system for full transaction protection
- Condition verification log with community-verified reports
- Provenance tracking for high-value records
- Authenticity review queue with admin verification workflow
- Advanced seller and buyer analytics dashboards
- Collection merging and comparison across accounts
- Scheduled messages for compose-now-send-later messaging
- Conversation archiving for inbox management

### Wave 7 (November 2024)

- Country of pressing origins with 18 countries
- Decade themes with visual styling for 1950s through 2020s
- Community badges system (trade, listening, social, curation categories)
- Seasonal events calendar (Record Store Day, Jazz Day, etc.)
- Vinyl labels database with 18 major labels
- Record format specifications with RPM and diameter data
- Turntable brands reference with 10 manufacturers
- FAQ database with 20 categorized questions and answers
- Expanded record catalog to 200+ records across all genres

### Wave 6 (September 2024)

- AI condition grading via Claude vision analysis
- Marketplace aggregate statistics
- Onboarding walkthrough steps
- Order lifecycle messages
- Marketplace browse categories
- Vinyl weight classes and pressing type classifications

### Wave 5 (July 2024)

- Social feed with posts, reviews, and photo sharing
- Comments on records and posts with threaded replies
- Follow system with activity feed
- Content bookmarking
- Trending content algorithm
- Personalized recommendations engine

### Wave 4 (May 2024)

- Vinyl Buddy ESP32 hardware integration
- Audio fingerprinting via AudD API
- Listening history and statistics
- Device pairing with activation codes
- Achievement system and listening streaks
- Now Playing display with equalizer visualization

### Wave 3 (March 2024)

- Direct messaging with real-time conversations
- Wishlist with priority levels and price alerts
- Notification system with categorized alerts
- Email notification triggers
- Stripe Checkout integration with webhook verification

### Wave 2 (January 2024)

- Marketplace with offers, counter-offers, and negotiation history
- Discogs-powered pricing with market value lookups
- Shipping rate calculator with address validation
- Collection statistics and analytics dashboard
- Pure SVG charts (line, bar, donut, heatmap)
- Dark mode and accent color theming

### Wave 1 (November 2023)

- Initial launch with collection management
- Full CRUD for vinyl records with rich metadata
- JWT authentication with bcrypt password hashing
- Record search with full-text search
- User profiles with avatars and bios
- Responsive layout with desktop sidebar and mobile bottom nav

---

## License

MIT
