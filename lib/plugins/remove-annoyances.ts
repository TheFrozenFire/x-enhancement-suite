import type { BehaviorPlugin, CacheService } from "../plugin-types";
import { getFeatureOption } from "../storage";

const LOG = "[XES:remove-annoyances]";
const STYLE_ID = "xes-remove-annoyances";
const HIDDEN_ATTR = "data-xes-annoyance-hidden";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;

// Options
let hideFollowSuggestions = true;
let hideTopicSuggestions = true;
let hideTrending = true;
let hideDiscoverMore = true;
let hidePromotions = true;
let hideSidebarContent = true;

// --- Text-based hiding (`:has-text()` equivalents) ---

function hideCell(cell: Element, reason: string) {
  if (cell.hasAttribute(HIDDEN_ATTR)) return;
  cell.setAttribute(HIDDEN_ATTR, reason);
}

function hideCellAndSiblings(cell: Element, reason: string, count: number) {
  hideCell(cell, reason);
  let sibling = cell.nextElementSibling;
  for (let i = 0; i < count && sibling; i++) {
    hideCell(sibling, reason);
    sibling = sibling.nextElementSibling;
  }
}

function hideCellAndAllFollowing(cell: Element, reason: string) {
  hideCell(cell, reason);
  let sibling = cell.nextElementSibling;
  while (sibling) {
    hideCell(sibling, reason);
    sibling = sibling.nextElementSibling;
  }
}

function findTimelineCells(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>(
    '[aria-label="Home timeline"] [data-testid="cellInnerDiv"], ' +
    '[aria-label*="Timeline:"] [data-testid="cellInnerDiv"]'
  );
}

function cellHasText(cell: Element, tag: string, text: string): boolean {
  const els = cell.querySelectorAll(tag);
  for (const el of els) {
    if (el.textContent?.includes(text)) return true;
  }
  return false;
}

function scanTextRules() {
  const cells = findTimelineCells();

  for (const cell of cells) {
    if (cell.hasAttribute(HIDDEN_ATTR)) continue;

    // Follow suggestions
    if (hideFollowSuggestions) {
      if (cellHasText(cell, "span", "Who to follow")) {
        hideCell(cell, "follow-suggestions");
        continue;
      }
      if (cellHasText(cell, "div", "Click to Follow")) {
        hideCell(cell, "follow-suggestions");
        continue;
      }
      if (cellHasText(cell, "span", "Creators for you")) {
        hideCellAndSiblings(cell, "follow-suggestions", 3);
        continue;
      }
    }

    // Topic suggestions
    if (hideTopicSuggestions) {
      if (cellHasText(cell, "span", "Discover new Communities")) {
        hideCellAndSiblings(cell, "topic-suggestions", 2);
        continue;
      }
    }

    // Discover more
    if (hideDiscoverMore) {
      if (cellHasText(cell, "span", "Discover more")) {
        hideCellAndAllFollowing(cell, "discover-more");
        continue;
      }
    }
  }

  // Promotions in conversation threads
  if (hidePromotions) {
    const tweetDivs = document.querySelectorAll<HTMLElement>(
      '[aria-label="Timeline: Conversation"] [data-testid="tweet"] > div'
    );
    for (const div of tweetDivs) {
      if (div.hasAttribute(HIDDEN_ATTR)) continue;
      if (div.textContent?.includes("Reach up to 100k more users now")) {
        hideCell(div, "promotions");
      }
    }

    // Grok popover ("Talk to Grok" / "Customize Grok" + "Explore")
    const grokButtons = document.querySelectorAll<HTMLElement>(
      '[data-testid="primaryColumn"] button[role="button"]'
    );
    for (const btn of grokButtons) {
      if (btn.hasAttribute(HIDDEN_ATTR)) continue;
      if (
        window.getComputedStyle(btn).position === "absolute" &&
        btn.textContent?.includes("grok.com")
      ) {
        hideCell(btn, "promotions");
      }
    }
  }

  // Sidebar: Live on X
  if (hideSidebarContent) {
    const sidebarDivs = document.querySelectorAll<HTMLElement>(
      '[data-testid="sidebarColumn"] div'
    );
    for (const div of sidebarDivs) {
      if (div.hasAttribute(HIDDEN_ATTR)) continue;
      const h2 = div.querySelector(":scope > div > h2");
      if (h2?.textContent?.includes("Live on X")) {
        hideCell(div, "sidebar-live");
      }
    }
  }
}

// --- CSS-based hiding ---

