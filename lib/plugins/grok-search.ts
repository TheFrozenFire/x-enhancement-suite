import type { BehaviorPlugin, CacheService } from "../plugin-types";
import { aiProviderConfig, grokSearchHistory } from "../storage";
import type { AiProvider } from "../ai/types";
import { sendSearchRequest, type SearchResult } from "../ai/client";

const LOG = "[XES:grok-search]";
const STYLE_ID = "xes-grok-search";
const XES_ATTR = "data-xes";

let observer: MutationObserver | null = null;
let searchProvider: AiProvider | null = null;
let inputEl: HTMLInputElement | null = null;
let focusHandler: (() => void) | null = null;
let inputHandler: (() => void) | null = null;
let submitHandler: ((e: Event) => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastResults: SearchResult[] = [];
let activeSearchId = 0;

// --- Listbox helpers ---

function getListbox(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    'form[role="search"] [role="listbox"]'
  );
}

/** Remove only our injected elements from the listbox */
function clearOurContent() {
  const listbox = getListbox();
  if (!listbox) return;
  listbox.querySelectorAll(`[${XES_ATTR}]`).forEach((el) => el.remove());
}

/** Append elements to the listbox, marked with our attribute */
function appendToListbox(html: string) {
  const listbox = getListbox();
  if (!listbox) return;

  // Clear any previous XES content
  listbox.querySelectorAll(`[${XES_ATTR}]`).forEach((el) => el.remove());

  // Parse and append
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;

  // Mark all top-level children
  for (const child of Array.from(fragment.children)) {
    child.setAttribute(XES_ATTR, "");
  }

  listbox.appendChild(fragment);
}

// --- Render functions ---

function renderLoading() {
  console.log(LOG, "Showing loading state");
  appendToListbox(`<div role="option" ${XES_ATTR} style="padding: 12px 16px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div class="xes-grok-spinner"></div>
      <span class="xes-grok-secondary">Searching...</span>
    </div>
  </div>`);
}

