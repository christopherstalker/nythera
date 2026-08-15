import "server-only";

import OpenAI from "openai";
import { HttpError } from "@/lib/api";
import { splitProviderModelValue } from "@/lib/provider-model-options";
import { logSafeError } from "@/lib/secret-redaction";
import type { ProviderKey } from "@/lib/user-keys";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
const OPENAI_IMAGE_MODEL = "gpt-image-2";
const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

type ImageProvider = "gemini" | "openai";

type ProviderFailure = {
  provider: ImageProvider;
  status: number;
  message: string;
};

export type GeneratedSceneImage = {
  bytes: Buffer;
  contentType: string;
  provider: "Gemini" | "OpenAI";
  model: string;
};

export async function generateSceneImageWithFallback(input: {
  keys: ProviderKey[];
  preferredModel?: string | null;
  prompt: string;
}): Promise<GeneratedSceneImage> {
  const preferredProvider = imageProviderForModel(input.preferredModel);
  const candidates = input.keys
    .filter((key) => key.credentialStatus !== "INVALID" && isImageProvider(key.provider))
    .map((key, index) => ({ key, index }))
    .sort((left, right) => {
      const leftPreferred = left.key.provider === preferredProvider ? 0 : 1;
      const rightPreferred = right.key.provider === preferredProvider ? 0 : 1;
      return leftPreferred - rightPreferred || left.index - right.index;
    });

  if (candidates.length === 0) {
    throw new HttpError(400, "Add a Gemini or OpenAI key in Settings to generate scene illustrations.");
  }

  const failures: ProviderFailure[] = [];
  for (const { key } of candidates) {
    try {
      return key.provider === "gemini"
        ? await generateWithGemini(key, input.prompt)
        : await generateWithOpenAI(key, input.prompt);
    } catch (error) {
      const failure = classifyProviderFailure(key.provider as ImageProvider, error);
      failures.push(failure);
      logSafeError(`${failure.provider} scene illustration failed.`, error);
    }
  }

  const primary = failures[0];
  const attemptedProviders = Array.from(new Set(failures.map((failure) => providerLabel(failure.provider))));
  const suffix = attemptedProviders.length > 1 ? ` Tried ${attemptedProviders.join(" and ")}.` : "";
  throw new HttpError(primary?.status ?? 502, `${primary?.message ?? "Scene illustration failed."}${suffix}`);
}

async function generateWithGemini(key: ProviderKey, prompt: string): Promise<GeneratedSceneImage> {
  const response = await fetch(GEMINI_INTERACTIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key.apiKey
    },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      input: [{ type: "text", text: prompt }],
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "1:1",
        image_size: "1K"
      }
    }),
    signal: AbortSignal.timeout(50_000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw providerResponseError(response.status, payload);
  }

  const image = findEncodedImage(payload);
  if (!image) {
    throw new Error("Gemini returned no image data.");
  }

  return {
    bytes: Buffer.from(image.data, "base64"),
    contentType: image.contentType,
    provider: "Gemini",
    model: GEMINI_IMAGE_MODEL
  };
}

async function generateWithOpenAI(key: ProviderKey, prompt: string): Promise<GeneratedSceneImage> {
  const generated = await new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl || undefined }).images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size: "1024x1024"
  });
  const encoded = generated.data?.[0]?.b64_json;
  if (!encoded) {
    throw new Error("OpenAI returned no image data.");
  }

  return {
    bytes: Buffer.from(encoded, "base64"),
    contentType: "image/png",
    provider: "OpenAI",
    model: OPENAI_IMAGE_MODEL
  };
}

function findEncodedImage(value: unknown) {
  const pending: unknown[] = [value];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (!Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      const contentType = typeof record.mime_type === "string"
        ? record.mime_type
        : typeof record.mimeType === "string"
          ? record.mimeType
          : "";
      if (contentType.startsWith("image/") && typeof record.data === "string" && record.data.length > 0) {
        return { data: record.data, contentType };
      }
    }

    pending.push(...(Array.isArray(current) ? current : Object.values(current)));
  }

  return null;
}

function providerResponseError(status: number, payload: unknown) {
  const error = new Error(providerErrorMessage(payload));
  return Object.assign(error, { status, code: providerErrorCode(payload) });
}

function providerErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "Image provider request failed.";
  }
  const nested = (payload as { error?: unknown }).error;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Image provider request failed.";
}

function providerErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const nested = (payload as { error?: unknown }).error;
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return undefined;
  const code = (nested as { code?: unknown; status?: unknown }).code ?? (nested as { status?: unknown }).status;
  return typeof code === "string" || typeof code === "number" ? String(code) : undefined;
}

function classifyProviderFailure(provider: ImageProvider, error: unknown): ProviderFailure {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof record.status === "number" ? record.status : 0;
  const code = typeof record.code === "string" ? record.code.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const label = providerLabel(provider);

  if (status === 401 || status === 403 || code.includes("api_key")) {
    return { provider, status: 400, message: `${label} rejected this API key. Update it in Settings.` };
  }
  if (status === 429 && /quota|billing|credit|balance|spend/.test(`${code} ${message}`)) {
    return { provider, status: 429, message: `${label} API credits or spending limit are exhausted.` };
  }
  if (status === 429) {
    return { provider, status: 429, message: `${label} image rate limit was reached. Try again shortly.` };
  }
  if (status === 404 || code.includes("model") || message.includes("model not found")) {
    return { provider, status: 400, message: `${label} image generation is not available for this key.` };
  }
  if (status === 400 && /safety|policy|blocked|responsible/.test(`${code} ${message}`)) {
    return { provider, status: 400, message: `${label} could not illustrate this scene. Adjust the scene description and try again.` };
  }
  if (status === 400) {
    return { provider, status: 400, message: `${label} rejected the image request. Check image-model access for this key.` };
  }
  if (status >= 500 || error instanceof DOMException && error.name === "TimeoutError") {
    return { provider, status: 502, message: `${label} image service is temporarily unavailable.` };
  }
  return { provider, status: 502, message: `${label} image generation failed.` };
}

function imageProviderForModel(value?: string | null): ImageProvider | null {
  const parsed = splitProviderModelValue(value);
  if (parsed && isImageProvider(parsed.provider)) {
    return parsed.provider;
  }
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("gemini")) return "gemini";
  if (/^(gpt|o\d|chatgpt|openai)/.test(normalized)) return "openai";
  return null;
}

function isImageProvider(value: string): value is ImageProvider {
  return value === "gemini" || value === "openai";
}

function providerLabel(provider: ImageProvider) {
  return provider === "gemini" ? "Gemini" : "OpenAI";
}
