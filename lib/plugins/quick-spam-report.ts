import type { BehaviorPlugin, CacheService } from "../plugin-types";

const LOG = "[XES:quick-spam-report]";
const MARKER = "data-xes-spam-btn";

let observer: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;

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

function findByText(
  root: Element | Document,
  selector: string,
  text: string
): HTMLElement | null {
  const els = root.querySelectorAll<HTMLElement>(selector);
  for (const el of els) {
    if (el.textContent?.trim() === text) return el;
  }
  return null;
}

async function runSpamReport(menuOpener: () => void) {
  // Step 1: Open menu and click Report
  console.log(LOG, "Opening menu");
  menuOpener();

  try {
    const reportItem = await waitForElement(document, '[data-testid="report"]');
    console.log(LOG, "Clicking Report");
    reportItem.click();
  } catch {
    const reportByText = findMenuItemByText("Report");
    if (reportByText) {
      console.log(LOG, "Clicking Report (by text)");
      reportByText.click();
    } else {
      console.error(LOG, "Could not find Report menu item");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
  }

  // Step 2: Wait for report modal, click Spam
  try {
    await waitForElement(document, '[role="dialog"], [data-testid="sheetDialog"]');
    console.log(LOG, "Report modal opened");
    await new Promise((r) => setTimeout(r, 500));

    const spamOption = findByText(document, 'span', 'Spam');
    if (spamOption) {
      console.log(LOG, "Clicking Spam option");
      spamOption.click();
    } else {
      console.error(LOG, "Could not find Spam option");
      return;
    }

    // Step 3: Click Next
    await new Promise((r) => setTimeout(r, 500));
    const nextBtn = findByText(document, 'span', 'Next')
      ?? findByText(document, 'button', 'Next');
    if (nextBtn) {
      console.log(LOG, "Clicking Next");
      const btn = nextBtn.closest('button') ?? nextBtn;
      (btn as HTMLElement).click();
    } else {
      console.error(LOG, "Could not find Next button");
      return;
    }

    // Step 4: Click Done
    await new Promise((r) => setTimeout(r, 1000));
    const doneBtn = findByText(document, 'span', 'Done')
      ?? findByText(document, 'button', 'Done');
    if (doneBtn) {
      console.log(LOG, "Clicking Done");
      const btn = doneBtn.closest('button') ?? doneBtn;
      (btn as HTMLElement).click();
      console.log(LOG, "Report flow complete");
    } else {
      console.error(LOG, "Could not find Done button, trying close");
      const closeBtn = document.querySelector<HTMLElement>(
        '[data-testid="app-bar-close"]'
      );
      closeBtn?.click();
    }
  } catch (err) {
    console.error(LOG, "Report flow failed:", err);
  }
}

// --- Reply spam report (tweet threads) ---

async function runReplyReportFlow(article: HTMLElement) {
  const caret = article.querySelector<HTMLElement>('[data-testid="caret"]');
  if (!caret) {
    console.error(LOG, "No caret button found");
    return;
  }
  await runSpamReport(() => caret.click());
}

function addReplyButton(article: HTMLElement) {
  if (article.hasAttribute(MARKER)) return;
  article.setAttribute(MARKER, "true");

  const caret = article.querySelector('[data-testid="caret"]');
  if (!caret) return;

  const caretWrapper = caret.parentElement?.parentElement?.parentElement;
  if (!caretWrapper?.parentElement) return;

  const btn = document.createElement("button");
  btn.className = "xes-spam-report-btn";
  btn.type = "button";
  btn.title = "Quick Spam Report";
  btn.textContent = "\uD83D\uDCA9";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    runReplyReportFlow(article);
  });

  caretWrapper.parentElement.insertBefore(btn, caretWrapper.nextSibling);
}

function processArticles(root: Element | Document) {
  const articles = root.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    if (
      article.querySelector('a[href*="/analytics"]') &&
      article.textContent?.includes("Views")
    ) {
      continue;
    }
    addReplyButton(article);
  }
}

// --- Follower spam report (followers page) ---

