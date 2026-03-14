import { migrateStorage } from "@/lib/storage";

const DNR_RULE_ID = 1;

async function setupDNRRules() {
  const rule: chrome.declarativeNetRequest.Rule = {
    id: DNR_RULE_ID,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      responseHeaders: [
        {
          header: "x-frame-options",
          operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
        },
        {
          header: "content-security-policy",
          operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
        },
      ],
    },
    condition: {
      urlFilter: "||x.com/*/about",
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
      ],
      initiatorDomains: ["x.com", "twitter.com"],
    },
  };

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [DNR_RULE_ID],
    addRules: [rule],
  });

  console.log("[XES:background] DNR session rule installed");
}

export default defineBackground(() => {
  console.log("[XES:background] Init", { id: browser.runtime.id });
  migrateStorage();
  setupDNRRules();
});
