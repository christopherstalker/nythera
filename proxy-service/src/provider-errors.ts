export type ProviderErrorClassification = {
  code: "invalid_api_key" | "insufficient_balance" | "prompt_too_large" | "invalid_parameters" | "rate_limit" | "model_unavailable" | "provider_unavailable" | "provider_not_configured" | "network_error" | "provider_error";
  message: string;
  status: number | null;
  retryable: boolean;
};

export function classifyProviderError(error: unknown): ProviderErrorClassification {
  const status = readStatus(error);
  const message = readMessage(error).toLowerCase();
  const reportsTemporaryOutage =
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("provider unavailable") ||
    message.includes("provider is unavailable") ||
    message.includes("overloaded") ||
    message.includes("empty response") ||
    message.includes("try again later");
  const reportsPromptLimit = message.includes("prompt tokens limit exceeded") || message.includes("maximum context length") || message.includes("context length exceeded");

  if (status === 401 || status === 403 || message.includes("api key not valid")) {
    return { code: "invalid_api_key", message: "The selected provider rejected the API key. Check the key in Settings.", status: status ?? 401, retryable: false };
  }
  if (reportsPromptLimit) {
    return { code: "prompt_too_large", message: "The request exceeded this provider's context limit. Nythera will shorten older history before retrying.", status, retryable: false };
  }
  if (status === 402) {
    return { code: "insufficient_balance", message: "The provider account cannot cover this request. Add credits, reduce the response length, or choose another provider.", status, retryable: false };
  }
  if (status === 400 || status === 422) {
    return { code: "invalid_parameters", message: "The selected provider rejected the request parameters. Refresh its model list and try again.", status, retryable: false };
  }
  if (status === 429) {
    return { code: "rate_limit", message: "The selected provider's rate limit was reached. Wait a moment and try again.", status, retryable: true };
  }
  if (status === 404 || message.includes("model") && message.includes("not found")) {
    return { code: "model_unavailable", message: "The selected model is unavailable. Choose another model in Settings.", status, retryable: false };
  }
  if ((status !== null && status >= 500) || reportsTemporaryOutage) {
    return { code: "provider_unavailable", message: "The selected model provider is temporarily unavailable. Try again shortly.", status, retryable: true };
  }
  if (message.includes("not configured") || message.includes("base url is required")) {
    return { code: "provider_not_configured", message: "No usable model provider is configured. Add or update a model key in Settings.", status, retryable: false };
  }
  if (message.includes("fetch failed") || message.includes("network") || message.includes("timeout") || message.includes("econn")) {
    return { code: "network_error", message: "Nythera could not reach the selected model provider. Check the connection and try again.", status, retryable: true };
  }
  return { code: "provider_error", message: "The selected model provider rejected the request. Check the provider and model settings.", status, retryable: false };
}

function readStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = "status" in error ? error.status : "statusCode" in error ? error.statusCode : null;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "";
}
