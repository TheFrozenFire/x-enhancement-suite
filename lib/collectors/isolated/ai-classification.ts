/**
 * ISOLATED world data collector: AI-powered reply classification.
 *
 * Subscribes to tweet-data cache events, debounces batches, and sends
 * classification requests to the background script via the AI client.
 * Results are published to cache("ai-classification") for consumption
 * by behavior plugins (e.g. reply-filtering).
 */

import type { DataCollector, CacheService } from "../../plugin-types";
import type { AiClassifier } from "../../ai/types";
import { sendClassificationRequest } from "../../ai/client";
import { aiProviderConfig, pluginStates, getFeatureOption } from "../../storage";

const LOG = "[XES:ai-classification]";
const INITIAL_DEBOUNCE_MS = 500;
const DEBOUNCE_MS = 2000;
const MAX_BATCH_SIZE = 50;

// Auto-discover classifiers
const classifierModules = import.meta.glob<{ default: AiClassifier }>(
  "../../ai/classifiers/*.ts",
  { eager: true }
);

const allClassifiers: AiClassifier[] = Object.values(classifierModules).map(
  (m) => m.default
);

let cache: CacheService | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hasFiredFirst = false;
let classifiedIds = new Set<string>();
let lastPath = "";
let tweetDataHandler: ((collectorId: string, key: string, value: unknown) => void) | null = null;

interface TweetCacheData {
  id_str: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number | null;
  screen_name: string;
  following: boolean;
  followed_by: boolean;
  in_reply_to_status_id_str: string | null;
}

function isFocalArticle(article: HTMLElement): boolean {
  return (
    !!article.querySelector('a[href*="/analytics"]') &&
    !!article.textContent?.includes("Views")
  );
}

function getFocalTweetText(): { text: string; author: string } | null {
  const articles = document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]'
  );
  for (const article of articles) {
    if (isFocalArticle(article)) {
      const tweetText = article.querySelector<HTMLElement>(
        '[data-testid="tweetText"]'
      );
      const text = tweetText?.textContent?.trim() ?? "";

      // Get author from tweet data cache
      const tweetId = article.getAttribute("data-xes-tweet-id");
      let author = "";
      if (tweetId && cache) {
        const data = cache.get<TweetCacheData>("tweet-data", tweetId);
        if (data) author = data.screen_name;
      }

      return { text, author };
    }
  }
  return null;
}

function getUnclassifiedReplies(focalAuthor: string | null, skipFiltered: boolean): Array<{ id: string; text: string }> {
  if (!cache) return [];

  const replies: Array<{ id: string; text: string }> = [];
  const allTweets = cache.getAll<TweetCacheData>("tweet-data");

  for (const [tweetId, tweet] of allTweets) {
    if (classifiedIds.has(tweetId)) continue;

    // Skip the focal author's own replies
    if (focalAuthor && tweet.screen_name === focalAuthor) continue;

    // Skip if this looks like the focal tweet (has analytics link in DOM)
    const article = document.querySelector<HTMLElement>(
      `[data-xes-tweet-id="${tweetId}"]`
    );
    if (article && isFocalArticle(article)) continue;

    // Skip replies already collapsed by rule-based filters
    if (skipFiltered && article?.hasAttribute("data-xes-low-engagement")) {
      classifiedIds.add(tweetId);
      continue;
    }

    // Get reply text from the DOM
    if (article) {
      const tweetText = article.querySelector<HTMLElement>(
        '[data-testid="tweetText"]'
      );
      const text = tweetText?.textContent?.trim() ?? "";
      if (text) {
        replies.push({ id: tweetId, text });
      }
    }
  }

  return replies;
}

