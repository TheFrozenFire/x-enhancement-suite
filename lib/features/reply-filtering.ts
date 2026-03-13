import type { Feature } from "../types";
import { getFeatureOption } from "../storage";
import { getTweetUserData, getTweetData, getLoggedInUsername } from "../tweet-utils";

const LOG = "[XES:reply-filter]";
const STYLE_ID = "xes-reply-filtering";
const MEDIA_MARKER = "data-xes-media-hidden";
const ENGAGEMENT_MARKER = "data-xes-low-engagement";
const SKIPPED_MARKER = "data-xes-reply-skipped";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;

// Options
let hideMedia = true;
let skipFollowedAndSelf = true;
let hideLowEngagement = true;
let engagementFactor = 0.05;
let minViewsThreshold = 10000;
let hideShortReplies = true;
let minWordCount = 10;

// Runtime state
let filtersVisible = false;
let filteredCount = 0;
let toggleBtn: HTMLElement | null = null;

// Cached focal tweet view count (per page)
let focalViews: number | null = null;
let lastPath = "";

function isFocalTweet(article: HTMLElement): boolean {
  return (
    !!article.querySelector('a[href*="/analytics"]') &&
    !!article.textContent?.includes("Views")
  );
}

function isReply(article: HTMLElement): boolean {
  if (isFocalTweet(article)) return false;

  if (window.location.pathname.includes("/status/")) return true;

  const spans = article.querySelectorAll("div > span");
  for (const span of spans) {
    if (span.textContent === "Replying to") return true;
  }
  return false;
}

function shouldSkip(article: HTMLElement): boolean {
  if (!skipFollowedAndSelf) return false;

  const userData = getTweetUserData(article);
  if (!userData) return false;

  const loggedIn = getLoggedInUsername();
  if (loggedIn && userData.screenName === loggedIn) return true;
  if (userData.following) return true;

  return false;
}

function parseAbbreviatedNumber(text: string): number | null {
  const match = text.match(/([\d.]+)\s*([KMB]?)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(num * multiplier);
}

function parseFocalViewsFromDOM(article: HTMLElement): number | null {
  const analyticsLink = article.querySelector<HTMLElement>('a[href*="/analytics"]');
  if (!analyticsLink) return null;
  const text = analyticsLink.textContent ?? "";
  return parseAbbreviatedNumber(text);
}

function cacheFocalViews() {
  const currentPath = window.location.pathname;

  // Reset cache only on actual path change
  if (currentPath !== lastPath) {
    console.log(LOG, "Path changed:", lastPath, "→", currentPath);
    lastPath = currentPath;
    focalViews = null;
    filteredCount = 0;
    toggleBtn?.remove();
    toggleBtn = null;
  }

  // Already cached
  if (focalViews !== null) return;

  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    if (isFocalTweet(article)) {
      // Try fiber data first (exact count)
      const tweetData = getTweetData(article);
      if (tweetData?.views_count != null) {
        focalViews = tweetData.views_count;
        console.log(LOG, "Cached focal views:", focalViews, "minLikes:", getMinLikes());
        return;
      }
      // Fallback: parse abbreviated count from DOM text
      const domViews = parseFocalViewsFromDOM(article);
      if (domViews !== null) {
        focalViews = domViews;
        console.log(LOG, "Cached focal views (DOM):", focalViews, "minLikes:", getMinLikes());
        return;
      }
      console.log(LOG, "Focal tweet found but views not available yet");
      return;
    }
  }
}

function getMinLikes(): number {
  if (focalViews === null || focalViews < minViewsThreshold) return 0;
  return Math.sqrt(focalViews) * engagementFactor;
}

function wrapMedia(article: HTMLElement) {
  if (article.hasAttribute(MEDIA_MARKER)) return;

  const mediaEl =
    article.querySelector<HTMLElement>('[data-testid="tweetPhoto"]') ??
    article.querySelector<HTMLElement>('[data-testid="videoPlayer"]');
  if (!mediaEl) return;

  article.setAttribute(MEDIA_MARKER, "true");

  let mediaContainer = mediaEl;
  while (
    mediaContainer.parentElement &&
    mediaContainer.parentElement !== article &&
    mediaContainer.parentElement.children.length === 1
  ) {
    mediaContainer = mediaContainer.parentElement;
  }

  const wrappingLink = mediaContainer.closest("a");
  if (wrappingLink && article.contains(wrappingLink)) {
    mediaContainer = wrappingLink;
  }

  mediaContainer.style.display = "none";

  const btn = document.createElement("button");
  btn.className = "xes-show-media-btn";
  btn.textContent = "Show media";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    mediaContainer.style.display = "";
    btn.remove();
  });

  mediaContainer.parentElement!.insertBefore(btn, mediaContainer);
}

