import { timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { streamGatewayResponse } from "@/lib/llm-gateway";
import { logSafeError } from "@/lib/secret-redaction";
import { prisma } from "@/lib/prisma";
import { providerModelValue, splitProviderModelValue } from "@/lib/provider-model-options";
import { getEffectiveProviderKeys, getServerProviderKeys } from "@/lib/user-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EXPECTED_MARKER = "NYTHERA_GUARDIAN_OK";

export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();

  if (!env.GUARDIAN_SHARED_SECRET) {
    return Response.json({ ok: false, error: "Guardian is not configured." }, { status: 503 });
  }
  if (!hasValidBearerToken(request, env.GUARDIAN_SHARED_SECRET)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  console.log(JSON.stringify({ level: "info", event: "guardian_canary_start", requestId }));

  try {
    const canary = await resolveCanaryConfiguration();
    if (canary.providerKeys.length === 0) {
      throw new Error("No provider keys are configured for the Guardian canary.");
    }

    let output = "";
    let safeError: string | null = null;
    let usage: {
      provider: string;
      model: string;
      fallbackTriggered: boolean;
      attempts: string[];
      latencyMs?: number;
    } | null = null;

    for await (const chunk of streamGatewayResponse({
      messages: [
        { role: "system", content: `Return exactly ${EXPECTED_MARKER}. Do not add punctuation or commentary.` },
        { role: "user", content: "Run the availability check now." }
      ],
      model: canary.model,
      temperature: 0,
      maxTokens: 32,
      userId: canary.userId,
      chatId: "guardian-canary",
      healthCheck: true,
      providerKeys: canary.providerKeys,
      signal: request.signal
    })) {
      if (chunk.type === "delta") output += chunk.text;
      if (chunk.type === "error") safeError = chunk.message;
      if (chunk.type === "usage") {
        usage = {
          provider: chunk.provider,
          model: chunk.model,
          fallbackTriggered: chunk.fallbackTriggered ?? false,
          attempts: chunk.attempts ?? [],
          latencyMs: chunk.latencyMs
        };
      }
    }

    const markerMatched = output.trim().includes(EXPECTED_MARKER);
    if (safeError || !usage || !markerMatched) {
      console.error(JSON.stringify({
        level: "error",
        event: "guardian_canary_failed",
        requestId,
        durationMs: Date.now() - startedAt,
        reason: safeError ? "gateway_error" : !usage ? "missing_usage" : "invalid_response"
      }));
      return Response.json({
        ok: false,
        error: safeError ?? "The provider returned an invalid canary response.",
        durationMs: Date.now() - startedAt
      }, { status: 503 });
    }

    const response = {
      ok: true,
      status: usage.fallbackTriggered ? "degraded" : "healthy",
      provider: usage.provider,
      model: usage.model,
      fallbackTriggered: usage.fallbackTriggered,
      attempts: usage.attempts,
      providerLatencyMs: usage.latencyMs,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    };
    console.log(JSON.stringify({ level: "info", event: "guardian_canary_complete", requestId, ...response }));
    return Response.json(response, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logSafeError("Guardian canary failed.", error);
    console.error(JSON.stringify({
      level: "error",
      event: "guardian_canary_failed",
      requestId,
      durationMs: Date.now() - startedAt,
      reason: "internal_error"
    }));
    return Response.json({ ok: false, error: "Guardian canary failed.", durationMs: Date.now() - startedAt }, { status: 503 });
  }
}

async function resolveCanaryConfiguration() {
  if (env.GUARDIAN_CANARY_USER_ID) {
    const [user, providerKeys] = await Promise.all([
      prisma.user.findUnique({
        where: { id: env.GUARDIAN_CANARY_USER_ID },
        select: { id: true, preferredProvider: true, preferredModel: true }
      }),
      getEffectiveProviderKeys(env.GUARDIAN_CANARY_USER_ID)
    ]);
    if (!user) throw new Error("Guardian canary user does not exist.");

    const primary = providerKeys.find((key) => key.isDefault) ?? providerKeys[0];
    const selectedKey = providerKeys.find((key) => key.provider === user.preferredProvider) ?? primary;
    const rawModel = selectedKey?.defaultModel || user.preferredModel;
    const model = env.GUARDIAN_CANARY_MODEL ?? (splitProviderModelValue(rawModel)
      ? rawModel
      : selectedKey && rawModel
        ? providerModelValue(selectedKey.provider, rawModel)
        : rawModel);
    if (!model) throw new Error("Guardian canary model is not configured.");

    return { userId: user.id, model, providerKeys };
  }

  const providerKeys = getServerProviderKeys();
  const primary = providerKeys[0];
  if (!primary?.defaultModel) throw new Error("Guardian requires a canary user or a platform provider key.");
  return {
    userId: "guardian-platform-canary",
    model: env.GUARDIAN_CANARY_MODEL ?? providerModelValue(primary.provider, primary.defaultModel),
    providerKeys
  };
}

function hasValidBearerToken(request: Request, expected: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
