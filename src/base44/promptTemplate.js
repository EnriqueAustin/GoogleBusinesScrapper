/**
 * Base44 Prompt Template
 * Your exact prompt with placeholder injection
 */

const PROMPT_TEMPLATE = `
Create a production-ready, high-converting, multi-page website for a {industry} brand:
NAME: {businessName}
LOCATION: {location}
POSITIONING: {positioning}

🎨 THEME & DESIGN DIRECTION
* Style: Modern coastal charm (clean, airy, premium yet welcoming)
* Inspiration: {location} — deep ocean blues, crisp whites, soft sands, warm neutrals
* Feel: Peaceful, spacious, sea-surrounded relaxation, home-away-from-home comfort
* UI: Minimal, elegant, smooth animations, rounded edges, soft shadows, generous white space
* HERO TEXT RULE: On every hero section and full-width background image, ALL text (headlines, subheadlines, CTAs) MUST be pure white (#FFFFFF) only. Always use a strong semi-transparent dark overlay (65-75% opacity) so text never blends into background images.
* Focus: Waterfront location, sea on three sides, private rooms with ocean views, communal areas, quiet West Coast escape

🎯 GOAL
Build a fully responsive website that:
1. Drives bookings via LekkeSlaap
2. Allows direct booking/reservation enquiries with the owners

🌐 SITE STRUCTURE (MULTI-PAGE)
1. Home
2. Rooms & Accommodation
3. Gallery (NEW INTERACTIVE STYLE)
4. About
5. Location & Attractions
6. Contact
7. Booking / Reservations (NEW - IMPORTANT)
8. FAQ

📄 PAGE DETAILS

HOME PAGE
* Full-screen hero with cinematic ocean/coastal background image
* Overlay text: "{businessName}" + tagline about the location
* Quick-glance icons row: Ocean Views | Self-Catering | Private | WiFi | Braai
* "Why Choose {businessName}" value props section
* Featured rooms preview (card grid linking to Rooms page)
* Guest testimonials carousel
* Clear CTA: "Check Availability" → LekkeSlaap
* "Book Direct" CTA → Contact/Booking page

ROOMS & ACCOMMODATION PAGE
* Card-based grid layout
* Each room card: image, room name, sleeps count, amenities icons, price indicator
* "Book This Room" button → LekkeSlaap link
* "Enquire Direct" button → Contact/Booking page

GALLERY PAGE (INTERACTIVE)
* Masonry or Pinterest-style image grid
* Lightbox on click with smooth transitions
* Category filter tabs: Rooms | Views | Facilities | Area
* Lazy-loaded images for performance

ABOUT PAGE
* Story of {businessName} in {location}
* What makes it unique (waterfront, views, privacy)
* Owner introduction section
* Mission/Values section

LOCATION & ATTRACTIONS PAGE
* Embedded Google Map showing {location}
* Nearby attractions list with distances
* "Things to Do" cards: beaches, restaurants, activities
* Directions section with driving instructions

CONTACT PAGE
* Contact form: Name, Email, Phone, Message, Preferred Dates
* Business contact details (phone, email, address)
* Operating hours
* Embedded map
* Links to social media

BOOKING / RESERVATIONS PAGE
* Two clear booking paths:
  1. "Book via LekkeSlaap" — prominent button → {lekkeSlaapLink}
  2. "Book Direct" — reservation enquiry form
* Reservation form: Name, Email, Phone, Check-in Date, Check-out Date, Guests, Room Preference, Special Requests
* Availability calendar placeholder
* Pricing information section
* Cancellation policy summary

FAQ PAGE
* Accordion-style Q&A
* Common questions: check-in/out times, pets, parking, WiFi, payment methods
* Link to contact page for more questions

🧭 NAVIGATION & FOOTER
* Sticky top navbar with logo + all page links
* Mobile hamburger menu with smooth slide-in
* Footer with:
  - Quick links to all pages
  - Contact info
  - Social media icons
  - "Book Now" button
  - Copyright notice

🔗 LEKKESLAAP INTEGRATION
Use this exact link across the entire site:
{lekkeSlaapLink}

* Buttons: "Check Availability" / "Book Now" — always open in new tab

📱 RESPONSIVE DESIGN
* Mobile-first approach
* Breakpoints: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
* Touch-friendly navigation and buttons
* Optimized images for all screen sizes

⚡ PERFORMANCE
* Lazy loading for images
* Minimal JavaScript
* Optimized CSS
* Fast initial page load

🎨 FINAL RESULT
A stunning, professional, multi-page website that makes visitors want to book immediately. Every page should feel premium, trustworthy, and reflect the beauty of {location}.
`;

/**
 * Build the full prompt by injecting lead data into template
 * @param {Object} data - { businessName, industry, location, positioning, lekkeSlaapLink }
 * @returns {string} Complete prompt ready to paste into Base44
 */
function buildPrompt(data) {
    const {
        businessName = 'Business',
        industry = 'business',
        location = 'South Africa',
        positioning = '',
        lekkeSlaapLink = '',
    } = data;

    let prompt = PROMPT_TEMPLATE;
    prompt = prompt.replace(/\{businessName\}/g, businessName);
    prompt = prompt.replace(/\{industry\}/g, industry);
    prompt = prompt.replace(/\{location\}/g, location);
    prompt = prompt.replace(/\{positioning\}/g, positioning);
    prompt = prompt.replace(/\{lekkeSlaapLink\}/g, lekkeSlaapLink || '#');

    return prompt.trim();
}

module.exports = { PROMPT_TEMPLATE, buildPrompt };
