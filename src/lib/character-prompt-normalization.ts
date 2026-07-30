const RELATIONSHIP_STYLES = ["friend", "romantic", "mentor", "rival", "antagonist"] as const;
const INITIATIVE_LEVELS = ["low", "medium", "high"] as const;
const VERBOSITY_LEVELS = ["concise", "balanced", "expressive", "immersive"] as const;
const MESSAGE_LENGTHS = ["short", "medium", "long"] as const;

export function normalizePromptGeneratedCandidate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  return {
    ...candidate,
    tags: normalizeTags(candidate.tags),
    personaTraits: normalizeStringList(candidate.personaTraits, 16, 160),
    relationshipStyle: normalizeRelationshipStyle(candidate.relationshipStyle),
    initiativeLevel: normalizeInitiativeLevel(candidate.initiativeLevel),
    verbosityLevel: normalizeVerbosityLevel(candidate.verbosityLevel),
    behavioralRules: normalizeStringList(candidate.behavioralRules, 12, 200),
    boundaries: normalizeStringList(candidate.boundaries, 12, 200),
    forbiddenBehaviors:
      candidate.forbiddenBehaviors === undefined
        ? undefined
        : normalizeStringList(candidate.forbiddenBehaviors, 12, 200),
    isNSFW: normalizeBoolean(candidate.isNSFW),
    humor: normalizeScale(candidate.humor),
    romanceLevel: normalizeScale(candidate.romanceLevel),
    seriousness: normalizeScale(candidate.seriousness),
    initiative: normalizeScale(candidate.initiative),
    messageLength: normalizeMessageLength(candidate.messageLength),
    roleplayIntensity: normalizeScale(candidate.roleplayIntensity)
  };
}

function normalizeTags(value: unknown) {
  const tags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n;]+/)
      : [];

  return tags
    .map((tag) => String(tag).trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 32))
    .slice(0, 12);
}

function normalizeStringList(value: unknown, limit: number, itemLimit: number) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|;|(?:^|\s)[•*-]\s+/)
      : [];

  return items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => item.slice(0, itemLimit))
    .slice(0, limit);
}

function normalizeRelationshipStyle(value: unknown): (typeof RELATIONSHIP_STYLES)[number] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (isMember(normalized, RELATIONSHIP_STYLES)) {
    return normalized;
  }
  if (/romanc|lover|partner/.test(normalized)) return "romantic";
  if (/mentor|teacher|guide/.test(normalized)) return "mentor";
  if (/rival|compet/.test(normalized)) return "rival";
  if (/antagon|enemy|villain|hostile/.test(normalized)) return "antagonist";
  return "friend";
}

function normalizeInitiativeLevel(value: unknown): (typeof INITIATIVE_LEVELS)[number] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (isMember(normalized, INITIATIVE_LEVELS)) {
    return normalized;
  }
  if (normalized.includes("high")) return "high";
  if (normalized.includes("low")) return "low";
  return "medium";
}

function normalizeVerbosityLevel(value: unknown): (typeof VERBOSITY_LEVELS)[number] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (isMember(normalized, VERBOSITY_LEVELS)) {
    return normalized;
  }
  if (/immersive|very long/.test(normalized)) return "immersive";
  if (/expressive|detailed|long|verbose/.test(normalized)) return "expressive";
  if (/concise|short|brief/.test(normalized)) return "concise";
  return "balanced";
}

function normalizeMessageLength(value: unknown): (typeof MESSAGE_LENGTHS)[number] | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (isMember(normalized, MESSAGE_LENGTHS)) {
    return normalized;
  }
  if (/long|extended|detailed/.test(normalized)) return "long";
  if (/short|brief|concise/.test(normalized)) return "short";
  if (normalized) return "medium";
  return undefined;
}

function normalizeScale(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampScale(value);
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  const numeric = normalized.match(/-?\d+(?:\.\d+)?/)?.[0];
  if (numeric !== undefined) {
    return clampScale(Number(numeric));
  }
  if (normalized.includes("high")) return 8;
  if (normalized.includes("low")) return 3;
  if (normalized.includes("medium") || normalized.includes("moderate")) return 5;
  return undefined;
}

function clampScale(value: number) {
  return Math.min(10, Math.max(0, value));
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return undefined;
}

function isMember<const T extends readonly string[]>(value: string, options: T): value is T[number] {
  return options.includes(value as T[number]);
}
