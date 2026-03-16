import type { BehaviorPlugin, CacheService } from "../plugin-types";
import { aiProviderConfig, grokSearchHistory } from "../storage";
import type { AiProvider } from "../ai/types";
import { sendSearchRequest, type SearchResult } from "../ai/client";

const LOG = "[XES:grok-search]";
const STYLE_ID = "xes-grok-search";

let observer: MutationObserver | null = null;
let listboxObserver: MutationObserver | null = null;
let searchProvider: AiProvider | null = null;
let inputEl: HTMLInputElement | null = null;
let focusHandler: (() => void) | null = null;
let inputHandler: (() => void) | null = null;
let submitHandler: ((e: Event) => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isOurContent = false;
let lastResults: SearchResult[] = [];
let activeSearchId = 0; // monotonic counter to discard stale responses

// --- Listbox content replacement ---

function getListbox(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    'form[role="search"] [role="listbox"]'
  );
}

function setListboxContent(html: string) {
  const listbox = getListbox();
  if (!listbox) return;

  // Set up observer to re-apply our content when X repopulates
  if (!listboxObserver) {
    listboxObserver = new MutationObserver(() => {
      if (!isOurContent && listbox.children.length > 0) {
        console.log(LOG, "X repopulated listbox, re-applying our content");
        isOurContent = true;
        listbox.innerHTML = "";
        renderCurrentState(listbox);
        isOurContent = false;
      }
    });
    listboxObserver.observe(listbox, { childList: true });
    console.log(LOG, "Watching listbox for X repopulation");
  }

  isOurContent = true;
  listbox.innerHTML = html;
  isOurContent = false;
}

// Track what to show so the mutation observer can re-render
let currentState: "empty" | "loading" | "results" | "error" = "empty";
let currentError = "";

function renderCurrentState(listbox?: HTMLElement) {
  const lb = listbox ?? getListbox();
  if (!lb) return;

  switch (currentState) {
    case "empty":
      lb.innerHTML = "";
      break;
    case "loading":
      lb.innerHTML = buildLoadingHTML();
      break;
    case "error":
      lb.innerHTML = buildErrorHTML(currentError);
      break;
    case "results":
      lb.innerHTML = buildResultsHTML(lastResults);
      attachResultClickHandlers();
      break;
  }
}

function replaceListboxContent() {
  currentState = "empty";
  lastResults = [];
  setListboxContent("");
  console.log(LOG, "Cleared listbox");
}

function renderLoading() {
  currentState = "loading";
  const listbox = getListbox();
  if (!listbox) return;
  isOurContent = true;
  listbox.innerHTML = buildLoadingHTML();
  isOurContent = false;
  console.log(LOG, "Showing loading state");
}

function renderError(msg: string) {
  currentState = "error";
  currentError = msg;
  const listbox = getListbox();
  if (!listbox) return;
  isOurContent = true;
  listbox.innerHTML = buildErrorHTML(msg);
  isOurContent = false;
  console.log(LOG, "Showing error:", msg);
}

function renderResults(results: SearchResult[]) {
  currentState = "results";
  lastResults = results;
  const listbox = getListbox();
  if (!listbox) return;
  isOurContent = true;
  listbox.innerHTML = buildResultsHTML(results);
  attachResultClickHandlers();
  isOurContent = false;
  console.log(LOG, "Rendered", results.length, "results");
}

// --- HTML builders (matching X's typeahead item structure) ---

function buildLoadingHTML(): string {
  return `<div role="option" class="css-175oi2r r-1mmae3n r-3pj75a r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l" style="padding: 12px 16px;">
    <div class="css-175oi2r r-18u37iz r-136ojw6" style="align-items: center; gap: 12px;">
      <div class="xes-grok-spinner"></div>
      <div class="css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41" style="color: rgb(113, 118, 123);">
        <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">Searching...</span>
      </div>
    </div>
  </div>`;
}

function buildErrorHTML(msg: string): string {
  return `<div role="option" class="css-175oi2r r-1mmae3n r-3pj75a r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l" style="padding: 12px 16px;">
    <div class="css-175oi2r r-18u37iz r-136ojw6">
      <div class="css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41" style="color: rgb(113, 118, 123);">
        <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">${escapeHTML(msg)}</span>
      </div>
    </div>
  </div>`;
}

function buildResultsHTML(results: SearchResult[]): string {
  if (results.length === 0) {
    return buildErrorHTML("No results found");
  }

  return results.map((result, i) => {
    const authorText = result.author ? escapeHTML(result.author) : "";
    const excerptText = escapeHTML(result.text);
    const url = escapeHTML(result.url);

    return `<div role="option" class="css-175oi2r r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l${i === 0 ? " r-1mmae3n r-3pj75a" : ""}" data-xes-result-url="${url}" style="cursor: pointer; padding: 12px 16px;">
      <div class="css-175oi2r" style="gap: 2px;">
        <div class="css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41" style="font-weight: 700;">
          <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">${authorText}</span>
        </div>
        <div class="css-146c3p1 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41" style="color: rgb(231, 233, 234); -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">
          <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">${excerptText}</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

function attachResultClickHandlers() {
  const listbox = getListbox();
  if (!listbox) return;

  listbox.querySelectorAll<HTMLElement>("[data-xes-result-url]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = el.getAttribute("data-xes-result-url");
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

  // Focus handler — replace listbox content when it appears
  focusHandler = () => {
    // Small delay to let X render the listbox first
    setTimeout(() => {
      if (lastResults.length > 0) {
        // Re-render previous results
        renderResults(lastResults);
      } else {
        replaceListboxContent();
      }
    }, 50);
  };
  input.addEventListener("focusin", focusHandler);

  // Input handler — debounced search
  inputHandler = () => {
    const query = input.value.trim();
    if (!query) {
      replaceListboxContent();
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(query);
    }, 500);
  };
  input.addEventListener("input", inputHandler);

  // Submit handler — prevent X's default search
  const form = input.closest<HTMLFormElement>("form");
  if (form) {
    submitHandler = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(LOG, "Intercepted form submit");
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

// --- Search execution ---

async function performSearch(query: string) {
  console.log(LOG, "Performing search:", query);
  renderLoading();

  if (!searchProvider) {
    renderError("Search provider not configured");
    return;
  }

  const searchId = ++activeSearchId;

  try {
    const results = await sendSearchRequest(searchProvider, query);

    // Discard if a newer search has started
    if (searchId !== activeSearchId) {
      console.log(LOG, "Discarding stale search results for:", query);
      return;
    }

    renderResults(results);

    // Save to search history
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
    // Remove duplicate if exists
    const filtered = history.filter((e) => e.query !== query);
    // Add to front, keep last 20
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
    @keyframes xes-spin {
      to { transform: rotate(360deg); }
    }
    .xes-grok-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgb(113, 118, 123);
      border-top-color: rgb(29, 155, 240);
      border-radius: 50%;
      animation: xes-spin 0.6s linear infinite;
    }
    [data-xes-result-url]:hover {
      background-color: rgba(231, 233, 234, 0.1);
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
  listboxObserver?.disconnect();
  listboxObserver = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  detachFromInput();
  document.getElementById(STYLE_ID)?.remove();
  searchProvider = null;
  lastResults = [];
  activeSearchId = 0;
  currentState = "empty";
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
