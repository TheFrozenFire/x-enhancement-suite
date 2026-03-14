/**
 * Automatically expands "Show more" on the focal tweet author's self-reply chain.
 *
 * On status pages, the OP often replies to themselves in a thread. X truncates
 * long tweets with a "Show more" button. This plugin clicks those buttons
 * automatically so the full thread content is visible without manual interaction.
 */

import type { BehaviorPlugin, CacheService } from "../plugin-types";

const LOG = "[XES:auto-show-more]";
const MARKER = "data-xes-auto-expanded";
const TWEET_ID_ATTR = "data-xes-tweet-id";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let cache: CacheService | null = null;
let focalAuthor: string | null = null;
let lastPath = "";

interface TweetCacheData {
  screen_name: string;
}

function resetForPath() {
  const currentPath = window.location.pathname;
  if (currentPath === lastPath) return;
  console.log(LOG, "Path changed:", lastPath, "→", currentPath);
  lastPath = currentPath;
  focalAuthor = null;
}

function findFocalAuthor(): string | null {
  if (focalAuthor) return focalAuthor;
  if (!cache) return null;
  if (!window.location.pathname.includes("/status/")) return null;

  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    // Focal tweet has an analytics link and "Views" text
    if (
      article.querySelector('a[href*="/analytics"]') &&
      article.textContent?.includes("Views")
    ) {
      const tweetId = article.getAttribute(TWEET_ID_ATTR);
      if (!tweetId) return null;
      const data = cache.get<TweetCacheData>("tweet-data", tweetId);
      if (data?.screen_name) {
        focalAuthor = data.screen_name;
        console.log(LOG, "Focal author:", focalAuthor);
        return focalAuthor;
      }
      return null;
    }
  }
  return null;
}

function expandShowMore() {
  resetForPath();
  const author = findFocalAuthor();
  if (!author || !cache) return;

  const buttons = document.querySelectorAll<HTMLElement>(
    '[data-testid="tweet-text-show-more-link"]'
  );
  for (const btn of buttons) {
    const article = btn.closest<HTMLElement>('article[data-testid="tweet"]');
    if (!article) continue;
    if (article.hasAttribute(MARKER)) continue;

    const tweetId = article.getAttribute(TWEET_ID_ATTR);
    if (!tweetId) continue;

    const data = cache.get<TweetCacheData>("tweet-data", tweetId);
    if (!data || data.screen_name !== author) continue;

    console.log(LOG, "Expanding show-more for", author, "tweet:", tweetId);
    article.setAttribute(MARKER, "true");
    btn.click();
  }
}

const autoShowMore: BehaviorPlugin = {
  id: "auto-show-more",
  name: "Auto Show More",
  description:
    "Automatically expands truncated tweets in the focal author's self-reply chain",
  category: "Reading",
  defaultEnabled: true,
  depends: ["tweet-data"],

  init(cacheService: CacheService) {
    cache = cacheService;
    console.log(LOG, "Init");

    expandShowMore();

    cache.on("tweet-data", () => {
      expandShowMore();
    });

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.querySelector('[data-testid="tweet-text-show-more-link"]') ||
              node.matches?.('[data-testid="tweet-text-show-more-link"]'))
          ) {
            expandShowMore();
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    scanInterval = setInterval(expandShowMore, 1000);
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
    focalAuthor = null;
    lastPath = "";
    // Markers are harmless to leave — expanded text can't be re-collapsed
  },
};

export default autoShowMore;
