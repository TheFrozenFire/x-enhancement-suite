/**
 * MAIN world data collector: extracts React fiber data from tweet articles
 * and publishes it to the cache (which bridges to the ISOLATED world).
 *
 * This collector runs in the page's JS context where __reactFiber$ is accessible.
 */

import type { DataCollector, CacheService } from "../../plugin-types";

const LOG = "[XES:tweet-data]";
const DATA_ATTR = "data-xes-tweet-id";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let cache: CacheService | null = null;

function getFiberKey(): string | undefined {
  const el = document.querySelector("article[data-testid='tweet']");
  if (!el) return undefined;
  return Object.keys(el).find((k) => k.startsWith("__reactFiber"));
}

function findFiberProp(
  fiber: any,
  targetKey: string,
  depth = 0,
  maxDepth = 50
): any {
  if (!fiber || depth > maxDepth) return null;
  try {
    const props = fiber.memoizedProps;
    if (props && props[targetKey]) return props[targetKey];
  } catch {
    // Skip inaccessible fibers
  }
  return (
    findFiberProp(fiber.child, targetKey, depth + 1, maxDepth) ||
    findFiberProp(fiber.sibling, targetKey, depth + 1, maxDepth)
  );
}

function extractTweetData(article: HTMLElement): boolean {
  if (article.hasAttribute(DATA_ATTR)) return true;
  if (!cache) return false;

  const fiberKey = getFiberKey();
  if (!fiberKey) return false;

  const fiber = (article as any)[fiberKey];
  if (!fiber) return false;

  const tweet = findFiberProp(fiber, "tweet");
  if (!tweet) return false;

  const viewsCount = tweet.views?.count;

  const data = {
    id_str: tweet.id_str ?? "",
    favorite_count: tweet.favorite_count ?? 0,
    retweet_count: tweet.retweet_count ?? 0,
    reply_count: tweet.reply_count ?? 0,
    views_count: viewsCount != null ? parseInt(viewsCount, 10) : null,
    screen_name: tweet.user?.screen_name ?? "",
    following: !!tweet.user?.following,
    followed_by: !!tweet.user?.followed_by,
    in_reply_to_status_id_str: tweet.in_reply_to_status_id_str ?? null,
  };

  const tweetId = data.id_str || `dom-${Date.now()}`;
  article.setAttribute(DATA_ATTR, tweetId);
  cache.set("tweet-data", tweetId, data);
  return true;
}

function processArticles(root: Element | Document) {
  const articles = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    extractTweetData(article);
  }
}

const tweetData: DataCollector = {
  id: "tweet-data",
  name: "Tweet Data Extraction",
  description:
    "Extracts tweet engagement metrics and user data from React fiber internals",
  category: "Data Sources",
  defaultEnabled: true,
  world: "main",

  init(cacheService: CacheService) {
    cache = cacheService;
    console.log(LOG, "Init");

    processArticles(document);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.matches?.('article[data-testid="tweet"]')) {
              extractTweetData(node);
            } else {
              processArticles(node);
            }
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Periodic rescan for articles whose fiber data arrived after DOM insertion
    scanInterval = setInterval(() => processArticles(document), 500);
  },

  cleanup() {
    console.log(LOG, "Cleanup");
    observer?.disconnect();
    observer = null;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    cache = null;

    // Remove data attributes
    document
      .querySelectorAll<HTMLElement>(`[${DATA_ATTR}]`)
      .forEach((el) => el.removeAttribute(DATA_ATTR));
  },
};

export default tweetData;
