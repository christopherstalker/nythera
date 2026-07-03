import "server-only";

const SENSITIVE_NAME_PATTERN = /^(authorization|proxy-authorization|api[-_]?key|apikey|key|token|secret|password|encryptedkey|x-api-key|xi-api-key)$/i;
const INLINE_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer ***"],
  [/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "***"],
  [/((?:api[-_]?key|authorization|token|secret|password|xi-api-key)\s*[:=]\s*)(["']?)[^"',\s}]+/gi, "$1$2***"]
];

export function redactSensitiveString(value: string) {
  return INLINE_SECRET_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function redactForLog(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return redactSensitiveString(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      stack: value.stack ? redactSensitiveString(value.stack) : undefined
    };
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= 4) {
    return "[Redacted: max depth]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_NAME_PATTERN.test(key) ? "***" : redactForLog(entry, depth + 1, seen)
    ])
  );
}

export function logSafeError(message: string, error: unknown) {
  console.error(message, redactForLog(error));
}
