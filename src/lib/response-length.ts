export const RESPONSE_LENGTH_OPTIONS = [
  {
    value: "short",
    label: "Short",
    description: "1-2 compact paragraphs",
    promptInstruction: "Write 1-2 compact paragraphs and stay within 60-140 words.",
    verbosityLevel: "concise",
    maxOutputTokens: 240
  },
  {
    value: "medium",
    label: "Medium",
    description: "2-4 developed paragraphs",
    promptInstruction: "Write 2-4 developed paragraphs and stay within 140-320 words.",
    verbosityLevel: "balanced",
    maxOutputTokens: 520
  },
  {
    value: "long",
    label: "Long",
    description: "4-7 immersive paragraphs",
    promptInstruction: "Write 4-7 immersive paragraphs and stay within 320-650 words.",
    verbosityLevel: "immersive",
    maxOutputTokens: 1_050
  }
] as const;

export type MessageLength = (typeof RESPONSE_LENGTH_OPTIONS)[number]["value"];
export type ResponseVerbosity = (typeof RESPONSE_LENGTH_OPTIONS)[number]["verbosityLevel"] | "expressive";

const GEMINI_THINKING_TOKEN_RESERVE = 1_536;

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
    return "Write 3-5 detailed paragraphs and stay within 240-480 words.";
  }

  return RESPONSE_LENGTH_OPTIONS.find((option) => option.verbosityLevel === verbosity)!.promptInstruction;
}

export function maxOutputTokensForVerbosity(verbosity: ResponseVerbosity, configuredLimit?: number | null) {
  const lengthLimit = verbosity === "expressive"
    ? 780
    : RESPONSE_LENGTH_OPTIONS.find((option) => option.verbosityLevel === verbosity)!.maxOutputTokens;

  return configuredLimit == null ? lengthLimit : Math.min(configuredLimit, lengthLimit);
}

export function providerOutputTokenBudget(input: {
  visibleTokenLimit: number;
  provider?: string | null;
  model?: string | null;
}) {
  const provider = input.provider?.trim().toLowerCase() ?? "";

  if (provider !== "gemini") {
    return input.visibleTokenLimit;
  }

  return Math.min(4_096, input.visibleTokenLimit + GEMINI_THINKING_TOKEN_RESERVE);
}
