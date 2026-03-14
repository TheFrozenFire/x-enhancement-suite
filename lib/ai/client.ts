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
