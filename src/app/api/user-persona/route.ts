import { z } from "zod";
import { getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { userPersonaSchema } from "@/lib/validation";
import { activateUserPersona, deleteUserPersona, getUserPersonaState, saveUserPersona } from "@/lib/user-persona-store";

export const dynamic = "force-dynamic";

const userPersonaUpsertSchema = userPersonaSchema.extend({
  profileId: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().min(1).max(80).optional(),
  chatId: z.string().trim().min(1).max(120).optional()
});

const userPersonaSwitchSchema = z.object({
  activeProfileId: z.string().trim().min(1).max(120),
  chatId: z.string().trim().min(1).max(120).optional()
});

const userPersonaDeleteSchema = z.object({
  profileId: z.string().trim().min(1).max(120).optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const chatId = new URL(request.url).searchParams.get("chatId");
    return json(await getUserPersonaState(user.id, chatId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "user-persona:write"
    });

    const input = await parseJson(request, userPersonaUpsertSchema);
    return json(await saveUserPersona(user.id, input, input.chatId));
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "user-persona:write"
    });

    const input = await parseJson(request, userPersonaSwitchSchema);
    return json(await activateUserPersona(user.id, input.activeProfileId, input.chatId));
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    await enforceRateLimit({
      userId: user.id,
      ip: getRequestIp(request),
      route: "user-persona:write"
    });

    const input = userPersonaDeleteSchema.parse((await request.json().catch(() => ({}))) ?? {});
    return json(await deleteUserPersona(user.id, input.profileId));
  } catch (error) {
    return routeError(error);
  }
}
