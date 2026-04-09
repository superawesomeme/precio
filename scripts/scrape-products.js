// Usage: cd scripts && npm install && node scrape-products.js
//
// This script scrapes product listings from El Corte Inglés across multiple
// categories and writes the results to ../data/products.json.
//
// El Corte Inglés relies heavily on client-side JavaScript rendering, so
// this scraper targets their internal search/API endpoints (JSON responses
// embedded in the page source or available via XHR) which are more stable
// than CSS selectors and don't require a headless browser.
//
// HOW IT WORKS:
//   1. For each category we fetch the El Corte Inglés search page with a
//      keyword (e.g. "televisor", "zapatillas", …).
//   2. We look for a JSON blob embedded in a <script> tag that contains
//      the product listing data (a common pattern for SSR/hydration).
//   3. If no embedded JSON is found we fall back to scraping visible HTML
//      product cards using cheerio selectors.
//
// HOW TO UPDATE SELECTORS:
//   - Open a category page in DevTools → Network → look for XHR responses
//     that contain product arrays (search for "price" or "thumbnail").
//   - If the site structure changes, update the CSS selectors in the
//     SELECTORS object below and/or adjust the JSON path extraction regex.

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { load } = require('cheerio');

// --------------- Configuration ---------------

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'products.json');
const MIN_PRODUCTS = 50;

// Realistic browser User-Agent to avoid basic bot-detection
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Search keywords covering a wide range of categories
// (electronics, fashion, home, beauty, sports, toys, etc.)
const SEARCH_KEYWORDS = [
  'televisor',
  'smartphone',
  'portátil',
  'zapatillas deporte',
  'abrigo mujer',
  'sofá',
  'perfume',
  'auriculares',
  'cámara fotos',
  'juguetes niños',
  'sartén',
  'bicicleta',
  'reloj hombre',
  'bolso mujer',
  'tablet',
];

// El Corte Inglés search URL template.
// Adjust `?s=` param if the site changes its search endpoint.
const searchUrl = (keyword) =>
  `https://www.elcorteingles.es/search/?s=${encodeURIComponent(keyword)}&start=0&sz=12`;

// --------------- CSS Selectors ---------------
// Update these if El Corte Inglés redesigns its product cards.

const SELECTORS = {
  // Container for each product card on search/category pages
  productCard: '.product-tile, [class*="product-card"], [data-testid="product-card"], .c-product-tile',
  // Product title
  title: '.product-tile__description, [class*="product-name"], .c-product-tile__title, h3',
  // Product price (first matching price element)
  price: '.price, [class*="price"], .c-price',
  // Product thumbnail image
  thumbnail: 'img[class*="product"], img[class*="tile"], .product-tile__image img, img',
};

// --------------- HTTP helpers ---------------

/**
 * Fetch a URL and return the response body as a string.
 * Follows up to maxRedirects HTTP redirects.
 */
function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
    };

    lib.get(url, options, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        resolve(fetchUrl(redirectUrl, maxRedirects - 1));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/** Sleep for ms milliseconds (avoids hammering the server) */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------- Parsers ---------------

/**
 * Try to extract a product array from JSON blobs embedded in <script> tags.
 * El Corte Inglés (and many other modern retail sites) server-side renders
 * product data into a __NEXT_DATA__ or similar global variable for hydration.
 *
 * Returns an array of normalised { title, price, thumbnail } objects, or [].
 */
function extractFromScriptJson(html) {
  const products = [];

  // Pattern 1 – Next.js __NEXT_DATA__ hydration payload
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1]);
      const items = findProductsInObject(json);
      products.push(...items);
    } catch (_) { /* ignore parse errors */ }
  }

  // Pattern 2 – Generic window.__STATE__ or window.__PRELOADED_STATE__
  const stateMatches = html.matchAll(/window\.__(?:PRELOADED_)?STATE__\s*=\s*(\{[\s\S]{20,}?\});?\s*<\/script>/gi);
  for (const m of stateMatches) {
    try {
      const json = JSON.parse(m[1]);
      const items = findProductsInObject(json);
      products.push(...items);
      if (products.length >= 12) break;
    } catch (_) { /* ignore */ }
  }

  // Pattern 3 – Inline JSON arrays that look like product lists
  // e.g. "products":[{"id":...,"price":...,"name":...}]
  const inlineMatches = html.matchAll(/"products"\s*:\s*(\[[\s\S]{10,}?\])/gi);
  for (const m of inlineMatches) {
    try {
      const arr = JSON.parse(m[1]);
      if (Array.isArray(arr) && arr.length > 0 && arr[0].price !== undefined) {
        const items = arr.flatMap(normaliseProduct).filter(Boolean);
        products.push(...items);
        if (products.length >= 12) break;
      }
    } catch (_) { /* ignore */ }
  }

  return products;
}

/**
 * Recursively search a parsed JSON object for arrays that look like product
 * listings (objects with price, name/title, and image fields).
 */
