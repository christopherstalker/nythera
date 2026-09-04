import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { HttpError, json, requireUser, routeError } from "@/lib/api";
import { CHAT_IMAGE_TYPES, MAX_CHAT_IMAGE_BYTES } from "@/lib/chat-attachments";

type UploadPayload = { chatId?: unknown };

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await requireUser();
        const payload = parsePayload(clientPayload);
        const chatId = typeof payload.chatId === "string" ? payload.chatId : "";
        if (!chatId || !pathname.startsWith(`chat-images/${chatId}/`)) {
          throw new HttpError(400, "Invalid chat image upload path.");
        }

        const chat = await prisma.chat.findFirst({ where: { id: chatId, userId: user.id }, select: { id: true } });
        if (!chat) throw new HttpError(404, "Chat not found.");

        return {
          allowedContentTypes: [...CHAT_IMAGE_TYPES],
          maximumSizeInBytes: MAX_CHAT_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ chatId, userId: user.id })
        };
      }
    });
    return json(response);
  } catch (error) {
    return routeError(error);
  }
}

function parsePayload(value: string | null): UploadPayload {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as UploadPayload : {};
  } catch {
    return {};
  }
}