function collapseReply(article: HTMLElement, reason: string) {
  if (article.hasAttribute(ENGAGEMENT_MARKER)) return;

  article.setAttribute(ENGAGEMENT_MARKER, "true");

  // Hide avatar
  const avatar = article.querySelector<HTMLElement>(
    '[data-testid="Tweet-User-Avatar"]'
  );
  if (avatar) avatar.classList.add("xes-collapse-hidden");

  const contentToHide: HTMLElement[] = [];
  const userName = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  if (!userName) {
    console.log(LOG, "collapseReply: no User-Name found");
    return;
  }

  // Hide display name (first child), keep handle row (second child) visible
  const displayNameRow = userName.children[0] as HTMLElement | undefined;
  if (displayNameRow) displayNameRow.classList.add("xes-collapse-hidden");

  // Walk up from User-Name to find the content column (has both User-Name and tweet content)
  let contentCol: HTMLElement | null = userName;
  while (contentCol && contentCol !== article) {
    const parent = contentCol.parentElement;
    if (!parent || parent === article) break;
    if (
      parent.querySelector('[data-testid="User-Name"]') &&
      (parent.querySelector('[data-testid="tweetText"]') ||
       parent.querySelector('[data-testid="reply"]'))
    ) {
      // Hide everything after the User-Name row
      let foundUserRow = false;
      for (const child of parent.children) {
        if (!foundUserRow) {
          if (
            child.querySelector('[data-testid="User-Name"]') ||
            (child as HTMLElement).dataset?.testid === "User-Name"
          ) {
            foundUserRow = true;
          }
          continue;
        }
        contentToHide.push(child as HTMLElement);
      }
      break;
    }
    contentCol = parent;
  }

  if (contentToHide.length === 0) {
    console.log(LOG, "collapseReply: no content found to hide");
    return;
  }

  console.log(LOG, "Collapsing reply:", reason, "hiding", contentToHide.length, "elements");

  for (const node of contentToHide) {
    node.classList.add("xes-collapse-hidden");
  }

  // Insert inline "Show Reply (XX)" button next to the timestamp
  const timeEl = article.querySelector("time");
  const timeContainer = timeEl?.closest("a")?.parentElement;
  if (!timeContainer) {
    console.log(LOG, "collapseReply: no time container found");
    return;
  }

  const btn = document.createElement("button");
  btn.className = "xes-show-reply-btn";
  btn.innerHTML = `Show Reply <span class="xes-collapse-reason">(${reason})</span>`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (avatar) avatar.classList.remove("xes-collapse-hidden");
    if (displayNameRow) displayNameRow.classList.remove("xes-collapse-hidden");
    for (const node of contentToHide) {
      node.classList.remove("xes-collapse-hidden");
    }
    btn.remove();
    article.setAttribute(ENGAGEMENT_MARKER, "revealed");
  });

  timeContainer.parentElement!.insertBefore(btn, timeContainer.nextSibling);

  filteredCount++;
  updateToggleButton();
}

function updateToggleButton() {
  if (toggleBtn) {
    toggleBtn.textContent = filtersVisible
      ? `Hide Filtered Replies (${filteredCount})`
      : `Show Filtered Replies (${filteredCount})`;
  }
}

function insertToggleButton() {
  if (!window.location.pathname.includes("/status/")) return;

  // Already in DOM — nothing to do
  if (toggleBtn?.isConnected) return;

  // Find the focal tweet's cell and append button inside it.
  // X uses position:absolute + translateY on each cellInnerDiv,
  // so inserting a sibling would float to the container top.
  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  let focalCell: HTMLElement | null = null;
  for (const article of articles) {
    if (isFocalTweet(article)) {
      focalCell = article.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
      break;
    }
  }
  if (!focalCell) return;

  // Reuse existing button element to preserve state, or create new one
  if (!toggleBtn) {
    toggleBtn = document.createElement("div");
    toggleBtn.className = "xes-toggle-filtered-btn";
    toggleBtn.setAttribute("role", "button");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      filtersVisible = !filtersVisible;
      document.body.classList.toggle("xes-show-filtered", filtersVisible);
      updateToggleButton();
    });
  }
  updateToggleButton();

  focalCell.appendChild(toggleBtn);
  console.log(LOG, "Inserted toggle button inside focal cell");
}

