import { head } from "@vercel/blob";
import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { CHAT_IMAGE_TYPES, MAX_CHAT_IMAGE_BYTES } from "@/lib/chat-attachments";
import { serializeAsset } from "@/lib/chat-media";
import { prisma } from "@/lib/prisma";

const finalizeImageSchema = z.object({
  chatId: z.string().cuid(),
  pathname: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(120),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, finalizeImageSchema);
    if (!input.pathname.startsWith(`chat-images/${input.chatId}/`)) {
      throw new HttpError(400, "Invalid chat image path.");
    }

    const chat = await prisma.chat.findFirst({ where: { id: input.chatId, userId: user.id }, select: { id: true } });
    if (!chat) throw new HttpError(404, "Chat not found.");

    const metadata = await head(input.pathname);
    if (!CHAT_IMAGE_TYPES.includes(metadata.contentType as (typeof CHAT_IMAGE_TYPES)[number]) || metadata.size > MAX_CHAT_IMAGE_BYTES) {
      throw new HttpError(400, "Unsupported image attachment.");
    }

    const asset = await prisma.mediaAsset.upsert({
      where: { pathname: metadata.pathname },
      create: {
        userId: user.id,
        chatId: chat.id,
        pathname: metadata.pathname,
        contentType: metadata.contentType,
        size: metadata.size,
        width: input.width,
        height: input.height,
        originalName: input.name
      },
      update: {},
    });
    if (asset.userId !== user.id || asset.chatId !== chat.id) {
      throw new HttpError(409, "That image is already registered elsewhere.");
    }

    return json({ attachment: serializeAsset(asset) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
