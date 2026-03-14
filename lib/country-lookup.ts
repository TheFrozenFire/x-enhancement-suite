/**
 * Iframe-based country data lookup.
 *
 * Loads a user's /about page in a hidden iframe to trigger X's
 * AboutAccountQuery, then scrapes the "Account based in [country]"
 * text from the rendered DOM.
 *
 * Requires declarativeNetRequest to strip X-Frame-Options: DENY.
 */

import { countryCache } from "./storage";
import type { CountryCacheEntry } from "./types";

const LOG = "[XES:country-lookup]";
const IFRAME_TIMEOUT = 15_000;
const POLL_INTERVAL = 500;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const pendingLookups = new Map<string, Promise<string | null>>();
const memoryCache = new Map<string, string>();

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
  const cache = await countryCache.getValue();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL) return null;
  return entry.country;
}

async function setCachedCountry(key: string, country: string): Promise<void> {
  const cache = await countryCache.getValue();
  cache[key] = { country, fetchedAt: Date.now() };
  await countryCache.setValue(cache);
}

async function doLookup(
  screenName: string,
  key: string
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

          // "Account based in" and country name are in separate child
          // elements, so find the span with the label and read the
          // parent's full textContent.
          const spans = doc.querySelectorAll("span");
          for (const span of spans) {
            if (span.textContent?.trim() === "Account based in") {
              // The country name is in a sibling element; walk up
              // until we find a container whose textContent includes
              // both the label and the country name.
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
