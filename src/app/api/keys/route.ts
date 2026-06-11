import { LlmProvider } from "@prisma/client";
import { z } from "zod";
import { deleteUserApiKey, listUserApiKeys, saveUserApiKey } from "@/lib/user-keys";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";

const saveKeySchema = z.object({
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI"]),
  apiKey: z.string().min(10).max(400),
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
    const key = await saveUserApiKey({
      userId: user.id,
      provider: input.provider as LlmProvider,
      apiKey: input.apiKey,
      label: input.label
    });

    return json({
      key: {
        id: key.id,
        provider: key.provider,
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
    if (!provider || !["OPENAI", "ANTHROPIC", "GEMINI"].includes(provider)) {
      throw new HttpError(400, "Valid provider is required.");
    }

    await deleteUserApiKey({
      userId: user.id,
      provider: provider as LlmProvider
    });

    return json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
