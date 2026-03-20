import type { BehaviorPlugin, CacheService } from "../plugin-types";
import { getFeatureOption } from "../storage";

const LOG = "[XES:remove-annoyances]";
const STYLE_ID = "xes-remove-annoyances";
const HIDDEN_ATTR = "data-xes-annoyance-hidden";
const SIDEBAR_HIDDEN_ATTR = "data-xes-sidebar-hidden";

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

/** Hide siblings forward until a cell containing a tweet article is found */
function hideCellsUntilTweet(cell: Element, reason: string) {
  hideCell(cell, reason);
  let sibling = cell.nextElementSibling;
  while (sibling) {
    if (sibling.querySelector('article[data-testid="tweet"]')) break;
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
      if (
        !cell.querySelector('article') &&
        cellHasText(cell, "div", "Click to Follow")
      ) {
        hideCell(cell, "follow-suggestions");
        continue;
      }
      if (cellHasText(cell, "span", "Creators for you")) {
        hideCellsUntilTweet(cell, "follow-suggestions");
        continue;
      }
    }

    // Topic suggestions
    if (hideTopicSuggestions) {
      if (cellHasText(cell, "span", "Discover new Communities")) {
        hideCellsUntilTweet(cell, "topic-suggestions");
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

  // Sidebar widgets: hide everything except the search box and its spacer.
  // Uses visibility+collapse instead of display:none because hiding children
  // with display:none causes X to collapse the entire sidebar container.
  if (hideSidebarContent) {
    const sidebar = document.querySelector<HTMLElement>('[data-testid="sidebarColumn"]');
    if (sidebar) {
      // Find the widget sibling container (first ancestor with many children)
      const findWidgetContainer = (): HTMLElement | null => {
        const walk = (el: HTMLElement): HTMLElement | null => {
          if (el.children.length > 3) return el;
          for (const child of Array.from(el.children) as HTMLElement[]) {
            const r = walk(child);
            if (r) return r;
          }
          return null;
        };
        return walk(sidebar);
      };

      const container = findWidgetContainer();
      if (container) {
        for (const child of Array.from(container.children) as HTMLElement[]) {
          if (child.hasAttribute(SIDEBAR_HIDDEN_ATTR)) continue;

          // Keep the search box (position:fixed with z-index) and its spacer
          const isSearch = !!child.querySelector('[data-testid="SearchBox_Search_Input"]');
          const cs = window.getComputedStyle(child);
          const isFixedSpacer = cs.position === "fixed" && cs.zIndex === "2";
          // The spacer is the empty relative-positioned sibling right after the fixed search
          const isSpacer = !child.textContent?.trim() && child.offsetHeight < 60;

          if (isSearch || isFixedSpacer || isSpacer) continue;

          child.setAttribute(SIDEBAR_HIDDEN_ATTR, "sidebar");
        }
      }
    }
  }
}

// --- CSS-based hiding ---

function buildCSS(): string {
  const rules: string[] = [];

  // Always hide JS-marked elements
  rules.push(`[${HIDDEN_ATTR}] { display: none !important; }`);

  // Sidebar widgets use visibility+collapse to stay in layout flow
  // (display:none triggers X's own CSS to hide the entire sidebar)
  rules.push(
    `[${SIDEBAR_HIDDEN_ATTR}] { visibility: hidden !important; max-height: 0 !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }`
  );

  // Use wildcard to match both "Home timeline" and "Timeline: Your Home Timeline"
  const TL = '[aria-label*="Home" i][aria-label*="timeline" i]';

  if (hideFollowSuggestions) {
    rules.push(
      `${TL} [data-testid="cellInnerDiv"]:has(aside[aria-label="Who to follow"])`,
      `${TL} [data-testid="cellInnerDiv"]:has(a[href*="/i/connect_people"])`,
    );
  }

  if (hideTopicSuggestions) {
    rules.push(
      `${TL} [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"])`,
      `${TL} [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"]) + div`,
      `${TL} [data-testid="cellInnerDiv"]:has(a[href="/i/topics/pinned"]) + div + div`,
    );
  }

  if (hideTrending) {
    rules.push(
      `${TL} [data-testid="cellInnerDiv"]:has(button > a[href="/explore"])`,
      `${TL} [data-testid="cellInnerDiv"]:has(button > a[href="/explore"]) + div`,
      `${TL} [data-testid="cellInnerDiv"]:has(div[data-testid="trend"])`,
      `${TL} [data-testid="cellInnerDiv"]:has(a[href="/explore"])`,
      `${TL} [aria-label="Timeline: Trending now"] > div > div:nth-child(3)`,
    );
  }

  if (hidePromotions) {
    rules.push(
      `${TL} [data-testid="cellInnerDiv"]:has(a[href="/i/verified-orgs-signup"])`,
      `[aria-label="Timeline: Conversation"] a[href*="quick_promote_web"]`,
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
  document
    .querySelectorAll<HTMLElement>(`[${SIDEBAR_HIDDEN_ATTR}]`)
    .forEach((el) => el.removeAttribute(SIDEBAR_HIDDEN_ATTR));
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
