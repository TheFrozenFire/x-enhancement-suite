export interface AiProvider {
  endpoint: string; // OpenAI-compatible base URL
  apiKey: string;
  model: string;
  extraParams?: Record<string, unknown>; // merged into chat completion request body
}

export interface AiProviderConfig {
  fast?: AiProvider;
  smart?: AiProvider;
}

export interface AiClassifier {
  id: string; // e.g., "vitriol"
  name: string; // e.g., "Vitriol Detection"
  description: string;
  acronym: string; // e.g., "VIT" — shown in collapse reason
  slot: "fast" | "smart";
  defaultEnabled: boolean;
  // The classification question. Will be inserted into a standard prompt
  // template alongside the focal tweet and reply texts.
  // true in the LLM response = collapse the reply (unless invertResult is set).
  prompt: string;
  // If true, invert the LLM's boolean (useful when the natural phrasing
  // of the question is the opposite of the collapse intent).
  invertResult?: boolean;
}
