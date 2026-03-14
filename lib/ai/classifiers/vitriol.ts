import type { AiClassifier } from "../types";

const vitriol: AiClassifier = {
  id: "vitriol",
  name: "Vitriol Detection",
  description: "Detects vitriolic, hostile, or toxic language in replies",
  acronym: "VIT",
  slot: "fast",
  defaultEnabled: true,
  prompt: "Given this focal tweet, does this reply lean into vitriolic language?",
};

export default vitriol;
