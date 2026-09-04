import { z } from "zod";
import { deleteUserApiKey, listUserApiKeys, normalizeProviderId, saveUserApiKey } from "@/lib/user-keys";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url";
import { enforceFirstClassProviderConfig } from "@/lib/provider-presets";
import { validateProviderCredentials } from "@/lib/provider-model-catalog";
import { prisma } from "@/lib/prisma";

const saveKeySchema = z.object({
  provider: z.string().trim().min(2).max(48).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Provider IDs may contain letters, numbers, hyphens, and underscores only."),
  displayName: z.string().trim().min(2).max(80).optional(),
  apiFormat: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "OPENAI_COMPATIBLE"]).default("OPENAI_COMPATIBLE"),
  baseUrl: z.string().url().max(240).optional().or(z.literal("")),
  defaultModel: z.string().min(1).max(120).optional().or(z.literal("")),
  apiKey: z.string().min(6).max(1200),
  label: z.string().max(80).optional()
});

const providerSettingsSchema = z.object({
  maxOutputTokens: z.number().int().min(128).max(4096).nullable()
});

export async function GET() {
  try {
    const user = await requireUser();
    const keys = await listUserApiKeys(user.id);
    return json({ keys, maxOutputTokens: user.maxOutputTokens });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, providerSettingsSchema);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { maxOutputTokens: input.maxOutputTokens },
      select: { maxOutputTokens: true }
    });

    return json(updated);
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, saveKeySchema);
    const provider = normalizeProviderId(input.provider);
    if (!provider) {
      throw new HttpError(400, "Provider id is required.");
    }
    const config = enforceFirstClassProviderConfig({
      provider,
      displayName: input.displayName?.trim() || provider,
      apiFormat: input.apiFormat,
      baseUrl: input.baseUrl?.trim() || "",
      defaultModel: input.defaultModel?.trim() || ""
    });
    const baseUrl = config.baseUrl ? await assertSafeOutboundUrl(config.baseUrl) : "";
    const validation = await validateProviderCredentials({
      provider: config.provider,
      displayName: config.displayName,
      apiFormat: config.apiFormat,
      baseUrl,
      defaultModel: config.defaultModel,
      apiKey: input.apiKey.trim()
    });
    if (!validation.ok) {
      throw new HttpError(validation.status, validation.message);
    }

    const key = await saveUserApiKey({
      userId: user.id,
      provider: config.provider,
      displayName: config.displayName,
      apiFormat: config.apiFormat,
      baseUrl,
      defaultModel: config.defaultModel,
      apiKey: input.apiKey,
      label: input.label
    });

    return json({
      key: {
        id: key.id,
        provider: key.provider,
        displayName: key.displayName,
        apiFormat: key.apiFormat,
        baseUrl: key.baseUrl,
        defaultModel: key.defaultModel,
        label: key.label,
        last4: key.last4,
        isDefault: key.isDefault,
        providerPriority: key.providerPriority,
        credentialStatus: key.credentialStatus,
        validatedAt: key.validatedAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt
      },
      catalog: validation.catalog
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const searchParams = new URL(request.url).searchParams;
    const keyId = searchParams.get("id");
    const provider = searchParams.get("provider");
    if (!keyId && (!provider || !normalizeProviderId(provider))) {
      throw new HttpError(400, "A valid key id or provider is required.");
    }

    await deleteUserApiKey({
      userId: user.id,
      keyId,
      provider
    });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
