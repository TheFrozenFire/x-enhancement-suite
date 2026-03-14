import type { BehaviorPlugin, CacheService } from "../plugin-types";
import type { AiClassifier } from "../ai/types";
import { getFeatureOption } from "../storage";
import {
  lookupCountry,
  getCachedCountrySync,
} from "../collectors/isolated/country-data";

// Auto-discover AI classifiers for acronym metadata
const classifierModules = import.meta.glob<{ default: AiClassifier }>(
  "../ai/classifiers/*.ts",
  { eager: true }
);
const aiClassifiers: AiClassifier[] = Object.values(classifierModules).map(
  (m) => m.default
);

const LOG = "[XES:reply-filter]";
const STYLE_ID = "xes-reply-filtering";
const MEDIA_MARKER = "data-xes-media-hidden";
const ENGAGEMENT_MARKER = "data-xes-low-engagement";
const SKIPPED_MARKER = "data-xes-reply-skipped";
const HOVER_MARKER = "data-xes-hover-bound";
const COUNTRY_MARKER = "data-xes-country";
const TWEET_ID_ATTR = "data-xes-tweet-id";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let cache: CacheService | null = null;

// Options
let hideMedia = true;
let skipFollowedAndSelf = true;
let hideLowEngagement = true;
let engagementFactor = 0.05;
let minViewsThreshold = 10000;
let hideShortReplies = true;
let minWordCount = 10;
let filterByCountry = false;
let allowedCountries = "";

// Runtime state
let filtersVisible = false;
let filteredCount = 0;
let toggleBtn: HTMLElement | null = null;

// Cached focal tweet data (per page)
let focalViews: number | null = null;
let focalAuthor: string | null = null;
let opRepliedToIds = new Set<string>();
let lastPath = "";

interface TweetCacheData {
  id_str: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number | null;
  screen_name: string;
  following: boolean;
  followed_by: boolean;
  in_reply_to_status_id_str: string | null;
}

function getTweetDataFromCache(
  article: HTMLElement
): TweetCacheData | null {
  if (!cache) return null;
  const tweetId = article.getAttribute(TWEET_ID_ATTR);
  if (!tweetId) return null;
  return cache.get<TweetCacheData>("tweet-data", tweetId) ?? null;
}

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

function getLoggedInUsername(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="AppTabBar_Profile_Link"]'
  );
  return link?.getAttribute("href")?.replace("/", "") ?? null;
}

function shouldSkip(data: TweetCacheData): boolean {
  if (!skipFollowedAndSelf) return false;

  const loggedIn = getLoggedInUsername();
  if (loggedIn && data.screen_name === loggedIn) return true;
  if (data.following) return true;

  return false;
}

