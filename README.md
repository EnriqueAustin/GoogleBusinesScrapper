# Google Business Scraper

A complete Google Maps scraper with a Next.js dashboard for lead generation and sales pipeline management. Extracts business data (name, phone, website, rating, reviews), enriches websites with tech stack analysis, SEO analysis, and email extraction, then stores everything in PostgreSQL.

## Prerequisites

- **Node.js** 18+
- **Docker Desktop** (for Postgres + Redis)
- **Chrome Browser** (for Base44 demo site generation)

## Quick Start (Fresh Install)

```bash
# Clone the repo and run the one-command setup
npm run setup
```

This will:
1. Start Postgres + Redis containers via Docker
2. Create `.env` from `.env.example`
3. Install all dependencies (root + frontend)
4. Generate Prisma client and push the DB schema
5. Install Playwright Chromium for scraping

Then start the app:

```bash
npm run dev
```

| Service   | URL                     |
|-----------|-------------------------|
| Frontend  | http://localhost:3000   |
| API       | http://localhost:3001   |

## Commands

| Command            | Description                                       |
|--------------------|---------------------------------------------------|
| `npm run dev`      | Start API + Worker + Frontend (development mode)  |
| `npm run setup`    | Fresh install — Docker, deps, DB, Playwright      |
| `npm run reset`    | Wipe all data (Postgres + Redis + output files)    |
| `npm run dev:api`  | Start only the API server                         |
| `npm run dev:worker`| Start only the worker (processes scraping jobs)  |
| `npm run dev:frontend`| Start only the Next.js frontend                  |

## Architecture

```
├── server.js              # Express API (port 3001)
├── src/
│   ├── worker.js          # BullMQ job worker (scrapes in background)
│   ├── scraper.js         # Playwright-based Google Maps scraper
│   ├── enricher.js        # Website analysis (tech stack, SEO, emails)
│   ├── exporter.js        # Postgres save + CSV export
│   ├── config.js          # Centralized configuration
│   ├── utils.js           # Helpers (delays, logging, stealth)
│   ├── queue/
│   │   └── scraperQueue.js  # BullMQ queue + Redis connection
│   └── base44/            # AI Website Generator module
│       ├── orchestrator.js    # Main generation workflow
│       ├── browserController.js # Browser automation for Base44
│       ├── validator.js       # Input validation
│       ├── promptTemplate.js  # Prompt building
│       ├── exportHandler.js   # Download handling
│       ├── config.js          # Base44-specific config
│       ├── logger.js          # Module logging
│       └── index.js           # Module exports
├── frontend/              # Next.js 16 dashboard
│   ├── src/app/
│   │   ├── page.tsx       # Dashboard overview
│   │   ├── leads/         # Leads table with filters
│   │   ├── jobs/          # Job queue management
│   │   ├── settings/      # Scraper settings
│   │   └── crm/           # Sales pipeline & CRM
│   ├── src/components/    # Reusable UI components
│   └── src/lib/           # Utilities and API client
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/
│   ├── setup.js           # Fresh install script
│   └── reset-db.js        # Data wipe script
├── base44-extension/      # Chrome extension for Base44 export
│   ├── manifest.json      # Extension manifest
│   ├── content.js         # Page content script
│   ├── popup.html/js      # Extension popup UI
│   └── icons/             # Extension icons
├── docker-compose.yml     # Postgres + Redis containers
├── .env.example           # Environment template
└── output/
    └── leads.csv          # Exported leads CSV
```

## How It Works

1. **Submit queries** via the Jobs page (e.g., "guest houses in paarl")
2. **Worker scrapes** Google Maps using Playwright with stealth mode
3. **Enricher analyzes** each business website for tech stack, SEO, and emails
4. **Results saved** to PostgreSQL with lead scoring
5. **Browse leads** in the dashboard with filters, sorting, and CSV export
6. **Manage CRM** - Track leads through sales pipeline, log calls, schedule follow-ups
7. **Generate demo sites** - Use Base44 AI to create demo websites for leads

---

# 📚 Complete Software Documentation

## Table of Contents