async function runFollowerReportFlow(cell: HTMLElement) {
  const moreBtn = cell.querySelector<HTMLElement>('button[aria-label="More"]');
  if (!moreBtn) {
    console.error(LOG, "No More button found in follower cell");
    return;
  }

  // Step 1: Report as spam
  await runSpamReport(() => moreBtn.click());

  // Step 2: Wait for report dialog to close
  await new Promise((r) => setTimeout(r, 1000));

  // Step 3: Open menu again and click "Remove this follower"
  console.log(LOG, "Opening menu for Remove Follower");
  moreBtn.click();

  try {
    const removeItem = await waitForElement(document, '[data-testid="removeFollower"]');
    console.log(LOG, "Clicking Remove this follower");
    removeItem.click();
  } catch {
    const removeByText = findMenuItemByText("Remove this follower");
    if (removeByText) {
      console.log(LOG, "Clicking Remove this follower (by text)");
      removeByText.click();
    } else {
      console.error(LOG, "Could not find Remove this follower menu item");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return;
    }
  }

  // Step 4: Confirm removal if a confirmation dialog appears
  await new Promise((r) => setTimeout(r, 500));
  const confirmBtn = findByText(document, 'span', 'Remove')
    ?? findByText(document, 'button', 'Remove');
  if (confirmBtn) {
    console.log(LOG, "Confirming removal");
    const btn = confirmBtn.closest('button') ?? confirmBtn;
    (btn as HTMLElement).click();
  }

  console.log(LOG, "Follower report + remove complete");
}

function addFollowerButton(cell: HTMLElement) {
  if (cell.hasAttribute(MARKER)) return;
  cell.setAttribute(MARKER, "true");

  const moreBtn = cell.querySelector<HTMLElement>('button[aria-label="More"]');
  if (!moreBtn) return;

  const btn = document.createElement("button");
  btn.className = "xes-spam-report-btn";
  btn.type = "button";
  btn.title = "Report Spam & Remove Follower";
  btn.textContent = "\uD83D\uDCA9";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    runFollowerReportFlow(cell);
  });

  // Insert next to the More button
  moreBtn.parentElement!.insertBefore(btn, moreBtn.nextSibling);
}

function processFollowerCells(root: Element | Document) {
  const cells = root.querySelectorAll<HTMLElement>(
    '[data-testid="UserCell"]'
  );
  for (const cell of cells) {
    const container = cell.closest<HTMLElement>('[data-testid="cellInnerDiv"]');
    if (container) addFollowerButton(container);
  }
}

// --- Shared ---

function isFollowersPage() {
  return /\/followers\b/.test(window.location.pathname);
}

function processAll(root: Element | Document) {
  if (isFollowersPage()) {
    processFollowerCells(root);
  } else {
    processArticles(root);
  }
}

function injectStyles() {
  const id = "xes-quick-spam-report";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .xes-spam-report-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 9999px;
      opacity: 0.4;
      transition: opacity 0.15s, filter 0.15s;
      line-height: 1;
      filter: grayscale(1);
    }
    .xes-spam-report-btn:hover {
      opacity: 1;
      filter: grayscale(0);
      background: rgba(244, 33, 46, 0.1);
    }
  `;
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
  document.getElementById("xes-quick-spam-report")?.remove();
  document
    .querySelectorAll<HTMLElement>(`[${MARKER}]`)
    .forEach((el) => {
      el.removeAttribute(MARKER);
      el.querySelectorAll(".xes-spam-report-btn").forEach((btn) => btn.remove());
    });
}

const quickSpamReport: BehaviorPlugin = {
  id: "quick-spam-report",
  name: "Quick Spam Report",
  description:
    "Adds a one-click spam report button to replies and follower lists",
  category: "Replies",
  defaultEnabled: true,
  depends: [],

  async init(_cache: CacheService) {
    console.log(LOG, "Init");
    injectStyles();
    processAll(document);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            processAll(node);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    scanInterval = setInterval(() => processAll(document), 2000);
  },

  cleanup: cleanupAll,
};

export default quickSpamReport;