function findProductsInObject(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    // Check if this array looks like a product list
    if (obj.length > 0 && isProductLike(obj[0])) {
      return obj.flatMap(normaliseProduct).filter(Boolean);
    }
    // Recurse into array elements
    for (const item of obj.slice(0, 10)) {
      const result = findProductsInObject(item, depth + 1);
      if (result.length > 0) return result;
    }
  } else {
    for (const key of Object.keys(obj)) {
      const result = findProductsInObject(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  return [];
}

/** Heuristic: does an object look like a product? */
function isProductLike(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  const hasPrice = keys.some((k) => k.includes('price') || k.includes('precio'));
  const hasName  = keys.some((k) => k.includes('name') || k.includes('title') || k.includes('nombre'));
  return hasPrice && hasName;
}

/**
 * Normalise a raw product object (from any JSON structure) into
 * { title, price, thumbnail } or null if required fields are missing.
 */
function normaliseProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Title: try common field names
  const title =
    raw.name || raw.title || raw.nombre || raw.displayName || raw.productName || null;

  // Price: look for a numeric value
  const rawPrice =
    raw.price || raw.precio || raw.salePrice || raw.currentPrice ||
    raw.minPrice || (raw.prices && (raw.prices.sale || raw.prices.regular)) || null;
  const price = parsePrice(rawPrice);

  // Thumbnail: look for an image URL
  const thumbnail =
    raw.thumbnail || raw.image || raw.imageUrl || raw.img ||
    (raw.images && (raw.images[0] || raw.images.main || raw.images.thumbnail)) ||
    (Array.isArray(raw.images) ? raw.images[0] : null) || null;
  const thumbUrl = typeof thumbnail === 'string' ? thumbnail
    : (thumbnail && thumbnail.url) ? thumbnail.url : null;

  if (!title || !price || !thumbUrl) return null;
  return { title: String(title).trim(), price, thumbnail: thumbUrl };
}

/** Parse a price value that might be a number, string ("29,99"), or object */
function parsePrice(val) {
  if (!val && val !== 0) return null;
  if (typeof val === 'number') return val > 0 ? Math.round(val * 100) / 100 : null;
  if (typeof val === 'object') {
    const inner = val.value || val.amount || val.sale || val.regular || null;
    return parsePrice(inner);
  }
  // String: handle Spanish decimal notation (comma)
  const cleaned = String(val).replace(/[€$\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

/**
 * Fall back to HTML scraping with cheerio if JSON extraction finds nothing.
 * Uses the CSS selectors defined in the SELECTORS constant above.
 */
function extractFromHtml(html) {
  const $ = load(html);
  const products = [];

  $(SELECTORS.productCard).each((_, el) => {
    const $el = $(el);

    // Title
    const titleEl = $el.find(SELECTORS.title).first();
    const title = titleEl.text().trim() || titleEl.attr('title') || titleEl.attr('aria-label') || '';

    // Price – grab the first element whose text looks like a price
    let price = null;
    $el.find(SELECTORS.price).each((_, pEl) => {
      if (price !== null) return;
      const text = $(pEl).text().trim();
      price = parsePrice(text.replace(/[^\d,.\s]/g, '').trim());
    });

    // Thumbnail – prefer data-src (lazy-loading) over src
    const imgEl = $el.find(SELECTORS.thumbnail).first();
    const thumbnail = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-lazy') || '';

    if (title && price && thumbnail && thumbnail.startsWith('http')) {
      products.push({ title, price, thumbnail });
    }
  });

  return products;
}

// --------------- Main scraper ---------------

async function scrapeKeyword(keyword) {
  const url = searchUrl(keyword);
  console.log(`  → Fetching: ${url}`);

  let html;
  try {
    html = await fetchUrl(url);
  } catch (err) {
    console.warn(`  ✗ Failed to fetch "${keyword}": ${err.message}`);
    return [];
  }

  // First attempt: find product JSON embedded in script tags
  let products = extractFromScriptJson(html);
  if (products.length > 0) {
    console.log(`  ✓ Found ${products.length} products via embedded JSON for "${keyword}"`);
    return products;
  }

  // Second attempt: parse HTML product cards
  products = extractFromHtml(html);
  if (products.length > 0) {
    console.log(`  ✓ Found ${products.length} products via HTML scraping for "${keyword}"`);
    return products;
  }

  console.warn(`  ✗ No products found for "${keyword}" (site may require JavaScript rendering)`);
  return [];
}

async function main() {
  console.log('=== El Corte Inglés product scraper ===\n');

  const seen  = new Set();   // deduplicate by normalised title
  const all   = [];

  for (const keyword of SEARCH_KEYWORDS) {
    console.log(`Scraping category: "${keyword}"…`);
    const products = await scrapeKeyword(keyword);

    for (const p of products) {
      const key = p.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(p);
      }
    }

    console.log(`  Total unique products so far: ${all.length}`);

    if (all.length >= MIN_PRODUCTS) {
      console.log(`\nReached ${MIN_PRODUCTS} products – stopping early.\n`);
      break;
    }

    // Polite delay between requests (1–2 s) to avoid rate-limiting
    await sleep(1000 + Math.random() * 1000);
  }

  if (all.length === 0) {
    console.error(
      '\n✗ No products were scraped.\n' +
      '  El Corte Inglés may have changed their page structure or blocked the request.\n' +
      '  Options:\n' +
      '  1. Open DevTools on a search page and look for an XHR request that returns\n' +
      '     product JSON, then update searchUrl() to hit that endpoint directly.\n' +
      '  2. Update the CSS selectors in the SELECTORS object to match the new HTML.\n' +
      '  3. Switch to a Playwright-based approach for full JavaScript rendering.\n'
    );
    process.exit(1);
  }

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n✓ Wrote ${all.length} products to ${OUTPUT_FILE}`);

  if (all.length < MIN_PRODUCTS) {
    console.warn(
      `\n⚠ Only ${all.length} products scraped (target: ${MIN_PRODUCTS}).\n` +
      '  Consider adding more keywords or updating the selectors.'
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
