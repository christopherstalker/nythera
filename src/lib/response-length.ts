export const RESPONSE_LENGTH_OPTIONS = [
  {
    value: "short",
    label: "Short",
    description: "1-2 compact paragraphs",
    promptInstruction: "Write 1-2 compact paragraphs, usually 60-140 words.",
    verbosityLevel: "concise"
  },
  {
    value: "medium",
    label: "Medium",
    description: "2-4 developed paragraphs",
    promptInstruction: "Write 2-4 developed paragraphs, usually 140-320 words.",
    verbosityLevel: "balanced"
  },
  {
    value: "long",
    label: "Long",
    description: "4-7 immersive paragraphs",
    promptInstruction: "Write 4-7 immersive paragraphs, usually 320-650 words.",
    verbosityLevel: "immersive"
  }
] as const;

export type MessageLength = (typeof RESPONSE_LENGTH_OPTIONS)[number]["value"];
export type ResponseVerbosity = (typeof RESPONSE_LENGTH_OPTIONS)[number]["verbosityLevel"] | "expressive";

export function normalizeMessageLength(value: unknown, fallback: MessageLength = "medium"): MessageLength {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return RESPONSE_LENGTH_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as MessageLength)
    : fallback;
}

export function verbosityForMessageLength(value: unknown) {
  const normalized = normalizeMessageLength(value);
  return RESPONSE_LENGTH_OPTIONS.find((option) => option.value === normalized)!.verbosityLevel;
}

export function responseLengthTarget(verbosity: ResponseVerbosity) {
  if (verbosity === "expressive") {
    return "Write 3-5 detailed paragraphs, usually 240-480 words.";
  }

  return RESPONSE_LENGTH_OPTIONS.find((option) => option.verbosityLevel === verbosity)!.promptInstruction;
}
