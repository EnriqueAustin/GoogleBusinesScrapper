# Google Business Scraper

A low-detection-risk Google Maps scraper with a **web dashboard** for finding local businesses that need websites — built for web design agency lead generation.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Edit your search queries
# Open queries.txt and add one query per line, e.g.:
#   plumbers in Saldanha Western Cape
#   hair salons in Vredenburg

# 3. Run the scraper (opens a real Chrome window)
npm run scrape
# Or: node scrape.js "restaurants in Saldanha"

# 4. View results in the dashboard
npm run dashboard
# Opens at http://localhost:3000
```

## Features

### Scraper
- **Stealth mode** — playwright-extra with stealth plugin to avoid detection
- **Human-like behavior** — character-by-character typing, random delays, real browser window
- **Stable selectors** — uses Google's `data-item-id` attributes (won't break easily)
- **Smart scrolling** — detects end of results automatically
- **Cookie consent** — auto-dismisses Google banners
- **CAPTCHA detection** — stops and warns if CAPTCHA appears
- **Crash-safe** — saves after each query, skips completed queries on restart
- **CSV + JSON** — exports to both formats with deduplication

### Dashboard
- **Stats overview** — total leads, no-website prospects, categories
- **Filter & sort** — by website status, category, rating, search text
- **Lead details** — click any row for full info + "Open in Google Maps" link
- **CSV export** — download filtered results
- **Dark mode** — premium glassmorphism design

## Safety Rules

> ⚠️ These rules minimize detection and ban risks. Follow them carefully.

1. **Use your normal home IP** — no VPN/proxy needed for small scale
2. **Max ~30–50 actions per day** — don't scrape too aggressively
3. **Long delays between queries** — the scraper auto-waits 30min–2hrs between searches
4. **Keep `headless: false`** — the visible browser is less suspicious
5. **If CAPTCHA appears** — stop immediately and wait 24+ hours
6. **One category at a time** — don't run many queries back-to-back
7. **Rotate user agents** — change after each daily session (see `src/config.js`)

## Configuration

All settings are in `src/config.js`:
- Delay ranges (typing speed, wait times)
- Max results per query
- User agent pool
- Browser viewport & locale
- Output file paths
- Google Maps selectors

## Project Structure

```
├── scrape.js           # CLI entry point
├── server.js           # Dashboard Express server
├── queries.txt         # Search queries (one per line)
├── src/
│   ├── config.js       # All configuration
│   ├── utils.js        # Delays, typing, logging, CAPTCHA detection
│   ├── scraper.js      # Core scraping engine
│   └── exporter.js     # CSV/JSON export + deduplication
├── dashboard/
│   ├── index.html      # Dashboard UI
│   ├── style.css       # Dark mode styling
│   └── app.js          # Frontend logic
└── output/             # Generated after scraping
    ├── leads.csv
    ├── leads.json
    └── completed_queries.json
```