1. [Core Modules](#1-core-modules)
2. [Data Flow](#2-data-flow)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Frontend Features](#5-frontend-features)
6. [Configuration](#6-configuration)
7. [Base44 Demo Builder](#7-base44-demo-builder--work-in-progress)
8. [Environment Variables](#8-environment-variables)

---

## 1. Core Modules

### 1.1 Scraper Module (`src/scraper.js`)

The Google Maps scraper uses Playwright with stealth mode to extract business data.

**Key Features:**
- **Human-like behavior**: Random delays between actions, typing simulation
- **CAPTCHA detection**: Automatic detection and halt on CAPTCHA
- **Stealth mode**: Uses puppeteer-extra-plugin-stealth to avoid detection
- **Deduplication**: Prevents processing duplicate businesses within a scrape
- **Cookie consent handling**: Automatically dismisses Google consent dialogs
- **Resource blocking**: Blocks images, fonts, and media for performance

**Data Extracted:**
- Business name
- Category (with multiple fallback methods)
- Full address
- Phone number
- Website URL
- Rating (stars)
- Review count
- Social media links (Facebook, Instagram, etc.)
- Whether business has a real website (not just social media)

### 1.2 Enricher Module (`src/enricher.js`)

Analyzes discovered websites to extract additional intelligence.

**Tech Stack Detection:**
- WordPress (wp-content, wp-includes patterns)
- Shopify (cdn.shopify.com)
- Wix (wix.com patterns)
- Squarespace
- Weebly
- Next.js / React
- Elementor

**SEO Analysis:**
- Checks for missing or short title tags
- Checks for missing meta descriptions
- Reports SEO issues

**Email Extraction:**
- Extracts email addresses from HTML
- Filters out blacklisted patterns (noreply, test emails, etc.)
- Deduplicates and limits to 10 emails max
- Ignores false positives (file extensions, hex hashes)

**Social Media Detection:**
- Finds Facebook, Instagram, LinkedIn, Twitter/X, YouTube, TikTok, Pinterest links

### 1.3 Worker Module (`src/worker.js`)

Background job processor using BullMQ and Redis.

**Responsibilities:**
- Processes scraping jobs from the queue
- Fetches dynamic settings from database
- Enriches websites during scraping (if enabled)
- Saves results to PostgreSQL
- Updates job status (waiting → active → completed/failed/stalled)
- Handles graceful shutdown (marks active jobs as stalled)
- Startup recovery (marks leftover active jobs as stalled)

**Job Lifecycle:**
1. `waiting` - Job queued, waiting for worker
2. `active` - Currently being scraped
3. `completed` - Successfully finished
4. `failed` - Error occurred
5. `stalled` - Worker died or was interrupted

### 1.4 Exporter Module (`src/exporter.js`)

Handles data persistence and export.

**Features:**
- Saves/updates leads in PostgreSQL (upsert by name + address)
- Appends new search queries to existing leads
- Calculates lead scores (0-100) based on:
  - Website presence (+25 if no website)
  - Rating (up to +15 for high ratings)
  - Review count (up to +10 for many reviews)
  - Phone number (+5)
  - Social media (+5)
- Exports all data to CSV in `output/leads.csv`
- Tracks completed queries to avoid duplicates

### 1.5 Queue Module (`src/queue/scraperQueue.js`)

Manages the BullMQ job queue backed by Redis.

**Configuration:**
- Queue name: `scraperQueue`
- No automatic retries (stalled jobs handled manually)
- Keeps last 100 completed jobs in Redis
- Keeps last 50 failed jobs in Redis

### 1.6 Utils Module (`src/utils.js`)

Shared utility functions.

**Functions:**
- `humanDelay(min, max)` - Random delay between actions
- `humanType(page, selector, text)` - Simulate human typing
- `log(level, message)` - Timestamped colored logging
- `detectCaptcha(page)` - Check for CAPTCHA presence
- `dismissCookieConsent(page)` - Handle Google consent dialogs
- `safeText(locator, fallback)` - Safe text extraction
- `safeAttr(locator, attr, fallback)` - Safe attribute extraction
- `randomUserAgent()` - Get random user agent from pool

---

## 2. Data Flow

```
User submits query → POST /api/jobs
                         ↓
              Job added to BullMQ (Redis)
                         ↓
              Worker picks up job
                         ↓
              Scraper.js launches Playwright
                         ↓
              Navigates to Google Maps
                         ↓
              Types query + searches
                         ↓
              Scrolls to load results
                         ↓
              For each listing:
                - Click listing
                - Extract data (name, address, phone, etc.)
                - Close panel
                         ↓
              If enrichment enabled:
                - Visit website
                - Detect tech stack
                - Extract emails
                - Analyze SEO
                         ↓
              Exporter.saveLeads()
                - Upsert to PostgreSQL
                - Calculate lead scores
                - Append queries
                         ↓
              Export CSV
                         ↓
              Mark job complete
```

---

## 3. Database Schema

### Lead Model
| Field | Type | Description |
|-------|------|-------------|
| id | Int (PK) | Auto-increment primary key |
| name | String | Business name |
| category | String? | Business category (e.g., "Guesthouse") |
| address | String? | Full street address |
| city | String? | Extracted from address |
| phone | String? | Phone number |
| website | String? | Website URL |
| hasWebsite | Boolean | Has real website (not just social) |
| rating | Float? | Star rating (1-5) |
| reviewCount | Int? | Number of reviews |
| socials | String? | Comma-separated social links |
| emails | String? | Comma-separated extracted emails |
| websiteStatus | String? | Active / Error / Offline |
| techStack | String? | Detected tech (WordPress, etc.) |
| seoStatus | String? | SEO issues found |
| leadScore | Int (default: 0) | Calculated score 0-100 |
| notes | String? | User notes |
| tags | String? | User tags |
| customFields | Json? | Flexible custom data |
| query | String? | Original search query |
| scrapedAt | DateTime | When scraped |
| updatedAt | DateTime | Auto-updated |

### CRM Fields (Sales Pipeline)
| Field | Type | Description |
|-------|------|-------------|
| crmStatus | String (default: "new") | Pipeline status: new, attempting, connected, qualified, disqualified, closed_won, closed_lost |
| callCount | Int (default: 0) | Number of calls made |
| lastCalledAt | DateTime? | Last call timestamp |
| nextFollowUp | DateTime? | Scheduled follow-up |
| qualificationNotes | String? | Sales notes |
| estimatedValue | Float? | Estimated deal value |
| setupFee | Float? | One-time setup fee |
| monthlyFee | Float? | Monthly recurring fee |
| websitePainPoints | String? | Pain points identified |
| siteStatus | String (default: "none") | none / demo / full |

### LeadLog Model
Audit trail for lead changes.
- `action`: Type of action (edited, status_changed, call_logged, etc.)
- `field`: Which field changed
- `oldValue` / `newValue`: Before/after values

### CallLog Model
Call history tracking.
- `type`: call, email, note
- `outcome`: answered, voicemail, no_answer, callback, interested, not_interested, left_message
- `notes`: Call notes
- `duration`: Call duration in seconds

### Job Model
Scraping job tracking.
- `id`: UUID
- `query`: Search query
- `status`: waiting, active, completed, failed, stalled
- `resultsCount`: Number of businesses scraped
- `durationMs`: How long the job took
- `params`: JSON string of job parameters

### DemoJob Model
Base44 site generation tracking.
- `id`: UUID
- `leadId`: Associated lead
- `status`: pending, running, completed, failed
- `finalPath`: Path to generated ZIP
- `error`: Error message if failed
- `inputData`: JSON input for generation

---

## 4. API Endpoints

### Leads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads (paginated, filterable, sortable) |
| PATCH | `/api/leads/:id` | Update lead field(s) |
| DELETE | `/api/leads/bulk` | Delete multiple leads |
| POST | `/api/leads/import` | Import leads from CSV |
| GET | `/api/leads/export` | Download CSV export |
| POST | `/api/leads/deduplicate` | Find and merge duplicates |
| POST | `/api/leads/score` | Recalculate lead scores |
| GET | `/api/leads/:id/logs` | Get audit history |
| GET | `/api/leads/categories` | Get distinct categories |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/:id` | Get specific job |
| POST | `/api/jobs` | Add new scrape job |
| POST | `/api/jobs/batch` | Add multiple jobs |
| DELETE | `/api/jobs/clear` | Clear completed/failed jobs |
| POST | `/api/jobs/:id/cancel` | Cancel a job |
| DELETE | `/api/jobs/:id` | Delete a job |
| POST | `/api/jobs/:id/retry` | Retry failed job |
| POST | `/api/jobs/requeue-stalled` | Re-queue all stalled |

### Enrichment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enrich` | Enrich single website |
| POST | `/api/enrich/bulk` | Bulk enrichment |

### Stats & Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/settings` | Get global settings |
| POST | `/api/settings` | Update settings |
| GET | `/api/queries` | List completed queries |

### CRM
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/stats` | Pipeline statistics |
| GET | `/api/crm/analytics` | Value funnel & activity |
| GET | `/api/crm/tasks` | Follow-up tasks |
| GET | `/api/crm/queue` | Prioritized call queue |
| PATCH | `/api/leads/:id/crm` | Update CRM status |
| POST | `/api/leads/:id/calls` | Log a call |
| GET | `/api/leads/:id/calls` | Get call history |

### Base44 (Demo Builder)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/base44/generate` | Start demo generation |
| GET | `/api/base44/status/:jobId` | Check generation status |
| GET | `/api/base44/jobs` | List demo jobs |

---

## 5. Frontend Features

### Dashboard (`/dashboard`)
- Overview statistics (total leads, websites, categories)
- Recent activity
- Quick actions

### Leads (`/leads`)
- Paginated table with sorting
- Advanced filters (has website, rating, reviews, city, etc.)
- Search across all fields
- Inline editing
- Bulk actions (delete, export)
- Lead detail view with history

### Jobs (`/jobs`)
- Queue management
- Submit single or batch queries
- Monitor job status
- Retry/cancel/delete jobs
- Clear completed jobs

### CRM (`/crm`)
- Sales pipeline view (kanban or list)
- Lead qualification
- Call logging
- Follow-up scheduling
- Task list
- Call queue (prioritized by score & follow-up date)

### Settings (`/settings`)
- Scraper configuration
- Browser settings (headless mode, proxy)
- Enrichment toggle
- Result limits

---

## 6. Configuration

Configuration is stored in `src/config.js` and can be overridden via database settings.

### Delay Settings
```javascript
delays: {
  typing: { min: 0.05, max: 0.18 },      // Between keystrokes
  afterSearch: { min: 6, max: 12 },     // After search
  afterClick: { min: 4, max: 9 },       // After clicking listing
  afterScroll: { min: 3, max: 7 },      // After scrolling
  afterEscape: { min: 2, max: 5 },      // After closing panel
  betweenQueries: { min: 1800, max: 7200 }, // Between full queries
}
```

### Feature Flags
```javascript
features: {
  enrichWebsitesDuringScrape: true,  // Auto-enrich during scrape
}
```

### Limits
```javascript
limits: {
  maxResultsPerQuery: 30,     // Businesses per query
  maxScrollAttempts: 15,      // Scroll loops before stopping
  maxDailyActions: 50,        // Soft daily limit
}
```

### Browser Settings
```javascript
browser: {
  headless: false,            // Show browser window
  slowMo: 80,                 // Slow down actions (ms)
  viewport: { width: 1280, height: 800 },
  args: [...],                // Chrome flags for stealth
}
```

---

## 7. Base44 Demo Builder (⚠️ Work in Progress)

The Base44 module is an AI-powered website generator integration that automatically creates demo websites for leads.

**Status:** 🔧 Still a work in progress, not yet working.

### Overview
The module automates interaction with Base44.ai to generate complete websites based on business information.

### Module Structure
```
src/base44/
├── orchestrator.js      # Main workflow controller
├── browserController.js # Browser automation for Base44
├── validator.js         # Input validation with Zod
├── promptTemplate.js    # Prompt building from templates
├── exportHandler.js     # Download and file management
├── config.js           # Base44-specific configuration
├── logger.js           # Module logging
└── index.js            # Module exports
```

### Chrome Extension (`base44-extension/`)
A companion Chrome extension that assists with exporting generated sites from Base44:
- `manifest.json` - Extension configuration
- `content.js` - Injected page script
- `popup.html/js` - Extension UI
- `page-bridge.js` - Communication bridge

### Input Data Format
```javascript
{
  businessName: "Beachfront Guesthouse",
  industry: "guesthouse",
  location: "Cape Town, South Africa",
  services: ["accommodation", "breakfast", "wifi"],
  tone: "professional",
  pages: ["home", "about", "rooms", "contact"],
  targetRootDir: "/path/to/output",
  townFolder: "Cape-Town",
  categoryFolder: "guesthouses",
  leadId: 123,              // Optional: associated lead
  runHeadless: false        // Show browser during generation
}
```

### Required Environment Variables
```bash
BASE44_CHROME_PROFILE=/path/to/chrome/profile
BASE44_EXTENSION_ID=ngbhbpaflbegfjgaibhldjlmmfonpief
BASE44_ROOT_DIR=/path/to/client-demos
BASE44_BUILD_TIMEOUT=120000
```

### API Endpoints
- `POST /api/base44/generate` - Start generation
- `GET /api/base44/status/:jobId` - Poll for status
- `GET /api/base44/jobs` - List all jobs

### Current Status
The Base44 demo builder module is currently under development. The core components are in place but the integration with Base44.ai's generation and export flow is not yet complete.

---

## 8. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL="postgresql://scraper_user:scraper_password@localhost:5433/google_business_scraper?schema=public"

# Base44 AI Website Generator (Work in Progress)
BASE44_CHROME_PROFILE=/home/vboxuser/.config/google-chrome
BASE44_EXTENSION_ID=ngbhbpaflbegfjgaibhldjlmmfonpief
BASE44_ROOT_DIR=/home/vboxuser/Client-Demos
BASE44_BUILD_TIMEOUT=120000
```

### Docker Services
- **PostgreSQL**: Port 5433 (mapped from container 5432)
- **Redis**: Port 6379

---

## License

ISC
