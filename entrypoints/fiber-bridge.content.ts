/**
 * MAIN world content script that extracts React fiber data from tweet articles
 * and exposes it as data attributes readable by the ISOLATED world content script.
 *
 * This bridge is needed because MV3 content scripts run in an isolated world
 * and cannot access page-script properties like __reactFiber$.
 */

const LOG = "[XES:fiber-bridge]";
const DATA_ATTR = "data-xes-tweet-data";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;

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
  };

  article.setAttribute(DATA_ATTR, JSON.stringify(data));
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

export default defineContentScript({
  matches: ["*://*.x.com/*", "*://*.twitter.com/*"],
  world: "MAIN",
  runAt: "document_idle",
  async main() {
    console.log(LOG, "Init");

    processArticles(document);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            // Check if the added node is or contains an article
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

    // Periodic rescan to catch articles whose fiber data was set after initial DOM insertion
    scanInterval = setInterval(() => processArticles(document), 500);
  },
});
