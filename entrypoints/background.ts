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

function setupAiRequestHandler() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "xes-ai-request") return false;

    const { provider, systemPrompt, userPrompt, responseFormat } = message;

    // Validate provider fields
    if (!provider?.endpoint || !provider?.apiKey || !provider?.model) {
      sendResponse({ success: false, error: "Incomplete provider configuration" });
      return false;
    }

    // Normalize endpoint — strip trailing slash
    const baseUrl = provider.endpoint.replace(/\/+$/, "");
    const url = `${baseUrl}/chat/completions`;

    console.log("[XES:background] AI request to", url, "model:", provider.model);

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        ...(provider.extraParams ?? {}),
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          sendResponse({
            success: false,
            error: `HTTP ${res.status}: ${text.substring(0, 200)}`,
          });
          return;
        }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        sendResponse({ success: true, content });
      })
      .catch((err) => {
        console.error("[XES:background] AI request failed:", err);
        sendResponse({ success: false, error: String(err) });
      });

    // Return true to indicate we'll call sendResponse asynchronously
    return true;
  });

  console.log("[XES:background] AI request handler installed");
}

export default defineBackground(() => {
  console.log("[XES:background] Init", { id: browser.runtime.id });
  migrateStorage();
  setupDNRRules();
  setupAiRequestHandler();
});
