// Centralized configuration for the Google Business Scraper
// Adjust these values to control behavior and reduce detection risk

const config = {
  // --- Delay Ranges (seconds) ---
  delays: {
    typing: { min: 0.05, max: 0.18 },       // Between each character typed
    afterSearch: { min: 6, max: 12 },         // After pressing Enter on search
    afterClick: { min: 4, max: 9 },           // After clicking a listing
    afterScroll: { min: 3, max: 7 },          // After scrolling the feed
    afterEscape: { min: 2, max: 5 },          // After pressing Escape to close panel
    betweenQueries: { min: 1800, max: 7200 }, // Seconds between full queries (30m–2h)
  },

  // --- Scraper Features ---
  features: {
    enrichWebsitesDuringScrape: false, // Set to true to scan websites during initial scrape (slower)
  },

  // --- Scraping Limits ---
  limits: {
    maxResultsPerQuery: 30,     // Max businesses to extract per query
    maxScrollAttempts: 15,      // Max scroll attempts before giving up
    maxDailyActions: 50,        // Soft cap - reminder to stop for the day
  },

  // --- Browser Settings ---
  browser: {
    headless: false,
    slowMo: 80,
    viewport: { width: 1280, height: 800 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  },

  // --- User Agent Pool (rotate manually between sessions) ---
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  ],

  // --- Locale & Timezone ---
  locale: 'en-ZA',
  timezoneId: 'Africa/Johannesburg',

  // --- Output Paths ---
  output: {
    dir: 'output',
    csvFile: 'leads.csv',
    jsonFile: 'leads.json',
    completedFile: 'completed_queries.json',
  },

  // --- Google Maps Selectors (stable data-item-id based) ---
  selectors: {
    searchBox: 'input[aria-label="Search Google Maps"]',
    resultsFeed: '[role="feed"]',
    listingCards: '[role="feed"] > div > div[jsaction]',
    endOfList: '.HlvSq',  // "You've reached the end of the list"

    // Detail panel selectors (stable data-item-id attributes)
    name: '.DUwDvf',
    category: 'button[jsaction="pane.rating.category"]',
    address: 'button[data-item-id="address"]',
    website: 'a[data-item-id="authority"]',
    phone: 'button[data-item-id^="phone:tel:"]',
    rating: 'span[aria-label$="stars"]',
    reviewCount: 'span[aria-label$="reviews"]',
    priceLevel: 'span[aria-label^="Price"]',

    // Cookie consent & CAPTCHA
    cookieAcceptBtn: 'button[aria-label="Accept all"]',
    captchaFrame: 'iframe[src*="recaptcha"], iframe[title*="recaptcha"]',
  },

  // --- Dashboard ---
  dashboard: {
    port: 3000,
  },
};

module.exports = config;
