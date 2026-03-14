import type { AiClassifier } from "../types";

const dumb: AiClassifier = {
  id: "dumb",
  name: "Low-Value Detection",
  description: "Detects replies that don't contribute any real value to the conversation",
  acronym: "DUM",
  slot: "fast",
  defaultEnabled: true,
  prompt: "Given this focal tweet, does this reply fail to contribute any real value to the discussion?",
};

export default dumb;