function processArticle(article: HTMLElement) {
  if (article.hasAttribute(SKIPPED_MARKER)) return;
  if (!isReply(article)) {
    if (isFocalTweet(article)) cacheFocalViews();
    return;
  }

  // Bridge data may not be available yet — skip silently and retry later
  const userData = getTweetUserData(article);
  if (!userData) return;

  if (shouldSkip(article)) {
    console.log(LOG, "Skipping (followed/self):", userData.screenName);
    article.setAttribute(SKIPPED_MARKER, "true");
    return;
  }

  if (hideMedia) wrapMedia(article);

  if (article.hasAttribute(ENGAGEMENT_MARKER)) return;

  const reasons: string[] = [];

  if (hideLowEngagement) {
    cacheFocalViews();
    const minLikes = getMinLikes();
    if (minLikes > 0) {
      const tweetData = getTweetData(article);
      if (tweetData && tweetData.favorite_count < minLikes) {
        console.log(LOG, "LE:", userData.screenName, "likes:", tweetData.favorite_count, "< threshold:", Math.ceil(minLikes));
        reasons.push("LE");
      }
    }
  }

  if (hideShortReplies) {
    const tweetText = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
    const text = tweetText?.textContent?.trim() ?? "";
    const wordCount = text ? text.split(/\s+/).length : 0;
    if (wordCount < minWordCount) {
      console.log(LOG, "LWC:", userData.screenName, `${wordCount} words < ${minWordCount}`);
      reasons.push("LWC");
    }
  }

  if (reasons.length > 0) {
    collapseReply(article, reasons.join(", "));
  }
}

function processNodes(root: Element | Document) {
  // Process media elements that may have loaded after their articles
  const mediaEls = root.querySelectorAll<HTMLElement>(
    '[data-testid="tweetPhoto"], [data-testid="videoPlayer"]'
  );
  for (const el of mediaEls) {
    const article = el.closest<HTMLElement>('article[data-testid="tweet"]');
    if (article) processArticle(article);
  }

  const articles = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    processArticle(article);
  }

  insertToggleButton();
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .xes-show-media-btn {
      display: block;
      width: 100%;
      padding: 12px;
      margin: 4px 0;
      border: 1px solid rgb(56, 68, 77);
      border-radius: 16px;
      background: transparent;
      color: rgb(139, 152, 165);
      font-size: 14px;
      cursor: pointer;
      text-align: center;
    }
    .xes-show-media-btn:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .xes-show-reply-btn {
      border: none;
      background: transparent;
      color: rgb(139, 152, 165);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      padding: 0;
      margin-left: 4px;
    }
    .xes-show-reply-btn:hover {
      text-decoration: underline;
    }
    .xes-collapse-reason {
      font-weight: 400;
    }
    .xes-collapse-hidden {
      display: none !important;
    }
    /* Hide entire cell containing a filtered reply unless toggle is active */
    body:not(.xes-show-filtered) [data-testid="cellInnerDiv"]:has([data-xes-low-engagement="true"]) {
      display: none !important;
    }
    .xes-toggle-filtered-btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border: none;
      border-bottom: 1px solid rgb(56, 68, 77);
      background: transparent;
      color: rgb(29, 155, 240);
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }
    .xes-toggle-filtered-btn:hover {
      background: rgba(29, 155, 240, 0.1);
    }
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

