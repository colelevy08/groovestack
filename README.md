# GrooveStack 🎵

## Overview

GrooveStack is a social marketplace platform for vinyl record collectors. Buy, sell, trade, and discover vinyl records with a community of collectors. Features include AI-powered record verification, real-time track identification via the Vinyl Buddy hardware device, and Stripe-powered secure payments.

## Features

- **Marketplace** — Browse, buy, and sell vinyl records with Discogs-powered pricing
- **Social Feed** — Share posts, tag records, like, comment, and bookmark
- **Collection Management** — Track your vinyl collection with detailed metadata
- **Trading System** — Send cash, trade, or combo offers with fair trade indicators
- **Vinyl Buddy** — ESP32 hardware device that identifies playing records via audio fingerprinting
- **AI Verification** — Claude Opus vision AI verifies physical vinyl authenticity
- **Direct Messaging** — Real-time conversations with read receipts
- **Stripe Payments** — Secure checkout with 5% platform fee
- **User Profiles** — Custom avatars, headers, bios, wishlists, and shipping addresses
- **Activity Tracking** — Orders, offers, cart, and purchase history with order tracking

## Tech Stack

- **Frontend:** React 19, Tailwind CSS 3.4, CRA
- **Backend:** Express.js 5, PostgreSQL, JWT auth
- **Payments:** Stripe Checkout Sessions
- **AI:** Claude Opus 4.6 (record verification), AudD API (audio fingerprinting)
- **APIs:** Discogs (pricing), iTunes (album art), Wikipedia (artist info)
- **Deployment:** Vercel (frontend), Railway (backend + PostgreSQL)
- **Hardware:** ESP32-DevKitC V4 (Vinyl Buddy)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or Railway for hosted DB)

### Installation

```bash
git clone https://github.com/colelevy08/groovestack.git
cd groovestack
npm install
```

### Environment Variables

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `ANTHROPIC_API_KEY` | For Claude AI verification |
| `AUDD_API_TOKEN` | For Vinyl Buddy audio identification |
| `REACT_APP_API_URL` | Backend URL (leave empty for local dev) |
| `FRONTEND_URL` | Frontend URL (set in Railway for CORS) |
| `DISCOGS_TOKEN` | For price lookups (optional, increases rate limit) |

### Development

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

## Architecture

### Frontend (React SPA)

- All state managed in `App.js` root component
- Screen-based navigation (not client-side routing)
- Modal system for overlays (record details, offers, messaging)
- `localStorage` for client-side persistence
- Responsive layout: desktop sidebar + mobile bottom nav

### Backend (Express API)

- JWT authentication with bcrypt password hashing
- PostgreSQL with auto-migration on startup
- In-memory rate limiting (100 req/min general, 10 req/min auth)
- Stripe webhook handling for payment confirmation
- Graceful shutdown with connection draining
- In-memory fallback when no database is configured

### Database Tables

`profiles`, `records`, `posts`, `comments`, `offers`, `purchases`, `messages`, `follows`, `vinyl_sessions`, `vinyl_devices`, `record_likes`, `record_saves`, `post_likes`, `post_bookmarks`

### API Endpoints

| Group | Endpoints |
|---|---|
| **Auth** | signup, login, forgot-password, profile management |
| **Records** | CRUD, search, like, save |
| **Social** | posts, comments, feed |
| **Marketplace** | offers, checkout, orders |
| **Vinyl Buddy** | identify, heartbeat, history, devices |
| **Utility** | prices/lookup, health, stats |

## Vinyl Buddy Hardware

The Vinyl Buddy is an ESP32-based device that:

1. Captures 2-second audio samples from your turntable
2. Sends PCM audio to the GrooveStack server
3. Server converts to WAV and queries AudD for fingerprint matching
4. Identified tracks appear in your listening history

**Setup:** Enter the 12-character device code displayed on the OLED screen in the Vinyl Buddy tab.

## Deployment

- **Frontend:** Push to `main` auto-deploys to Vercel
- **Backend:** Push to `main` auto-deploys to Railway
- Set environment variables in both platforms
- Railway auto-injects `DATABASE_URL` and `PORT`

## License

MIT
