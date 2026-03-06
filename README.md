# Google Business Scraper

A Google Maps scraper with a Next.js dashboard for lead generation. Extracts business data (name, phone, website, rating, reviews), enriches websites with tech stack, SEO analysis, and email extraction, then stores everything in PostgreSQL.

## Prerequisites

- **Node.js** 18+
- **Docker Desktop** (for Postgres + Redis)

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
| Frontend  | http://localhost:3000    |
| API       | http://localhost:3001    |

## Commands

| Command         | Description                                       |
|-----------------|---------------------------------------------------|
| `npm run dev`   | Start API + Worker + Frontend (development mode)  |
| `npm run setup` | Fresh install — Docker, deps, DB, Playwright      |
| `npm run reset` | Wipe all data (Postgres + Redis + output files)   |

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
│   └── queue/
│       └── scraperQueue.js  # BullMQ queue + Redis connection
├── frontend/              # Next.js dashboard
│   └── src/app/
│       ├── page.tsx       # Dashboard overview
│       ├── leads/         # Leads table with filters
│       ├── jobs/          # Job queue management
│       └── settings/      # Scraper settings
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/
│   ├── setup.js           # Fresh install script
│   └── reset-db.js        # Data wipe script
├── docker-compose.yml     # Postgres + Redis containers
└── .env.example           # Environment template
```

## How It Works

1. **Submit queries** via the Jobs page (e.g., "guest houses in paarl")
2. **Worker scrapes** Google Maps using Playwright with stealth mode
3. **Enricher analyzes** each business website for tech stack, SEO, and emails
4. **Results saved** to PostgreSQL with lead scoring
5. **Browse leads** in the dashboard with filters, sorting, and CSV export