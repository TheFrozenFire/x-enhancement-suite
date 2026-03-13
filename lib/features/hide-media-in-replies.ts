import type { Feature } from "../types";
import { getFeatureOption } from "../storage";
import { getTweetUserData, getLoggedInUsername } from "../tweet-utils";

const STYLE_ID = "xes-hide-media-replies";
const MARKER = "data-xes-media-hidden";
const SKIPPED_MARKER = "data-xes-media-skipped";
let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let skipFollowedAndSelf = true;

function isReply(article: HTMLElement): boolean {
  // On a status/thread page, the focal tweet shows a Views count
  const isFocal =
    !!article.querySelector('a[href*="/analytics"]') &&
    article.textContent?.includes("Views");
  if (isFocal) return false;

  if (window.location.pathname.includes("/status/")) return true;

  // On timelines, replies show "Replying to" text
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

  // Skip own tweets
  const loggedIn = getLoggedInUsername();
  if (loggedIn && userData.screenName === loggedIn) return true;

  // Skip tweets from people we follow
  if (userData.following) return true;

  return false;
}

function wrapMedia(article: HTMLElement) {
  if (article.hasAttribute(MARKER) || article.hasAttribute(SKIPPED_MARKER))
    return;

  const mediaEl =
    article.querySelector<HTMLElement>('[data-testid="tweetPhoto"]') ??
    article.querySelector<HTMLElement>('[data-testid="videoPlayer"]');
  if (!mediaEl || !isReply(article)) return;

  if (shouldSkip(article)) {
    article.setAttribute(SKIPPED_MARKER, "true");
    return;
  }

  // Walk up to find the outermost single-child wrapper around the media
  let mediaContainer = mediaEl;
  while (
    mediaContainer.parentElement &&
    mediaContainer.parentElement !== article &&
    mediaContainer.parentElement.children.length === 1
  ) {
    mediaContainer = mediaContainer.parentElement;
  }

  // Ensure we escape past any wrapping <a> tag (e.g. photo link)
  const wrappingLink = mediaContainer.closest("a");
  if (wrappingLink && article.contains(wrappingLink)) {
    mediaContainer = wrappingLink;
  }

  article.setAttribute(MARKER, "true");

  // Hide the media
  mediaContainer.style.display = "none";

  // Insert toggle button
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

function processNodes(root: Element | Document) {
  const mediaEls = root.querySelectorAll<HTMLElement>(
    '[data-testid="tweetPhoto"], [data-testid="videoPlayer"]'
  );
  for (const el of mediaEls) {
    const article = el.closest<HTMLElement>('article[data-testid="tweet"]');
    if (article) wrapMedia(article);
  }

  const articles = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    wrapMedia(article);
  }
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
  `;
  document.head.appendChild(style);
}

function removeStyles() {
  document.getElementById(STYLE_ID)?.remove();
}

export const hideMediaInReplies: Feature = {
  id: "hide-media-in-replies",
  name: "Hide media in replies",
  description:
    "Collapses images, videos, and GIFs in reply tweets behind a toggle button",
  category: "Replies",
  defaultEnabled: true,
  options: [
    {
      id: "skip-followed-and-self",
      label: "Skip people I follow and myself",
      description: "Don't hide media from accounts you follow or your own replies",
      type: "boolean",
      defaultValue: true,
    },
  ],
  contentScript: {
    async init() {
      skipFollowedAndSelf = await getFeatureOption(
        "hide-media-in-replies",
        "skip-followed-and-self",
        true
      );

      injectStyles();
      processNodes(document);

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          // Handle new nodes being added
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement) {
              processNodes(node);
            }
          }
          // Handle attributes changing on existing nodes (e.g. data-testid set after insertion)
          if (m.type === "attributes" && m.target instanceof HTMLElement) {
            const article = m.target.closest<HTMLElement>(
              'article[data-testid="tweet"]'
            );
            if (article) wrapMedia(article);
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-testid"],
      });

      // Periodic rescan to catch tweets missed by the observer
      // (e.g. fully-formed nodes recycled by X's virtual scrolling)
      scanInterval = setInterval(() => processNodes(document), 1000);
    },
    cleanup() {
      observer?.disconnect();
      observer = null;
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      removeStyles();

      // Restore all hidden media and remove buttons
      document
        .querySelectorAll<HTMLElement>(`[${MARKER}]`)
        .forEach((article) => {
          article.removeAttribute(MARKER);
          article
            .querySelectorAll<HTMLElement>(".xes-show-media-btn")
            .forEach((btn) => btn.remove());
          // Restore any hidden media containers
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
        .querySelectorAll<HTMLElement>(`[${SKIPPED_MARKER}]`)
        .forEach((article) => {
          article.removeAttribute(SKIPPED_MARKER);
        });
    },
  },
};