function renderError(msg: string) {
  console.log(LOG, "Showing error:", msg);
  appendToListbox(`<div role="option" ${XES_ATTR} style="padding: 12px 16px;">
    <span class="xes-grok-secondary">${escapeHTML(msg)}</span>
  </div>`);
}

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = diffMs / (1000 * 60 * 60);

    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m`;
    if (diffH < 24) return `${Math.floor(diffH)}h`;
    if (diffH < 24 * 7) return `${Math.floor(diffH / 24)}d`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  } catch {
    return "";
  }
}

function formatLikes(count: number): string {
  if (!count || count <= 0) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function renderResults(results: SearchResult[]) {
  lastResults = results;

  if (results.length === 0) {
    renderError("No results found");
    return;
  }

  const html = results.map((result) => {
    const author = result.author ? escapeHTML(result.author) : "";
    const summary = escapeHTML(result.summary || result.text);
    const url = escapeHTML(result.url);
    const time = formatTimestamp(result.timestamp);
    const likes = formatLikes(result.likes);

    const metaParts = [author, time].filter(Boolean).join(" · ");
    const likesHtml = likes ? `<span class="xes-grok-result-likes">♡ ${likes}</span>` : "";

    return `<div role="option" ${XES_ATTR} class="xes-grok-result" data-xes-url="${url}">
      <div class="xes-grok-result-header">
        <span class="xes-grok-result-meta">${metaParts}</span>
        ${likesHtml}
      </div>
      <div class="xes-grok-result-summary">${summary}</div>
    </div>`;
  }).join("");

  appendToListbox(html);
  attachResultClickHandlers();
  console.log(LOG, "Rendered", results.length, "results");
}

function attachResultClickHandlers() {
  const listbox = getListbox();
  if (!listbox) return;

  listbox.querySelectorAll<HTMLElement>("[data-xes-url]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = el.getAttribute("data-xes-url");
      if (url) {
        console.log(LOG, "Navigating to result:", url);
        window.location.href = url;
      }
    });
  });
}

function escapeHTML(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Search input attachment ---

function attachToInput(input: HTMLInputElement) {
  if (inputEl === input) return;

  console.log(LOG, "Attaching to search input");
  inputEl = input;

  focusHandler = () => {
    // Small delay to let X render the listbox first
    setTimeout(() => {
      if (lastResults.length > 0) {
        renderResults(lastResults);
      }
    }, 50);
  };
  input.addEventListener("focusin", focusHandler);

  // Input handler — debounced search
  inputHandler = () => {
    const query = input.value.trim();
    if (!query) {
      clearOurContent();
      lastResults = [];
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 800);
  };
  input.addEventListener("input", inputHandler);

  // Submit handler — prevent X's default search, trigger immediate search
  const form = input.closest<HTMLFormElement>("form");
  if (form) {
    submitHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(LOG, "Intercepted form submit");
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      const query = input.value.trim();
      if (query) performSearch(query);
    };
    form.addEventListener("submit", submitHandler, { capture: true });
  }
}

function detachFromInput() {
  if (!inputEl) return;
  console.log(LOG, "Detaching from search input");

  if (focusHandler) inputEl.removeEventListener("focusin", focusHandler);
  if (inputHandler) inputEl.removeEventListener("input", inputHandler);

  const form = inputEl.closest<HTMLFormElement>("form");
  if (form && submitHandler) {
    form.removeEventListener("submit", submitHandler, { capture: true });
  }

  inputEl = null;
  focusHandler = null;
  inputHandler = null;
  submitHandler = null;
}

// --- User context ---

function getLoggedInHandle(): string | null {
  const link = document.querySelector<HTMLAnchorElement>(
    'a[data-testid="AppTabBar_Profile_Link"]'
  );
  if (!link) return null;
  const match = link.pathname.match(/^\/([^/]+)/);
  return match ? match[1] : null;
}

// --- Search execution ---

async function performSearch(query: string) {
  console.log(LOG, "Performing search:", query);
  renderLoading();

  if (!searchProvider) {
    renderError("Search provider not configured");
    return;
  }

  const searchId = ++activeSearchId;
  const userHandle = getLoggedInHandle();

  try {
    const results = await sendSearchRequest(searchProvider, query, userHandle);

    if (searchId !== activeSearchId) {
      console.log(LOG, "Discarding stale search results for:", query);
      return;
    }

    renderResults(results);
    saveSearchHistory(query);
  } catch (err) {
    if (searchId !== activeSearchId) return;
    console.error(LOG, "Search failed:", err);
    renderError("Search failed");
  }
}

async function saveSearchHistory(query: string) {
  try {
    const history = await grokSearchHistory.getValue();
    const filtered = history.filter((e) => e.query !== query);
    const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, 20);
    await grokSearchHistory.setValue(updated);
    console.log(LOG, "Saved search history, total:", updated.length);
  } catch (err) {
    console.error(LOG, "Failed to save search history:", err);
  }
}

// --- CSS ---

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* Hide X's native listbox children; our elements are exempted via [data-xes] */
    form[role="search"] [role="listbox"] > *:not([data-xes]) {
      display: none !important;
    }

    @keyframes xes-spin {
      to { transform: rotate(360deg); }
    }
    .xes-grok-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--xes-secondary-color, rgb(113, 118, 123));
      border-top-color: rgb(29, 155, 240);
      border-radius: 50%;
      animation: xes-spin 0.6s linear infinite;
    }
    .xes-grok-secondary {
      color: var(--xes-secondary-color, rgb(113, 118, 123));
      font-size: 13px;
    }
    .xes-grok-result {
      padding: 10px 16px;
      cursor: pointer;
      transition: background-color 0.15s;
    }
    .xes-grok-result:hover {
      background-color: rgba(231, 233, 234, 0.1);
    }
    .xes-grok-result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .xes-grok-result-meta {
      font-size: 13px;
      font-weight: 700;
      color: inherit;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .xes-grok-result-likes {
      font-size: 12px;
      color: var(--xes-secondary-color, rgb(113, 118, 123));
      white-space: nowrap;
      margin-left: 8px;
    }
    .xes-grok-result-summary {
      font-size: 12px;
      color: var(--xes-secondary-color, rgb(113, 118, 123));
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}

// --- Plugin lifecycle ---

function scanForInput() {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="SearchBox_Search_Input"]'
  );
  if (input && input !== inputEl) {
    attachToInput(input);
  } else if (!input && inputEl) {
    detachFromInput();
  }
}

function cleanupAll() {
  console.log(LOG, "Cleanup");
  observer?.disconnect();
  observer = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  detachFromInput();
  clearOurContent();
  document.getElementById(STYLE_ID)?.remove();
  searchProvider = null;
  lastResults = [];
  activeSearchId = 0;
}

const grokSearch: BehaviorPlugin = {
  id: "grok-search",
  name: "Grok Search",
  description:
    "Replace X's search with AI-powered Grok search for finding X posts",
  category: "Search",
  defaultEnabled: true,
  depends: [],

  async init(_cache: CacheService) {
    const config = await aiProviderConfig.getValue();
    searchProvider = config.search ?? null;

    console.log(LOG, "Init — search provider:", searchProvider ? "configured" : "not configured");

    injectStyles();
    scanForInput();

    observer = new MutationObserver(() => {
      scanForInput();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  cleanup: cleanupAll,
};

export default grokSearch;
