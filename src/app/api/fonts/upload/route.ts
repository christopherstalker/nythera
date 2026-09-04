import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { HttpError, json, requireUser, routeError } from "@/lib/api";

const MAX_FONT_BYTES = 10 * 1024 * 1024;
const ALLOWED_FONT_TYPES = [
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "font/sfnt",
  "application/font-woff",
  "application/vnd.ms-opentype",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/octet-stream"
];

type UploadPayload = {
  scope?: unknown;
  chatId?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await requireUser();
        const payload = parsePayload(clientPayload);
        const scope = payload.scope === "chat" ? "chat" : payload.scope === "profile" ? "profile" : null;

        if (scope === "profile") {
          if (!pathname.startsWith("profile-fonts/")) throw new HttpError(400, "Invalid profile font path.");
        } else if (scope === "chat") {
          const chatId = typeof payload.chatId === "string" ? payload.chatId : "";
          if (!chatId || !pathname.startsWith(`chat-fonts/${chatId}/`)) throw new HttpError(400, "Invalid chat font path.");
          const chat = await prisma.chat.findFirst({ where: { id: chatId, userId: user.id }, select: { id: true } });
          if (!chat) throw new HttpError(404, "Chat not found.");
        } else {
          throw new HttpError(400, "Invalid font upload scope.");
        }

        return {
          allowedContentTypes: ALLOWED_FONT_TYPES,
          maximumSizeInBytes: MAX_FONT_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id, scope })
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
