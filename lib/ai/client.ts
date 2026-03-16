import type { AiProvider } from "./types";

const LOG = "[XES:ai-client]";

interface ClassificationRequest {
  type: "xes-ai-request";
  provider: AiProvider;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: unknown;
}

interface ClassificationResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export async function sendClassificationRequest(
  provider: AiProvider,
  systemPrompt: string,
  userPrompt: string,
  responseFormat?: unknown
): Promise<string> {
  console.log(LOG, "Sending classification request to background");

  const response = await chrome.runtime.sendMessage<
    ClassificationRequest,
    ClassificationResponse
  >({
    type: "xes-ai-request",
    provider,
    systemPrompt,
    userPrompt,
    responseFormat,
  });

  if (!response?.success) {
    throw new Error(response?.error ?? "Unknown AI request error");
  }

  console.log(LOG, "Got response:", response.content?.substring(0, 100));
  return response.content!;
}

export interface SearchResult {
  url: string;
  author: string;
  text: string;
}

export async function sendSearchRequest(
  provider: AiProvider,
  query: string
): Promise<SearchResult[]> {
  console.log(LOG, "Sending search request to background");

  const systemPrompt =
    "You are a search assistant for X/Twitter. The user will provide a search query. " +
    "Search X posts and return relevant results as JSON. " +
    "Respond with a JSON object: { \"results\": [ { \"url\": \"full x.com post URL\", \"author\": \"@handle\", \"text\": \"brief excerpt\" } ] }. " +
    "Return up to 10 results. If no results found, return { \"results\": [] }.";

  const response = await chrome.runtime.sendMessage<
    ClassificationRequest,
    ClassificationResponse
  >({
    type: "xes-ai-request",
    provider,
    systemPrompt,
    userPrompt: query,
    responseFormat: { type: "json_object" },
  });

  if (!response?.success) {
    throw new Error(response?.error ?? "Unknown AI search error");
  }

  console.log(LOG, "Got search response:", response.content?.substring(0, 200));

  try {
    const parsed = JSON.parse(response.content!);
    const results: SearchResult[] = (parsed.results ?? []).map((r: Record<string, unknown>) => ({
      url: String(r.url ?? ""),
      author: String(r.author ?? ""),
      text: String(r.text ?? ""),
    }));
    console.log(LOG, "Parsed", results.length, "search results");
    return results;
  } catch (e) {
    console.error(LOG, "Failed to parse search response:", e);
    return [];
  }
}
