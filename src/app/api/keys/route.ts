import { z } from "zod";
import { deleteUserApiKey, listUserApiKeys, normalizeProviderId, saveUserApiKey } from "@/lib/user-keys";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url";

const saveKeySchema = z.object({
  provider: z.string().min(2).max(48),
  displayName: z.string().min(2).max(80).optional(),
  apiFormat: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "OPENAI_COMPATIBLE"]).default("OPENAI_COMPATIBLE"),
  baseUrl: z.string().url().max(240).optional().or(z.literal("")),
  defaultModel: z.string().min(1).max(120).optional().or(z.literal("")),
  apiKey: z.string().min(6).max(1200),
  label: z.string().max(80).optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const keys = await listUserApiKeys(user.id);
    return json({ keys });
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
    const baseUrl = input.baseUrl ? await assertSafeOutboundUrl(input.baseUrl) : "";

    const key = await saveUserApiKey({
      userId: user.id,
      provider,
      displayName: input.displayName,
      apiFormat: input.apiFormat,
      baseUrl,
      defaultModel: input.defaultModel,
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
        createdAt: key.createdAt,
        updatedAt: key.updatedAt
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const provider = new URL(request.url).searchParams.get("provider");
    if (!provider || !normalizeProviderId(provider)) {
      throw new HttpError(400, "Valid provider is required.");
    }

    await deleteUserApiKey({
      userId: user.id,
      provider
    });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