async function runClassificationBatch() {
  if (!cache) return;

  // Only run on thread pages
  if (!window.location.pathname.includes("/status/")) return;

  // Check for path change (SPA navigation)
  const currentPath = window.location.pathname;
  if (currentPath !== lastPath) {
    console.log(LOG, "Path changed:", lastPath, "→", currentPath);
    lastPath = currentPath;
    classifiedIds.clear();
    hasFiredFirst = false;
  }

  const focal = getFocalTweetText();
  if (!focal || !focal.text) {
    console.log(LOG, "No focal tweet text found, skipping batch");
    return;
  }

  const classifyFiltered = await getFeatureOption<boolean>(
    "ai-classification", "classify-filtered", false
  );
  const replies = getUnclassifiedReplies(focal.author || null, !classifyFiltered);
  if (replies.length === 0) {
    console.log(LOG, "No unclassified replies found");
    return;
  }

  console.log(LOG, "Running batch for", replies.length, "replies");

  // Mark as classified immediately to prevent re-sending
  for (const reply of replies) {
    classifiedIds.add(reply.id);
  }

  // Split into chunks to avoid exceeding LLM output token limits
  const chunks: Array<Array<{ id: string; text: string }>> = [];
  for (let i = 0; i < replies.length; i += MAX_BATCH_SIZE) {
    chunks.push(replies.slice(i, i + MAX_BATCH_SIZE));
  }
  console.log(LOG, "Split into", chunks.length, "chunk(s) of max", MAX_BATCH_SIZE);

  // Get provider config and enabled states
  const config = await aiProviderConfig.getValue();
  const states = await pluginStates.getValue();

  // Run each enabled classifier
  for (const classifier of allClassifiers) {
    // Check if classifier is enabled (defaults to classifier.defaultEnabled)
    const enabled = states[classifier.id] ?? classifier.defaultEnabled;
    if (!enabled) {
      console.log(LOG, "Classifier", classifier.id, "is disabled, skipping");
      continue;
    }

    const provider = config[classifier.slot];
    if (!provider) {
      console.log(
        LOG,
        "No",
        classifier.slot,
        "provider configured, skipping",
        classifier.id
      );
      continue;
    }

    let totalPositive = 0;
    let totalProcessed = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];

      try {
        const systemPrompt =
          "You are a content classifier. For each reply (keyed by ID) to a focal tweet, " +
          "answer the classification question with true or false. " +
          "Respond ONLY with a JSON object mapping each reply ID to a boolean.";

        const repliesObj: Record<string, string> = {};
        for (const r of chunk) {
          repliesObj[r.id] = r.text;
        }

        const userPrompt = JSON.stringify({
          classification: classifier.prompt,
          focal_tweet: focal.text,
          replies: repliesObj,
        });

        const responseFormat = {
          type: "json_schema",
          json_schema: {
            name: "classification_result",
            strict: true,
            schema: {
              type: "object",
              properties: Object.fromEntries(
                chunk.map((r) => [r.id, { type: "boolean" }])
              ),
              required: chunk.map((r) => r.id),
              additionalProperties: false,
            },
          },
        };

        console.log(LOG, "Sending", classifier.id, "chunk", ci + 1, "/", chunks.length, "with", chunk.length, "replies");

        const response = await sendClassificationRequest(
          provider,
          systemPrompt,
          userPrompt,
          responseFormat
        );

        // Parse JSON object from response
        let results: Record<string, boolean>;
        try {
          results = JSON.parse(response);
        } catch {
          console.error(LOG, "Failed to parse JSON response for chunk", ci + 1, ":", response.substring(0, 200));
          continue;
        }

        if (typeof results !== "object" || results === null) {
          console.error(LOG, "Response is not a JSON object for chunk", ci + 1, ":", results);
          continue;
        }

        // Publish results to cache
        for (const reply of chunk) {
          if (!(reply.id in results)) continue;
          let value = results[reply.id];
          if (classifier.invertResult) value = !value;
          if (value) totalPositive++;
          totalProcessed++;

          const existing =
            cache.get<Record<string, boolean>>("ai-classification", reply.id) ?? {};
          cache.set("ai-classification", reply.id, {
            ...existing,
            [classifier.id]: value,
          });
        }
      } catch (err) {
        console.error(LOG, "Classification failed for", classifier.id, "chunk", ci + 1, ":", err);
      }
    }

    console.log(
      LOG,
      classifier.id,
      "results:",
      totalPositive,
      "/",
      totalProcessed,
      "positive"
    );
  }
}

function scheduleBatch() {
  // Throttle, not debounce: don't reset the timer on new events.
  // This caps max wait for any reply at the throttle interval.
  if (debounceTimer) return;
  const delay = hasFiredFirst ? DEBOUNCE_MS : INITIAL_DEBOUNCE_MS;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    hasFiredFirst = true;
    runClassificationBatch();
  }, delay);
}

const aiClassification: DataCollector = {
  id: "ai-classification",
  name: "AI Classification",
  description:
    "Classifies replies using AI (vitriol, low-value, etc.) via configured LLM provider",
  category: "Data Sources",
  defaultEnabled: true,
  world: "isolated",
  options: [
    {
      id: "classify-filtered",
      label: "Classify filtered replies",
      description:
        "Also run AI classification on replies already collapsed by rule-based filters (LE, LWC, etc.)",
      type: "boolean",
      defaultValue: false,
    },
  ],

  init(cacheService: CacheService) {
    cache = cacheService;
    lastPath = window.location.pathname;

    console.log(
      LOG,
      "Init — discovered",
      allClassifiers.length,
      "classifiers:",
      allClassifiers.map((c) => c.id)
    );

    // Subscribe to tweet-data events to trigger batches
    tweetDataHandler = (_collectorId, _key, _value) => {
      scheduleBatch();
    };
    cache.on("tweet-data", tweetDataHandler);
  },

  cleanup() {
    console.log(LOG, "Cleanup");
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (cache && tweetDataHandler) {
      cache.off("tweet-data", tweetDataHandler);
      tweetDataHandler = null;
    }
    cache = null;
    classifiedIds.clear();
    hasFiredFirst = false;
    lastPath = "";
  },
};

export default aiClassification;