function parseAbbreviatedNumber(text: string): number | null {
  const match = text.match(/([\d.]+)\s*([KMB]?)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  const multiplier =
    suffix === "K"
      ? 1_000
      : suffix === "M"
        ? 1_000_000
        : suffix === "B"
          ? 1_000_000_000
          : 1;
  return Math.round(num * multiplier);
}

function parseFocalViewsFromDOM(article: HTMLElement): number | null {
  const analyticsLink = article.querySelector<HTMLElement>(
    'a[href*="/analytics"]'
  );
  if (!analyticsLink) return null;
  const text = analyticsLink.textContent ?? "";
  return parseAbbreviatedNumber(text);
}

function cacheFocalViews() {
  const currentPath = window.location.pathname;

  if (currentPath !== lastPath) {
    console.log(LOG, "Path changed:", lastPath, "→", currentPath);
    lastPath = currentPath;
    focalViews = null;
    focalAuthor = null;
    opRepliedToIds.clear();
    filteredCount = 0;
    toggleBtn?.remove();
    toggleBtn = null;
  }

  if (focalViews !== null) return;

  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    if (isFocalTweet(article)) {
      // Try cache data first (exact count)
      const tweetData = getTweetDataFromCache(article);
      if (tweetData?.views_count != null) {
        focalViews = tweetData.views_count;
        focalAuthor = tweetData.screen_name || null;
        console.log(
          LOG,
          "Cached focal views:",
          focalViews,
          "author:",
          focalAuthor,
          "minLikes:",
          getMinLikes()
        );
        rebuildOpRepliedToIds();
        return;
      }
      // Fallback: parse abbreviated count from DOM text
      const domViews = parseFocalViewsFromDOM(article);
      if (domViews !== null) {
        focalViews = domViews;
        console.log(
          LOG,
          "Cached focal views (DOM):",
          focalViews,
          "minLikes:",
          getMinLikes()
        );
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

/**
 * Scan all cached tweet data to find tweets by the focal author (OP)
 * that are replies to other tweets. Those replied-to tweet IDs are
 * collected so we can skip filtering on them.
 */
function rebuildOpRepliedToIds() {
  if (!cache || !focalAuthor) return;

  opRepliedToIds.clear();
  const allTweets = cache.getAll<TweetCacheData>("tweet-data");
  for (const [, tweet] of allTweets) {
    if (
      tweet.screen_name === focalAuthor &&
      tweet.in_reply_to_status_id_str
    ) {
      opRepliedToIds.add(tweet.in_reply_to_status_id_str);
    }
  }

  if (opRepliedToIds.size > 0) {
    console.log(LOG, "OP replied to tweet IDs:", [...opRepliedToIds]);
  }
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

  const avatar = article.querySelector<HTMLElement>(
    '[data-testid="Tweet-User-Avatar"]'
  );
  if (avatar) avatar.classList.add("xes-collapse-hidden");

  const contentToHide: HTMLElement[] = [];
  const userName = article.querySelector<HTMLElement>(
    '[data-testid="User-Name"]'
  );
  if (!userName) {
    console.log(LOG, "collapseReply: no User-Name found");
    return;
  }

  const displayNameRow = userName.children[0] as HTMLElement | undefined;
  if (displayNameRow) displayNameRow.classList.add("xes-collapse-hidden");

  let contentCol: HTMLElement | null = userName;
  while (contentCol && contentCol !== article) {
    const parent: HTMLElement | null = contentCol.parentElement;
    if (!parent || parent === article) break;
    if (
      parent.querySelector('[data-testid="User-Name"]') &&
      (parent.querySelector('[data-testid="tweetText"]') ||
        parent.querySelector('[data-testid="reply"]'))
    ) {
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

  console.log(
    LOG,
    "Collapsing reply:",
    reason,
    "hiding",
    contentToHide.length,
    "elements"
  );

  for (const node of contentToHide) {
    node.classList.add("xes-collapse-hidden");
  }

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
    if (displayNameRow)
      displayNameRow.classList.remove("xes-collapse-hidden");
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

function uncollapseReply(article: HTMLElement) {
  console.log(LOG, "Uncollapsing previously filtered reply");
  article.removeAttribute(ENGAGEMENT_MARKER);
  article
    .querySelectorAll<HTMLElement>(".xes-show-reply-btn")
    .forEach((btn) => btn.remove());
  article
    .querySelectorAll<HTMLElement>(".xes-collapse-hidden")
    .forEach((el) => el.classList.remove("xes-collapse-hidden"));
  filteredCount = Math.max(0, filteredCount - 1);
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

  if (toggleBtn?.isConnected) return;

  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  let focalCell: HTMLElement | null = null;
  for (const article of articles) {
    if (isFocalTweet(article)) {
      focalCell = article.closest<HTMLElement>(
        '[data-testid="cellInnerDiv"]'
      );
      break;
    }
  }
  if (!focalCell) return;

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

function bindHoverLookup(article: HTMLElement, screenName: string) {
  if (article.hasAttribute(HOVER_MARKER)) return;
  article.setAttribute(HOVER_MARKER, "true");

  let hoverTimer: ReturnType<typeof setTimeout> | null = null;

  article.addEventListener("mouseenter", () => {
    if (getCachedCountrySync(screenName)) return;

    hoverTimer = setTimeout(() => {
      lookupCountry(screenName).then((country) => {
        if (country) {
          article.setAttribute(COUNTRY_MARKER, country);
          applyCountryFilter(article, screenName, country);
        }
      });
    }, 300);
  });

  article.addEventListener("mouseleave", () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  });
}

function applyCountryFilter(
  article: HTMLElement,
  screenName: string,
  country: string
) {
  if (!filterByCountry) return;
  if (article.getAttribute(ENGAGEMENT_MARKER) === "revealed") return;

  const allowed = allowedCountries
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return;

  if (!allowed.includes(country.toLowerCase())) {
    console.log(
      LOG,
      "FC:",
      screenName,
      "country:",
      country,
      "not in allowed list"
    );
    if (article.hasAttribute(ENGAGEMENT_MARKER)) {
      const btn = article.querySelector<HTMLElement>(
        ".xes-show-reply-btn .xes-collapse-reason"
      );
      if (btn) {
        const current = btn.textContent?.replace(/[()]/g, "") ?? "";
        if (!current.includes("FC")) {
          btn.textContent = `(${current}, FC)`;
        }
      }
    } else {
      collapseReply(article, "FC");
    }
  }
}

function processArticle(article: HTMLElement) {
  if (article.hasAttribute(SKIPPED_MARKER)) return;
  if (!isReply(article)) {
    if (isFocalTweet(article)) cacheFocalViews();
    return;
  }

  // Get tweet data from cache
  const tweetData = getTweetDataFromCache(article);
  if (!tweetData) return;

  if (shouldSkip(tweetData)) {
    console.log(LOG, "Skipping (followed/self):", tweetData.screen_name);
    article.setAttribute(SKIPPED_MARKER, "true");
    return;
  }

  // Skip replies that the OP replied to
  if (opRepliedToIds.has(tweetData.id_str)) {
    console.log(LOG, "Skipping (OP replied):", tweetData.screen_name);
    article.setAttribute(SKIPPED_MARKER, "true");
    // Reverse any existing collapse
    if (article.hasAttribute(ENGAGEMENT_MARKER)) {
      uncollapseReply(article);
    }
    return;
  }

  if (hideMedia) wrapMedia(article);

  if (filterByCountry) {
    bindHoverLookup(article, tweetData.screen_name);

    const cached = getCachedCountrySync(tweetData.screen_name);
    if (cached) {
      article.setAttribute(COUNTRY_MARKER, cached);
    }
  }

  if (article.hasAttribute(ENGAGEMENT_MARKER)) return;

  const reasons: string[] = [];

  if (hideLowEngagement) {
    cacheFocalViews();
    const minLikes = getMinLikes();
    if (minLikes > 0) {
      if (tweetData.favorite_count < minLikes) {
        console.log(
          LOG,
          "LE:",
          tweetData.screen_name,
          "likes:",
          tweetData.favorite_count,
          "< threshold:",
          Math.ceil(minLikes)
        );
        reasons.push("LE");
      }
    }
  }

  if (hideShortReplies) {
    const tweetText = article.querySelector<HTMLElement>(
      '[data-testid="tweetText"]'
    );
    const text = tweetText?.textContent?.trim() ?? "";
    const wordCount = text ? text.split(/\s+/).length : 0;
    if (wordCount < minWordCount) {
      console.log(
        LOG,
        "LWC:",
        tweetData.screen_name,
        `${wordCount} words < ${minWordCount}`
      );
      reasons.push("LWC");
    }
  }

  if (filterByCountry) {
    const country = getCachedCountrySync(tweetData.screen_name);
    if (country) {
      const allowed = allowedCountries
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (
        allowed.length > 0 &&
        !allowed.includes(country.toLowerCase())
      ) {
        console.log(LOG, "FC:", tweetData.screen_name, "country:", country);
        reasons.push("FC");
      }
    }
  }

  // Check AI classification results
  const aiResult = cache.get<Record<string, boolean>>(
    "ai-classification",
    tweetData.id_str
  );
  if (aiResult) {
    for (const classifier of aiClassifiers) {
      if (aiResult[classifier.id]) {
        reasons.push(classifier.acronym);
      }
    }
  }

  if (reasons.length > 0) {
    collapseReply(article, reasons.join(", "));
  }
}

function processNodes(root: Element | Document) {
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

  document
    .querySelectorAll<HTMLElement>(`[${SKIPPED_MARKER}]`)
    .forEach((article) => article.removeAttribute(SKIPPED_MARKER));

  document.body.classList.remove("xes-show-filtered");
  toggleBtn?.remove();
  toggleBtn = null;
  filteredCount = 0;
  filtersVisible = false;

  focalViews = null;
  focalAuthor = null;
  opRepliedToIds.clear();
  lastPath = "";
  cache = null;
}

const replyFiltering: BehaviorPlugin = {
  id: "reply-filtering",
  name: "Reply Filtering",
  description:
    "Filter and collapse low-quality replies on tweet threads",
  category: "Replies",
  defaultEnabled: true,
  depends: ["tweet-data", "country-data", "ai-classification"],
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
    {
      id: "filter-by-country",
      label: "Filter by account country",
      description:
        "Collapse replies from accounts not based in allowed countries (looked up on hover)",
      type: "boolean",
      defaultValue: false,
    },
    {
      id: "allowed-countries",
      label: "Allowed countries",
      description:
        "Comma-separated list of allowed countries (e.g. 'United States, Canada, United Kingdom')",
      type: "string",
      defaultValue: "",
    },
  ],

  async init(cacheService: CacheService) {
    cache = cacheService;
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
    hideShortReplies = await getFeatureOption(
      fid,
      "hide-short-replies",
      true
    );
    minWordCount = await getFeatureOption(fid, "min-word-count", 10);
    filterByCountry = await getFeatureOption(
      fid,
      "filter-by-country",
      false
    );
    allowedCountries = await getFeatureOption<string>(
      fid,
      "allowed-countries",
      ""
    );

    console.log(LOG, "Init:", {
      hideMedia,
      hideLowEngagement,
      hideShortReplies,
      skipFollowedAndSelf,
      engagementFactor,
      minViewsThreshold,
      minWordCount,
      filterByCountry,
      allowedCountries,
    });

    injectStyles();
    processNodes(document);

    // React to new tweet data arriving from the cache bridge
    cache.on("tweet-data", (_collectorId, _key, _value) => {
      // Rebuild OP-replied-to set in case this is an OP reply
      rebuildOpRepliedToIds();
      // Re-process articles that now have data available
      processNodes(document);
    });

    // React to AI classification results arriving
    cache.on("ai-classification", (_collectorId, tweetId, value) => {
      const aiResult = value as Record<string, boolean>;
      // Check if any classification is positive
      const positiveClassifiers = aiClassifiers.filter(
        (c) => aiResult[c.id]
      );
      if (positiveClassifiers.length === 0) return;

      const acronyms = positiveClassifiers.map((c) => c.acronym);

      // Find the article with this tweet ID
      const article = document.querySelector<HTMLElement>(
        `[data-xes-tweet-id="${tweetId}"]`
      );
      if (!article) return;
      if (article.getAttribute(ENGAGEMENT_MARKER) === "revealed") return;
      if (article.hasAttribute(SKIPPED_MARKER)) return;

      if (article.hasAttribute(ENGAGEMENT_MARKER)) {
        // Already collapsed — append AI acronyms to existing reason
        const reasonEl = article.querySelector<HTMLElement>(
          ".xes-show-reply-btn .xes-collapse-reason"
        );
        if (reasonEl) {
          const current = reasonEl.textContent?.replace(/[()]/g, "") ?? "";
          const existing = current.split(",").map((s) => s.trim()).filter(Boolean);
          const newReasons = acronyms.filter((a) => !existing.includes(a));
          if (newReasons.length > 0) {
            reasonEl.textContent = `(${[...existing, ...newReasons].join(", ")})`;
            console.log(LOG, "Appended AI reasons to", tweetId, ":", newReasons);
          }
        }
      } else {
        // Not yet collapsed — collapse with AI reason
        console.log(LOG, "AI collapse:", tweetId, acronyms);
        collapseReply(article, acronyms.join(", "));
      }
    });

    // React to country data arriving
    cache.on("country-data", (_collectorId, screenName, value) => {
      if (typeof value !== "string" || !filterByCountry) return;
      // Find articles for this user and apply country filter
      const articles = document.querySelectorAll<HTMLElement>(
        'article[data-testid="tweet"]'
      );
      for (const article of articles) {
        const tweetData = getTweetDataFromCache(article);
        if (
          tweetData &&
          tweetData.screen_name.toLowerCase() === screenName
        ) {
          article.setAttribute(COUNTRY_MARKER, value);
          applyCountryFilter(article, tweetData.screen_name, value);
        }
      }
    });

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
      attributeFilter: ["data-testid", "data-xes-tweet-id"],
    });

    scanInterval = setInterval(() => processNodes(document), 1000);
  },

  cleanup: cleanupAll,
};

export default replyFiltering;
