import type { BehaviorPlugin, CacheService } from "../plugin-types";

const LOG = "[XES:quick-downvote]";
const MARKER = "data-xes-downvote";
const STYLE_ID = "xes-quick-downvote";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let cache: CacheService | null = null;

function waitForElement(
  root: Element | Document,
  selector: string,
  timeout = 5000
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = root.querySelector<HTMLElement>(selector);
    if (existing) return resolve(existing);

    const timer = setTimeout(() => {
      obs.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);

    const obs = new MutationObserver(() => {
      const el = root.querySelector<HTMLElement>(selector);
      if (el) {
        clearTimeout(timer);
        obs.disconnect();
        resolve(el);
      }
    });
    obs.observe(root instanceof Document ? root.body : root, {
      childList: true,
      subtree: true,
    });
  });
}

function findMenuItemByText(text: string): HTMLElement | null {
  const menuItems = document.querySelectorAll<HTMLElement>(
    '[role="menuitem"]'
  );
  for (const item of menuItems) {
    if (item.textContent?.includes(text)) return item;
  }
  return null;
}

async function runDownvote(article: HTMLElement) {
  const caret = article.querySelector<HTMLElement>('[data-testid="caret"]');
  if (!caret) {
    console.error(LOG, "No caret button found");
    return;
  }

  console.log(LOG, "Opening menu");
  caret.click();

  try {
    await waitForElement(document, '[role="menuitem"]');
    // Small delay for all items to render
    await new Promise((r) => setTimeout(r, 200));

    const notInterested = findMenuItemByText("Not interested in this post");
    if (notInterested) {
      console.log(LOG, "Clicking 'Not interested in this post'");
      notInterested.click();
    } else {
      console.error(LOG, "Could not find 'Not interested' menu item");
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    }
  } catch (err) {
    console.error(LOG, "Downvote flow failed:", err);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  }
}

function isReply(article: HTMLElement): boolean {
  // Focal tweets have an analytics link — never a reply
  if (
    article.querySelector('a[href*="/analytics"]') &&
    article.textContent?.includes("Views")
  ) {
    return false;
  }
  // On thread pages, non-focal articles are replies
  if (/\/status\//.test(window.location.pathname)) {
    return true;
  }
  // On timeline pages, check tweet-data cache for in_reply_to
  const tweetId = article.getAttribute("data-xes-tweet-id");
  if (tweetId && cache) {
    const data = cache.get<{ in_reply_to_status_id_str: string | null }>(
      "tweet-data",
      tweetId
    );
    if (data?.in_reply_to_status_id_str) {
      return true;
    }
  }
  return false;
}

function addDownvoteButton(article: HTMLElement) {
  if (article.hasAttribute(MARKER)) return;
  article.setAttribute(MARKER, "true");

  // Skip replies — only show on posts
  if (isReply(article)) return;

  // Skip focal tweets (own posts with analytics)
  if (
    article.querySelector('a[href*="/analytics"]') &&
    article.textContent?.includes("Views")
  ) {
    return;
  }

  const likeBtn =
    article.querySelector('[data-testid="like"]') ??
    article.querySelector('[data-testid="unlike"]');
  if (!likeBtn) return;

  const actionGroup = likeBtn.closest<HTMLElement>('[role="group"]');
  if (!actionGroup) return;

  const likeWrapper = likeBtn.closest<HTMLElement>('[role="group"] > *');
  if (!likeWrapper) return;

  const btn = document.createElement("button");
  btn.className = "xes-downvote-btn";
  btn.type = "button";
  btn.title = "Not interested";
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" fill="currentColor"/></svg>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    runDownvote(article);
  });

  // Insert after the like button wrapper
  actionGroup.insertBefore(btn, likeWrapper.nextSibling);
}

function processArticles(root: Element | Document) {
  const articles = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    addDownvoteButton(article);
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .xes-downvote-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 8px;
      margin-right: 24px;
      border-radius: 9999px;
      opacity: 0.4;
      transition: opacity 0.15s, filter 0.15s, background-color 0.15s;
      line-height: 0;
      filter: grayscale(1);
      color: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .xes-downvote-btn:hover {
      opacity: 1;
      filter: grayscale(0);
      background: rgba(244, 33, 46, 0.1);
      color: rgb(244, 33, 46);
    }
  `;
  document.head.appendChild(style);
}

function cleanupAll() {
  console.log(LOG, "Cleanup");
  observer?.disconnect();
  observer = null;
  cache = null;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  document.getElementById(STYLE_ID)?.remove();
  document
    .querySelectorAll<HTMLElement>(`[${MARKER}]`)
    .forEach((el) => {
      el.removeAttribute(MARKER);
      el.querySelectorAll(".xes-downvote-btn").forEach((btn) => btn.remove());
    });
}

const quickDownvote: BehaviorPlugin = {
  id: "quick-downvote",
  name: "Quick Downvote",
  description:
    "Adds a downvote button to posts that triggers 'Not interested in this post'",
  category: "Timeline",
  defaultEnabled: true,
  depends: ["tweet-data"],

  async init(_cache: CacheService) {
    console.log(LOG, "Init");
    cache = _cache;
    injectStyles();
    processArticles(document);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            processArticles(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    scanInterval = setInterval(() => processArticles(document), 2000);
  },

  cleanup: cleanupAll,
};

export default quickDownvote;
