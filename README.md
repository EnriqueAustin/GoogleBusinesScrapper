# Google Business Scraper

A low-detection-risk Google Maps scraper with an advanced **web dashboard** for finding local businesses. Built with Node.js, Next.js, PostgreSQL, and Redis (BullMQ).

## Prerequisites

To set up this project from scratch, you must have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18+)
- [Docker & Docker Compose](https://www.docker.com/) (Required for running PostgreSQL and Redis)

---

## 🚀 Quick Setup Guide

Follow these steps exactly to get the project running locally.

### 1. Configure Environment Variables
Create a `.env` file in the root directory by copying the example file:
```bash
cp .env.example .env
```
*(The default configuration in `.env.example` points to the local Docker containers and should work out-of-the-box).*

### 2. Start the Database and Queue (Docker)
Start the PostgreSQL database and Redis server using Docker Compose:
```bash
docker compose up -d
```
*This starts a Postgres instance on port `5433` and a Redis instance on `6379`.*

### 3. Install Dependencies
You need to install dependencies in **both** the root folder and the `frontend` folder:
```bash
# Install root (backend/scraper) dependencies
npm install

# Install frontend (Next.js) dependencies
cd frontend
npm install
cd ..
```

### 4. Push the Database Schema
Initialize the PostgreSQL database table structure using Prisma:
```bash
npx prisma db push
```

### 5. Run the Application
Start the API, Scraper Worker, and Next.js Frontend all at once:
```bash
npm run dev
```
Wait for the Next.js compilation to finish. The dashboard is now accessible at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Architecture Overview

* **Core Scraper**: Uses `playwright-extra` with the stealth plugin. Uses a visible browser (`headless: false`) and long randomized delays to mimic human behavior and avoid CAPTCHAs.
* **Database**: PostgreSQL (via Prisma ORM) stores all scraped leads and job history.
* **Background Jobs**: BullMQ and Redis handle queuing up scrape jobs so they can run asynchronously in the background.
* **API Engine**: Express.js server providing REST endpoints for queries, job dispatching, leading CRUD operations, and deduplication.
* **Dashboard frontend**: A modern Next.js + TailwindCSS + Shadcn/ui application allowing for advanced compound filtering, sorting, column toggling, batch scraping, and CSV import/exports.

## Safety Rules

> ⚠️ These rules minimize detection and ban risks. Follow them carefully.

1. **Use your normal home IP** — no VPN/proxy needed for small scale
2. **Max ~50 actions per day** — don't scrape too aggressively
3. **Long delays between queries** — the scraper auto-waits between searches
4. **Keep `headless: false`** — the visible browser is less suspicious
5. **If CAPTCHA appears** — stop immediately and wait 24+ hours
6. **One category at a time** — don't run many queries back-to-back
7. **Rotate user agents** — change after each daily session (settings located in `src/config.js`)

## Configuration

Core scraper settings are located in `src/config.js`. You can adjust:
- Delay ranges (typing speed, wait times)
- Max results per query
- User agent pool
- Browser viewport & locale