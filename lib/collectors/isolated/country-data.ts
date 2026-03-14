/**
 * ISOLATED world data collector: iframe-based country lookup.
 *
 * Loads a user's /about page in a hidden iframe to scrape
 * "Account based in [country]" text. Results are published to the
 * cache and persisted with a 7-day TTL.
 *
 * Requires declarativeNetRequest to strip X-Frame-Options headers.
 */

import type { DataCollector, CacheService } from "../../plugin-types";
import { countryCache } from "../../storage";
import type { CountryCacheEntry } from "../../types";

const LOG = "[XES:country-data]";
const IFRAME_TIMEOUT = 15_000;
const POLL_INTERVAL = 500;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const pendingLookups = new Map<string, Promise<string | null>>();
const memoryCache = new Map<string, string>();

let cache: CacheService | null = null;

/**
 * Demand-driven country lookup. Called by behavior plugins that need
 * country data for a given screen name.
 */
export async function lookupCountry(
  screenName: string
): Promise<string | null> {
  const key = screenName.toLowerCase();

  // In-memory cache (fast path)
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  // Persistent cache
  const cached = await getCachedCountry(key);
  if (cached !== null) {
    memoryCache.set(key, cached);
    if (cache) cache.set("country-data", key, cached);
    return cached;
  }

  // Deduplicate concurrent lookups for the same user
  if (pendingLookups.has(key)) return pendingLookups.get(key)!;

  const promise = doLookup(screenName, key);
  pendingLookups.set(key, promise);

  try {
    const result = await promise;
    if (result) {
      memoryCache.set(key, result);
      await setCachedCountry(key, result);
      if (cache) cache.set("country-data", key, result);
    }
    return result;
  } finally {
    pendingLookups.delete(key);
  }
}

export function getCachedCountrySync(screenName: string): string | null {
  return memoryCache.get(screenName.toLowerCase()) ?? null;
}

async function getCachedCountry(key: string): Promise<string | null> {
  const cacheData = await countryCache.getValue();
  const entry = cacheData[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) return null;
  return entry.country;
}

async function setCachedCountry(
  key: string,
  country: string
): Promise<void> {
  const cacheData = await countryCache.getValue();
  cacheData[key] = { country, fetchedAt: Date.now() };
  await countryCache.setValue(cacheData);
}

async function doLookup(
  screenName: string,
  _key: string
): Promise<string | null> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;";
  iframe.name = "xes-iframe";
  iframe.src = `https://x.com/${screenName}/about#xes-iframe`;

  document.body.appendChild(iframe);
  console.log(LOG, "Loading /about for", screenName);

  try {
    return await waitForCountryData(iframe);
  } catch (err) {
    console.log(LOG, "Lookup failed for", screenName, err);
    return null;
  } finally {
    iframe.remove();
  }
}

function waitForCountryData(
  iframe: HTMLIFrameElement
): Promise<string | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      clearInterval(poll);
      console.log(LOG, "Timeout waiting for country data");
      resolve(null);
    }, IFRAME_TIMEOUT);

    let poll: ReturnType<typeof setInterval>;

    iframe.addEventListener("load", () => {
      poll = setInterval(() => {
        try {
          const doc = iframe.contentDocument;
          if (!doc?.body) return;

          const spans = doc.querySelectorAll("span");
          for (const span of spans) {
            if (span.textContent?.trim() === "Account based in") {
              let el: HTMLElement | null = span as HTMLElement;
              for (let i = 0; i < 5 && el; i++) {
                el = el.parentElement;
                const full = el?.textContent ?? "";
                const match = full.match(/Account based in\s*(.+)/);
                if (match && match[1].trim().length > 0) {
                  clearInterval(poll);
                  clearTimeout(timeout);
                  const country = match[1].trim();
                  console.log(LOG, "Found country:", country);
                  resolve(country);
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.log(LOG, "poll error:", err);
        }
      }, POLL_INTERVAL);
    });

    iframe.addEventListener("error", () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

const countryData: DataCollector = {
  id: "country-data",
  name: "Country Data Lookup",
  description:
    "Looks up account country via iframe-based /about page scraping",
  category: "Data Sources",
  defaultEnabled: true,
  world: "isolated",

  init(cacheService: CacheService) {
    cache = cacheService;
    console.log(LOG, "Init");

    // Pre-populate cache with any existing memory cache entries
    for (const [key, country] of memoryCache) {
      cache.set("country-data", key, country);
    }
  },

  cleanup() {
    console.log(LOG, "Cleanup");
    cache = null;
  },
};

export default countryData;
