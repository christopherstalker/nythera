import type { ProviderErrorClassification } from "./provider-errors.js";

type ProviderStage = "routing" | "request" | "network" | "response" | "stream";

export function providerErrorDiagnostic(
  error: unknown,
  classified: ProviderErrorClassification,
  context: { provider: string; model: string; stage: ProviderStage; durationMs: number; credentialPresent: boolean }
) {
  const causes: Array<{ errorType: string; code?: string }> = [];
  const seen = new Set<unknown>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause) && causes.length < 5) {
    seen.add(cause);
    const name = cause instanceof Error ? cause.name : "Error";
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : "";
    causes.push({
      errorType:
        /^(?:Error|TypeError|SyntaxError|AbortError|TimeoutError|API\w*Error|GoogleGenerativeAI\w*Error)$/.test(name)
          ? name
          : "Error",
      ...(/^(?:E[A-Z_]+|UND_ERR_[A-Z_]+|CERT_[A-Z_]+|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE)$/.test(
        code
      )
        ? { code }
        : {})
    });
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return {
    ...context,
    stage:
      classified.code === "provider_not_configured"
        ? "routing"
        : classified.code === "network_error"
          ? "network"
          : classified.code === "invalid_response" || classified.status !== null
            ? "response"
            : context.stage,
    status: classified.status,
    errorType: causes[0]?.errorType ?? "Error",
    errorCode: classified.code,
    // Provider messages can echo prompts or credentials; log only the classified message and cause metadata.
    message: classified.message,
    causes
  };
}
