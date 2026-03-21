# GrooveStack

**The social marketplace for vinyl record collectors.**

GrooveStack is a full-stack web application where collectors buy, sell, trade, and discover vinyl records within an active community. It combines a Discogs-powered marketplace, a social feed, deep collection analytics, and a custom ESP32 hardware device (Vinyl Buddy) that identifies records playing on your turntable in real time.

Built across twenty-eight development waves, the platform includes 1,900+ improvements, 290+ API endpoints, 35+ database tables, and supports 51 active users with 100+ seed records.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Architecture](#architecture)
- [Performance Optimizations](#performance-optimizations)
- [Security Features](#security-features)
- [Accessibility Features](#accessibility-features)
- [Vinyl Buddy Hardware](#vinyl-buddy-hardware)
- [Vinyl Buddy Build Guide](#vinyl-buddy-build-guide)
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
- **Auctions** — timed auction listings with minimum bids, reserve prices, real-time bid tracking, auto-close with winner notification, and sniping protection with time extension
- **Escrow holds** — funds held in escrow until buyer confirms receipt; supports release and refund flows
- **Disputes** — file and resolve disputes on transactions with admin review
- **Featured listings** — promoted listing placements for increased visibility
- **Promo codes and referrals** — create and validate promotional codes; referral tracking with credit system
- **Loyalty points** — earn points on purchases, redeemable for listing credits and discounts
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
- **Stories** — ephemeral 24-hour stories with photo and text formats, story ring indicators, view counts, tap-through navigation, and profile highlights
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
- **Virtual scrolling** for collections with 1,000+ records, rendering only visible items for 60fps performance
- **Card flip animations** — 3D CSS card flip for quick record previews (front: art/price, back: condition/actions)
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
- **Taste evolution** — track how your genre preferences change over time
- **Mood detection** — music mood tagging based on listening patterns

### Vinyl Buddy

- **ESP32 hardware device** that captures 2-second audio samples from your turntable
- **Audio fingerprinting** via AudD API — automatically identifies the track playing
- **BLE (Bluetooth Low Energy)** pairing and configuration mode
- **OLED display** (SSD1306 128x64) — shows device code, connection status, track info, and animations
- **SD card slot** for offline session caching when WiFi is unavailable
- **APDS-9960 gesture sensor** — wave to skip, swipe to control playback
- **Active noise cancellation** for cleaner audio capture in noisy environments
- **Auto-gain control** for adapting to varying room volumes
- **ESP-NOW mesh networking** — peer-to-peer communication between devices for multi-room sync
- **MQTT support** — publish telemetry and subscribe to commands via an MQTT broker
- **FFT peak detection** — real-time frequency analysis with dominant peak identification
- **Battery fuel gauge** — coulomb-counting battery level estimation for accurate charge reporting
- **Capacitive touch sensors** — touch-based controls for play/pause, skip, and volume
- **WS2812 LED strip** — NeoPixel-compatible LED strip for ambient visualizations and status feedback
- **Accelerometer (MPU6050)** — motion detection, orientation tracking, and tap-to-wake
- **Real-time clock (DS3231)** — accurate timestamping independent of network time
- **Audio AGC (automatic gain control)** — real-time gain adjustment based on signal envelope
- **Spectral centroid calculation** — brightness metric for audio analysis and genre estimation
- **Zero-crossing rate (ZCR)** — time-domain audio feature for percussiveness detection
- **Firmware rollback** — automatic rollback to the previous firmware version on boot failure
- **Power-on self-test (POST)** — hardware validation at startup covering I2S, WiFi, I2C, SPI, ADC, and GPIO
- **Buzzer / haptic feedback** — audible and tactile feedback for user interactions
- **Ambient light sensor** — auto-brightness control for the OLED display based on room lighting
- **SPIFFS web interface** — local configuration and diagnostics served from on-device flash storage
- **Listening history** with timestamped session logs
- **Listening statistics** — total sessions, unique tracks, favorite artists, genre breakdown
- **Device pairing** with 12-character activation codes displayed on the OLED screen
- **Multi-device support** — pair and manage up to 4 Vinyl Buddy units
- **Device calibration** for optimal audio capture
- **Firmware update checking** with OTA update support
- **Heartbeat monitoring** — device health status and connectivity tracking every 30 seconds
- **Achievement system** — earn badges for listening milestones (First Spin, Century Club, etc.)
- **Streaks** — track consecutive days of vinyl listening
- **Mood detection** — music mood tagging based on listening patterns
- **Now Playing** display with equalizer visualization
- **Side A/B and RPM tracking** (33/45/78) per session
- **Overview, History, Stats, and Device** tabs in a dedicated dashboard
- **Deep sleep mode** for power conservation
- **LED status indicators** for WiFi, BLE, and listening state

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
- **Drawer modal interface** for quick DM access
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
- **Push notification support** via service workers
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
| **Auth** | JWT + bcrypt + TOTP 2FA |
| **Deployment** | Vercel (frontend), Railway (backend + PostgreSQL) |
| **Hardware** | ESP32-DevKitC V4 with INMP441 mic, SSD1306 OLED, SD card, APDS-9960 gesture sensor |
| **Mesh Network** | ESP-NOW peer-to-peer protocol |

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

The server exposes 290+ RESTful endpoints organized into the following groups. Full documentation is available at `GET /api/docs` and an OpenAPI spec at `GET /api/openapi.json`.

### Authentication (19 endpoints)

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

### Records (22 endpoints)

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

### Marketplace (17 endpoints)

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

### Auctions (8 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auctions` | Create an auction listing |
| GET | `/api/auctions` | List active auctions |
| GET | `/api/auctions/:id` | Get auction details |
| POST | `/api/auctions/:id/bid` | Place a bid |
| GET | `/api/auctions/:id/bids` | Get bid history |
| PUT | `/api/auctions/:id/close` | Close auction manually |
| GET | `/api/auctions/won` | List won auctions |
| GET | `/api/auctions/selling` | List your auction listings |

### Loyalty & Seller Tiers (6 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/loyalty/points` | Get loyalty point balance |
| POST | `/api/loyalty/redeem` | Redeem points for credits |
| GET | `/api/loyalty/history` | Point transaction history |
| GET | `/api/seller-tiers` | Get seller tier info |
| GET | `/api/seller-tiers/:username` | Get seller's tier and benefits |
| GET | `/api/featured-listings` | Get featured/promoted listings |

### Social (11 endpoints)

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

### Stories (6 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/stories` | Create a story |
| GET | `/api/stories` | List active stories |
| GET | `/api/stories/:id` | Get story details |
| POST | `/api/stories/:id/view` | Mark story as viewed |
| GET | `/api/stories/:username/highlights` | Get story highlights |
| DELETE | `/api/stories/:id` | Delete a story |

### Vinyl Buddy (12 endpoints)

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

### Vinyl Buddy Mesh & Hardware (8 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/vinyl-buddy/mesh/register` | Register device in mesh network |
| GET | `/api/vinyl-buddy/mesh/peers/:deviceId` | List mesh peers |
| POST | `/api/vinyl-buddy/mesh/sync` | Sync listening session across mesh |
| GET | `/api/vinyl-buddy/sd/sessions/:deviceId` | Get offline-cached sessions from SD |
| POST | `/api/vinyl-buddy/sd/upload/:deviceId` | Upload cached sessions from SD card |
| POST | `/api/vinyl-buddy/gesture/configure` | Configure gesture sensor mappings |
| GET | `/api/vinyl-buddy/gesture/:deviceId` | Get gesture configuration |
| POST | `/api/vinyl-buddy/noise-cancel/calibrate` | Calibrate noise cancellation |

### Vinyl Buddy Extended (15 endpoints)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/vinyl-buddy/stream` | Stream raw audio chunks for server-side processing |
| GET | `/api/vinyl-buddy/devices/:userId` | List all paired devices for a user (extended) |
| POST | `/api/vinyl-buddy/devices/:deviceId/command` | Send a command to a device (identify, calibrate, reset, update) |
| GET | `/api/vinyl-buddy/devices/:deviceId/telemetry` | Get device telemetry history (battery, temperature, signal, uptime) |
| POST | `/api/vinyl-buddy/devices/:deviceId/name` | Rename a paired device |
| GET | `/api/vinyl-buddy/identification-history/:userId` | Paginated identification history with stats |
| POST | `/api/vinyl-buddy/identification/:id/correct` | Submit correction for a misidentified track |
| GET | `/api/vinyl-buddy/leaderboard` | Global identification leaderboard (all, week, month) |
| POST | `/api/vinyl-buddy/listening-party` | Create a listening party room |
| POST | `/api/vinyl-buddy/listening-party/:id/join` | Join an active listening party |
| GET | `/api/vinyl-buddy/listening-party/:id` | Get party status and participants |
| POST | `/api/vinyl-buddy/devices/:deviceId/diagnostics` | Request a device diagnostic report |
| GET | `/api/vinyl-buddy/firmware/versions` | List all available firmware versions |
| POST | `/api/vinyl-buddy/firmware/rollback/:deviceId` | Rollback device to a previous firmware version |
| GET | `/api/vinyl-buddy/analytics/:userId` | Detailed listening analytics per user |

### Analytics (9 endpoints)

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

### Utility (15 endpoints)

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
├── server.js                          # Express API server (7,500+ lines)
├── package.json                       # Dependencies and scripts
├── tailwind.config.js                 # Tailwind configuration
├── Procfile                           # Railway deployment config
├── firmware/                          # ESP32 Vinyl Buddy firmware
│   ├── main.cpp                       # Main firmware entry point
│   ├── audio_capture.cpp              # I2S microphone handling
│   ├── ble_config.cpp                 # BLE pairing and configuration
│   ├── oled_display.cpp               # SSD1306 display driver
│   ├── sd_cache.cpp                   # SD card offline caching
│   ├── gesture_sensor.cpp             # APDS-9960 gesture handling
│   ├── noise_cancel.cpp               # Active noise cancellation
│   ├── esp_now_mesh.cpp               # ESP-NOW mesh networking
│   └── config.h                       # Hardware pin definitions
├── scripts/
│   └── generate-deck.js               # Pitch deck generator (36 slides)
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
        ├── Card.jsx                   # Record card with flip animation
        ├── Paginated.jsx              # Pagination wrapper
        ├── UserChip.jsx               # Inline user reference
        ├── UserLink.jsx               # Clickable user link
        ├── VirtualList.jsx            # Virtual scrolling container
        ├── DrawerModal.jsx            # Bottom drawer modal
        ├── screens/
        │   ├── ExploreScreen.jsx      # Marketplace browsing
        │   ├── SocialFeedScreen.jsx   # Social feed with posts
        │   ├── CollectionScreen.jsx   # Collection management
        │   ├── ProfileScreen.jsx      # Current user profile
        │   ├── UserProfilePage.jsx    # Public user profiles
        │   ├── FollowingScreen.jsx    # Following feed
        │   ├── TransactionsScreen.jsx # Orders, offers, cart
        │   ├── AuctionsScreen.jsx     # Auction browsing and bidding
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
            ├── CardFlip.jsx           # 3D card flip component
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
- **Drawer modals** with bottom-sheet UX, swipe-to-dismiss, and snap points (collapsed, half, full)
- **Lazy-loaded screens** via `React.lazy` and `Suspense` for faster initial load
- **Virtual scrolling** for long lists (1,000+ items) rendering only visible rows
- **Card flip animations** with 3D CSS transforms for interactive record cards
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
- **290+ API endpoints** across authentication, records, marketplace, auctions, social, stories, Vinyl Buddy, mesh, analytics, and utility
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

**Social:** `posts`, `comments`, `follows`, `post_likes`, `post_bookmarks`, `record_likes`, `record_saves`, `stories`, `story_views`

**Marketplace:** `offers`, `offer_negotiations`, `purchases`, `order_cancellations`, `escrow_holds`, `disputes`, `promo_codes`, `referrals`, `auctions`, `auction_bids`, `featured_listings`, `loyalty_points`, `loyalty_transactions`

**Messaging:** `messages`, `notifications`

**Collection:** `wishlist`, `price_history`, `price_alerts`, `record_views`, `condition_verification_log`, `condition_change_history`, `collection_shares`, `record_provenance`, `authenticity_queue`

**Vinyl Buddy:** `vinyl_sessions`, `vinyl_devices`, `mesh_peers`, `sd_cache_log`, `gesture_config`

**Account:** `user_preferences`, `user_verification`, `user_blocks`, `activity_log`, `api_keys`, `webhooks`, `moderation_queue`, `seller_tiers`

---

## Performance Optimizations

- **Virtual scrolling** — long lists (collections, search results, feeds) render only visible rows using a windowed approach, maintaining 60fps even with 1,000+ items
- **React.lazy and Suspense** — screens are code-split and lazy-loaded, reducing initial bundle size significantly
- **Lazy image loading** — images load on demand via IntersectionObserver with placeholder shimmer effects
- **Debounced search inputs** — search queries are debounced (300ms) to reduce unnecessary API calls
- **Memoized components** — heavy components use `React.memo`, `useMemo`, and `useCallback` to prevent unnecessary re-renders
- **Gzip compression** — all API responses are compressed server-side
- **Service worker caching** — static assets and API responses are cached for offline-capable PWA support
- **Optimistic UI updates** — likes, saves, follows, and bookmarks update instantly on the client before server confirmation
- **Batch API endpoint** — `POST /api/batch` allows combining multiple API calls into a single HTTP request
- **Database connection pooling** — PostgreSQL connections are pooled and reused
- **Indexed queries** — frequently queried columns (username, record_id, created_at) are indexed
- **Response pagination** — all list endpoints support cursor-based or offset pagination with configurable page sizes

---

## Security Features

- **JWT authentication** with bcrypt password hashing (12 salt rounds)
- **Two-factor authentication (TOTP)** — setup and verification with authenticator app support
- **CSRF token generation** — unique tokens per session for form protection
- **Rate limiting** — 100 requests/minute general, 10 requests/minute for auth endpoints, sliding window algorithm
- **Email verification** with token-based confirmation flow
- **Password reset** with secure token generation and configurable expiry
- **User blocking** at the application level with full bi-directional enforcement
- **Content moderation queue** with reporting and admin review workflow
- **Request ID tracing** — every request tagged with a unique `X-Request-Id` for debugging and audit trails
- **Input validation** — all inputs validated and sanitized to prevent SQL injection and XSS
- **CORS configuration** — strict allowed origin management with environment-based configuration
- **Request body size limits** — 10 MB for JSON, 1 MB for URL-encoded to prevent payload attacks
- **Secure headers** — appropriate security headers on all responses
- **Session management** — view active sessions, revoke individual or all sessions
- **Account deactivation and deletion** — reversible deactivation and irreversible deletion with full data purge
- **Escrow protection** — funds held securely until buyer confirms receipt
- **Stripe webhook verification** — all payment webhooks verified with Stripe signatures

---

## Accessibility Features

- **Full keyboard navigation** with visible focus indicators across all interactive elements
- **Keyboard shortcuts** — 1-9 for tab navigation, Cmd+K command palette, customizable shortcut bindings
- **Command palette** — fuzzy search across records, users, actions, and navigation targets
- **Dark and light themes** with automatic system preference detection
- **Reduced motion support** — respects `prefers-reduced-motion` media query, disabling animations for users who prefer less motion
- **High contrast mode** — enhanced visibility option for improved readability
- **Screen reader support** — ARIA labels, roles, and live regions throughout the application
- **Skip-to-content links** — bypass navigation for keyboard users
- **Logical heading hierarchy** — proper `h1`-`h6` nesting for document structure
- **Font size adjustment** — configurable font sizing in settings
- **Focus trap in modals** — keyboard focus is trapped within open modals and drawer overlays
- **Color-independent indicators** — status information conveyed through icons and text, not color alone

---

## Vinyl Buddy Hardware

The Vinyl Buddy is an ESP32-based device that sits near your turntable and automatically identifies the record you are playing.

### How It Works

1. The INMP441 MEMS microphone captures a 2-second audio sample from the room
2. Active noise cancellation filters ambient noise for cleaner audio
3. The ESP32 sends raw PCM audio data to the GrooveStack server over Wi-Fi
4. The server converts the PCM data to WAV format and queries the AudD API for fingerprint matching
5. The identified track, artist, and album appear in your listening history on GrooveStack
6. The SSD1306 OLED screen displays the device code, connection status, and currently identified track
7. If WiFi is unavailable, sessions are cached to the SD card for later upload

### Components

| Part | Purpose |
|---|---|
| ESP32-DevKitC V4 | Main microcontroller with Wi-Fi + BLE |
| INMP441 MEMS Microphone | I2S digital audio capture |
| SSD1306 OLED Display (128x64) | Device status, track info, and animations |
| MicroSD Card Module | Offline session caching |
| APDS-9960 Gesture Sensor | Wave and swipe gesture control |
| Micro-USB / USB-C cable | Power and firmware flashing |
| Li-Po battery (optional) | Portable operation |

### Wiring

The INMP441 connects to the ESP32 via the I2S bus:

- **SCK** (Serial Clock) to GPIO 26
- **WS** (Word Select) to GPIO 25
- **SD** (Serial Data) to GPIO 33
- **VDD** to 3.3V
- **GND** to GND
- **L/R** to GND (left channel select)

The SSD1306 OLED connects via I2C on the default SDA/SCL pins (GPIO 21 / GPIO 22).

The APDS-9960 gesture sensor connects via I2C (shared bus with OLED, address 0x39).

The MicroSD card module connects via SPI (GPIO 5 CS, GPIO 18 SCK, GPIO 23 MOSI, GPIO 19 MISO).

### Setup

1. Flash the firmware from the `firmware/` directory to the ESP32
2. Power on the device — it will display a 12-character device code on the OLED
3. In GrooveStack, navigate to the Vinyl Buddy tab and enter the device code to pair
4. The device sends heartbeats every 30 seconds to confirm connectivity
5. Place the device near your turntable speaker and start playing a record

### Firmware Features

- **Auto-identification** — continuously listens and identifies tracks
- **BLE pairing** — Bluetooth Low Energy for initial device configuration
- **OLED display** — shows track info, connection status, device code, and listening animations
- **SD card caching** — stores sessions offline when WiFi is unavailable, auto-uploads when reconnected
- **Gesture control** — APDS-9960 sensor for wave-to-skip and swipe gestures
- **Active noise cancellation** — filters ambient noise for improved audio fingerprinting accuracy
- **Auto-gain control** — automatically adjusts microphone sensitivity for varying room volumes
- **ESP-NOW mesh** — peer-to-peer communication with other Vinyl Buddy devices for multi-room listening sync
- **Calibration mode** — adjust sensitivity for your room acoustics
- **OTA firmware updates** — check for and apply over-the-air updates from the app
- **Multi-device** — pair up to 4 Vinyl Buddy units per account
- **Health monitoring** — heartbeat status and signal quality indicators
- **Deep sleep mode** — power conservation when idle, wake on sound detection
- **LED indicators** — visual status for WiFi connection, BLE activity, and listening state
- **FreeRTOS** — task-based architecture for concurrent audio capture, display, and networking
- **Watchdog timer** — automatic crash recovery and device restart
- **MQTT telemetry** — publish device metrics and subscribe to remote commands via MQTT broker
- **FFT peak detection** — real-time frequency-domain analysis with dominant peak identification
- **Fuel gauge** — coulomb-counting battery estimation for accurate charge percentage
- **Capacitive touch** — touch sensor inputs for play/pause, skip, and volume control
- **WS2812 LED strip** — addressable RGB LED strip for ambient listening visualizations
- **Accelerometer (MPU6050)** — motion and orientation detection with tap-to-wake support
- **Real-time clock (DS3231)** — hardware RTC for accurate timestamps without network dependency
- **Audio AGC** — real-time automatic gain control based on signal envelope
- **Spectral centroid** — frequency-weighted mean for audio brightness analysis
- **Zero-crossing rate** — time-domain feature extraction for percussiveness detection
- **Firmware rollback** — automatic rollback to previous version on consecutive boot failures
- **Power-on self-test** — POST routine validating I2S, WiFi, I2C, SPI, ADC, and GPIO at startup
- **Buzzer / haptic** — audible and tactile feedback for button presses and events
- **Ambient light sensor** — auto-brightness for OLED based on room lighting
- **SPIFFS web interface** — on-device web UI for configuration and diagnostics
- **Audio fingerprint caching** — local cache to reduce redundant API calls for repeated tracks
- **Sleep/wake scheduling** — configurable quiet hours with automatic deep sleep and wake

---

## Vinyl Buddy Build Guide

A comprehensive step-by-step build guide for assembling your own Vinyl Buddy hardware device is available at:

**[`/vinyl-buddy-guide.html`](/vinyl-buddy-guide.html)**

The guide covers the complete parts list, wiring diagrams, firmware flashing instructions, all 64 firmware sections and capabilities, the 15+ VinylBuddy-specific API endpoints, and the 25 hardware UI components in the web interface.

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
- If using BLE pairing, ensure Bluetooth is enabled on your phone/computer

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

### Wave 28 (March 2026)

- 15 new Vinyl Buddy server endpoints: audio streaming, device commands, telemetry, identification history with corrections, global leaderboard, listening parties (create/join/view), device diagnostics, firmware version listing, firmware rollback, and per-user listening analytics
- 14 new firmware features: MQTT support, FFT peak detection, battery fuel gauge (coulomb counting), capacitive touch sensors, WS2812 LED strip, buzzer/haptic feedback, ambient light sensor, accelerometer (MPU6050), real-time clock (DS3231), audio AGC, spectral centroid, zero-crossing rate, firmware rollback on boot failure, and power-on self-test (POST)
- 25 hardware UI components in the web interface: device pairing animation, hardware status dashboard, I2S audio pipeline visualizer, microphone polar pattern display, GPIO pin status monitor, power consumption graph, WiFi channel scanner, audio buffer status, firmware flash progress, hardware error log viewer, device factory reset confirmation, USB serial monitor, antenna signal pattern, voltage regulator status, I2C bus scanner, SPI bus monitor, DMA channel status, interrupt handler monitor, FreeRTOS task scheduler view, heap fragmentation visualizer, NVS storage browser, partition table viewer, boot log viewer, watchdog timer status, and hardware self-test panel
- Vinyl Buddy Build Guide (`/vinyl-buddy-guide.html`) with complete parts list, wiring, firmware documentation, API reference, and software feature descriptions
- Firmware expanded to 64 sections covering all hardware subsystems
- Platform stats: 1,900+ improvements, 290+ API endpoints

### Wave 20 (March 2026)

- Final comprehensive documentation with 275+ API endpoints cataloged
- Performance audit and optimization pass across all screens
- Virtual scrolling refinements for smoother 60fps rendering
- Card flip animation polish with improved touch responsiveness
- Drawer modal snap point tuning for consistent mobile UX
- Complete Vinyl Buddy firmware feature documentation
- Pitch deck updated to 36 slides covering all 20 waves
- Platform stats: 1,800+ improvements, 51 users, 100+ records

### Wave 19 (February 2026)

- Advanced analytics: taste evolution tracking over time
- Mood detection improvements with expanded genre-mood mappings
- Listening pattern heatmaps with hourly granularity
- Weekly and monthly listening report generation
- Taste comparison feature for comparing preferences with friends

### Wave 18 (January 2026)

- Featured listing system with promoted placements
- Storefront customization for top-tier sellers
- Seller tier benefits expansion (lower fees, priority support, badges)
- Marketplace browse categories with curated collections

### Wave 17 (December 2025)

- Active noise cancellation for Vinyl Buddy audio capture
- Auto-gain control for adapting to varying room volumes
- Improved audio fingerprinting accuracy in noisy environments
- LED status indicators for WiFi, BLE, and listening state

### Wave 16 (November 2025)

- ESP-NOW mesh networking for peer-to-peer device communication
- Multi-room listening session synchronization
- Automatic peer discovery and encrypted data transfer
- Mesh topology with relay support through intermediate nodes

### Wave 15 (October 2025)

- SD card offline session caching for Vinyl Buddy
- Auto-upload of cached sessions when WiFi reconnects
- SD card health monitoring and storage management
- APDS-9960 gesture sensor integration (wave, swipe controls)

### Wave 14 (September 2025)

- BLE (Bluetooth Low Energy) pairing mode for Vinyl Buddy
- BLE-based device configuration without WiFi
- OLED display improvements: track info animations, status icons
- Deep sleep mode for power conservation

### Wave 13 (August 2025)

- Card flip animations with 3D CSS transforms for record cards
- Drawer modals with bottom-sheet UX and swipe-to-dismiss
- Drawer snap points: collapsed, half-screen, full-screen
- Enhanced swipe gesture support for mobile navigation

### Wave 12 (July 2025)

- Virtual scrolling for collections and search results with 1,000+ items
- Lazy image loading with IntersectionObserver and shimmer placeholders
- Debounced search inputs reducing API call volume by 60%
- Component memoization pass for reduced re-renders

### Wave 11 (June 2025)

- Auction system with timed listings, bids, reserves, and sniping protection
- Loyalty points system: earn on purchases, redeem for credits
- Seller tier expansion to 4 levels (Bronze, Silver, Gold, Platinum)
- Tier-based fee discounts and priority support

### Wave 10 (May 2025)

- Stories feature: ephemeral 24-hour content with photo and text formats
- Story highlights on profiles
- RSS feed for new listings
- Batch API endpoint for combining multiple requests
- Profile enhancements: activity heatmap, collection value trend

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
