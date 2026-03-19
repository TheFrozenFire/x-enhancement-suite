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
  summary: string;
  timestamp: string;
  likes: number;
}

const SEARCH_SYSTEM_PROMPT = `You are a search assistant for X/Twitter. Search X posts and return relevant results as JSON.

Rules:
- Prefer recent posts unless the query clearly references a historical event or time period.
- Prefer posts with meaningful engagement over zero-engagement or spam posts.
- Return one post per conversation thread — do not return multiple replies from the same thread.
- URLs must use the format https://x.com/{handle}/status/{id}. Do not fabricate URLs.
- The "summary" field should explain WHY this result is relevant to the query, not just restate the post content.
- The "timestamp" field should be the post date in ISO 8601 format (e.g. "2026-03-15T14:30:00Z"). Use your best estimate if exact time is unknown.
- The "likes" field should be the approximate like count as a number. Use 0 if unknown.

Respond with: { "results": [ { "url": "...", "author": "@handle", "text": "original post text", "summary": "why this matches the query", "timestamp": "ISO 8601", "likes": 0 } ] }
Return up to 10 results. If no results found, return { "results": [] }.`;

export async function sendSearchRequest(
  provider: AiProvider,
  query: string,
  userHandle?: string | null
): Promise<SearchResult[]> {
  console.log(LOG, "Sending search request to background, user:", userHandle ?? "unknown");

  const userContext = userHandle
    ? `\nThe person performing this search is @${userHandle}. This is context only — do NOT restrict results to their posts. Search all of X broadly.`
    : "";
  const systemPrompt = SEARCH_SYSTEM_PROMPT + userContext;

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
      summary: String(r.summary ?? ""),
      timestamp: String(r.timestamp ?? ""),
      likes: Number(r.likes) || 0,
    }));
    console.log(LOG, "Parsed", results.length, "search results");
    return results;
  } catch (e) {
    console.error(LOG, "Failed to parse search response:", e);
    return [];
  }
}