function buildCSS(): string {
  const rules: string[] = [];

  // Always hide JS-marked elements
  rules.push(`[${HIDDEN_ATTR}] { display: none !important; }`);

  if (hideFollowSuggestions) {
    rules.push(
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(aside[aria-label="Who to follow"])`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href*="/i/connect_people"])`,
    );
  }

  if (hideTopicSuggestions) {
    rules.push(
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"])`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"]) + div`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"]) + div + div`,
    );
  }

  if (hideTrending) {
    rules.push(
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(button > a[href="/explore"])`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(button > a[href="/explore"]) + div`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(div[data-testid="trend"])`,
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href="/explore"])`,
      `[aria-label="Home timeline"] [aria-label="Timeline: Trending now"] > div > div:nth-child(3)`,
    );
  }

  if (hidePromotions) {
    rules.push(
      `[aria-label="Home timeline"] [data-testid="cellInnerDiv"]:has(a[href="/i/verified-orgs-signup"])`,
      `div:has(> div > div > aside[aria-label="Get Free Ad Credit"])`,
      `[aria-label="Timeline: Conversation"] a[href*="quick_promote_web"]`,
    );
  }

  if (hideSidebarContent) {
    rules.push(
      `[data-testid="sidebarColumn"] div:has(> div > aside[aria-label="Who to follow"])`,
      `[data-testid="sidebarColumn"] div:has(> section > div[aria-label="Timeline: Trending now"])`,
      `[data-testid="sidebarColumn"] div:has(> div[data-testid="news_sidebar"])`,
    );
  }

  // First rule is already complete, rest need display:none
  const [attrRule, ...selectorRules] = rules;
  return (
    attrRule +
    "\n" +
    selectorRules.map((s) => `${s} { display: none !important; }`).join("\n")
  );
}

function injectStyles() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildCSS();
  document.head.appendChild(style);
}

function cleanupAll() {
  console.log(LOG, "Cleanup");
  observer?.disconnect();
  observer = null;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  document.getElementById(STYLE_ID)?.remove();
  document
    .querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}]`)
    .forEach((el) => el.removeAttribute(HIDDEN_ATTR));
}

const removeAnnoyances: BehaviorPlugin = {
  id: "remove-annoyances",
  name: "Remove Annoyances",
  description:
    "Hide promotional widgets, suggestions, and other non-content clutter from the timeline and sidebar",
  category: "Timeline",
  defaultEnabled: true,
  depends: [],
  options: [
    {
      id: "hide-follow-suggestions",
      label: "Hide follow suggestions",
      description:
        'Hide "Who to follow", "Creators for you", "Click to Follow" and similar prompts',
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-topic-suggestions",
      label: "Hide topic & community suggestions",
      description:
        'Hide pinned topics, "Discover new Communities" and similar prompts',
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-trending",
      label: "Hide trending & explore",
      description:
        "Hide trending topics, explore prompts, and trend widgets in the timeline",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-discover-more",
      label: 'Hide "Discover more"',
      description:
        'Hide the "Discover more" section and everything below it in the timeline',
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-promotions",
      label: "Hide promotions",
      description:
        "Hide verified org signup, ad credits, post boost prompts, and similar ads",
      type: "boolean",
      defaultValue: true,
    },
    {
      id: "hide-sidebar-content",
      label: "Hide sidebar widgets",
      description:
        'Hide "Who to follow", trending, news, and "Live on X" in the sidebar',
      type: "boolean",
      defaultValue: true,
    },
  ],

  async init(_cache: CacheService) {
    const fid = "remove-annoyances";
    hideFollowSuggestions = await getFeatureOption(fid, "hide-follow-suggestions", true);
    hideTopicSuggestions = await getFeatureOption(fid, "hide-topic-suggestions", true);
    hideTrending = await getFeatureOption(fid, "hide-trending", true);
    hideDiscoverMore = await getFeatureOption(fid, "hide-discover-more", true);
    hidePromotions = await getFeatureOption(fid, "hide-promotions", true);
    hideSidebarContent = await getFeatureOption(fid, "hide-sidebar-content", true);

    console.log(LOG, "Init:", {
      hideFollowSuggestions,
      hideTopicSuggestions,
      hideTrending,
      hideDiscoverMore,
      hidePromotions,
      hideSidebarContent,
    });

    injectStyles();
    scanTextRules();

    observer = new MutationObserver(() => {
      scanTextRules();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    scanInterval = setInterval(scanTextRules, 2000);
  },

  cleanup: cleanupAll,
};

export default removeAnnoyances;