function cleanupAll() {
  console.log(LOG, "Cleanup");
  observer?.disconnect();
  observer = null;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  removeStyles();

  // Restore media-hidden articles
  document
    .querySelectorAll<HTMLElement>(`[${MEDIA_MARKER}]`)
    .forEach((article) => {
      article.removeAttribute(MEDIA_MARKER);
      article
        .querySelectorAll<HTMLElement>(".xes-show-media-btn")
        .forEach((btn) => btn.remove());
      article
        .querySelectorAll<HTMLElement>('[style*="display: none"]')
        .forEach((el) => {
          if (
            el.querySelector('[data-testid="tweetPhoto"]') ||
            el.querySelector('[data-testid="videoPlayer"]')
          ) {
            el.style.display = "";
          }
        });
    });

  // Restore collapsed articles
  document
    .querySelectorAll<HTMLElement>(`[${ENGAGEMENT_MARKER}]`)
    .forEach((article) => {
      article.removeAttribute(ENGAGEMENT_MARKER);
      article
        .querySelectorAll<HTMLElement>(".xes-show-reply-btn")
        .forEach((btn) => btn.remove());
      article
        .querySelectorAll<HTMLElement>(".xes-collapse-hidden")
        .forEach((el) => el.classList.remove("xes-collapse-hidden"));
    });

  // Clear skipped markers
  document
    .querySelectorAll<HTMLElement>(`[${SKIPPED_MARKER}]`)
    .forEach((article) => article.removeAttribute(SKIPPED_MARKER));

  // Remove toggle button and body class
  document.body.classList.remove("xes-show-filtered");
  toggleBtn?.remove();
  toggleBtn = null;
  filteredCount = 0;
  filtersVisible = false;

  focalViews = null;
  lastPath = "";
}

export const replyFiltering: Feature = {
  id: "reply-filtering",
  name: "Reply Filtering",
  description:
    "Filter and collapse low-quality replies on tweet threads",
  category: "Replies",
  defaultEnabled: true,
  options: [
    {
      id: "hide-media",
      label: "Hide media in replies",
      description:
        "Collapse images, videos, and GIFs in reply tweets behind a toggle",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-low-engagement",
      label: "Hide low-engagement replies",
      description:
        "Collapse replies that don't meet a minimum like threshold relative to the post's views",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "skip-followed-and-self",
      label: "Skip people I follow and myself",
      description:
        "Don't filter replies from accounts you follow or your own replies",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "engagement-factor",
      label: "Engagement threshold factor",
      description:
        "Factor in min_likes = sqrt(views) × factor. Higher = stricter filtering",
      type: "number",
      defaultValue: 0.05,
      min: 0.01,
      max: 1.0,
      step: 0.01,
    },
    {
      id: "min-views-threshold",
      label: "Minimum post views to activate",
      description:
        "Don't filter replies until the top-level post has at least this many views",
      type: "number",
      defaultValue: 10000,
      min: 1000,
      max: 1000000,
      step: 1000,
    },
    {
      id: "hide-short-replies",
      label: "Hide short replies",
      description:
        "Collapse replies with fewer words than the minimum word count",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "min-word-count",
      label: "Minimum word count",
      description:
        "Replies with fewer words than this will be collapsed",
      type: "number",
      defaultValue: 10,
      min: 1,
      max: 100,
      step: 1,
    },
  ],
  contentScript: {
    async init() {
      const fid = "reply-filtering";
      hideMedia = await getFeatureOption(fid, "hide-media", true);
      hideLowEngagement = await getFeatureOption(
        fid,
        "hide-low-engagement",
        true
      );
      skipFollowedAndSelf = await getFeatureOption(
        fid,
        "skip-followed-and-self",
        true
      );
      engagementFactor = await getFeatureOption(
        fid,
        "engagement-factor",
        0.05
      );
      minViewsThreshold = await getFeatureOption(
        fid,
        "min-views-threshold",
        10000
      );

      hideShortReplies = await getFeatureOption(fid, "hide-short-replies", true);
      minWordCount = await getFeatureOption(fid, "min-word-count", 10);

      console.log(LOG, "Init:", { hideMedia, hideLowEngagement, hideShortReplies, skipFollowedAndSelf, engagementFactor, minViewsThreshold, minWordCount });

      injectStyles();
      processNodes(document);

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement) {
              processNodes(node);
            }
          }
          if (m.type === "attributes" && m.target instanceof HTMLElement) {
            const article = m.target.closest<HTMLElement>(
              'article[data-testid="tweet"]'
            );
            if (article) processArticle(article);
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-testid", "data-xes-tweet-data"],
      });

      scanInterval = setInterval(() => processNodes(document), 1000);
    },
    cleanup: cleanupAll,
  },
};
