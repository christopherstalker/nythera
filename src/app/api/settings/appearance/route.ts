import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { requireAdultConsent } from "@/lib/adult-consent";
import { normalizeChatAppearance } from "@/lib/chat-appearance";
import { chatAppearanceSchema } from "@/lib/validation";

const chatIdSchema = z.string().min(1).max(120).optional();
const updateSchema = z.object({ chatId: chatIdSchema, appearance: chatAppearanceSchema });
const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const chatId = chatIdSchema.parse(new URL(request.url).searchParams.get("chatId") ?? undefined);
    if (chatId) {
      requireAdultConsent(user);
      const chat = await prisma.chat.findFirst({
        where: { id: chatId, userId: user.id },
        select: { id: true, title: true, appearance: true, character: { select: { name: true } } }
      });
      if (!chat) throw new HttpError(404, "Conversation not found.");
      return json(
        {
          appearance: normalizeChatAppearance(chat.appearance),
          story: { id: chat.id, title: chat.title || chat.character.name, character: chat.character.name }
        },
        { headers: privateHeaders }
      );
    }
    const preferences = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { chatAppearance: true }
    });
    return json(
      { appearance: normalizeChatAppearance(preferences.chatAppearance), story: null },
      { headers: privateHeaders }
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, updateSchema);
    if (input.chatId) {
      requireAdultConsent(user);
      const updated = await prisma.chat.updateMany({
        where: { id: input.chatId, userId: user.id },
        data: { appearance: input.appearance }
      });
      if (!updated.count) throw new HttpError(404, "Conversation not found.");
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { chatAppearance: input.appearance } });
    }
    return json({ appearance: input.appearance }, { headers: privateHeaders });
  } catch (error) {
    return routeError(error);
  }
}
