import { head, put } from "@vercel/blob";
import { z } from "zod";
import { HttpError, json, parseJson, requireUser, routeError } from "@/lib/api";
import { CHAT_IMAGE_BLOB_ACCESS, CHAT_IMAGE_TYPES, MAX_CHAT_IMAGE_BYTES } from "@/lib/chat-attachments";
import { serializeAsset } from "@/lib/chat-media";
import { prisma } from "@/lib/prisma";

const finalizeImageSchema = z.object({
  chatId: z.string().cuid(),
  pathname: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(120),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000)
});

const uploadImageSchema = z.object({
  chatId: z.string().cuid(),
  name: z.string().trim().min(1).max(120),
  width: z.coerce.number().int().min(1).max(10000),
  height: z.coerce.number().int().min(1).max(10000)
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const response = await uploadImage(request, user.id);
      return response;
    }

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

async function uploadImage(request: Request, userId: string) {
  const form = await request.formData();
  const image = form.get("image");
  const input = uploadImageSchema.parse({
    chatId: form.get("chatId"),
    name: form.get("name"),
    width: form.get("width"),
    height: form.get("height")
  });
  if (
    !(image instanceof File) ||
    !CHAT_IMAGE_TYPES.includes(image.type as (typeof CHAT_IMAGE_TYPES)[number]) ||
    image.size > MAX_CHAT_IMAGE_BYTES
  ) {
    throw new HttpError(400, "Unsupported image attachment.");
  }

  const chat = await prisma.chat.findFirst({ where: { id: input.chatId, userId }, select: { id: true } });
  if (!chat) throw new HttpError(404, "Chat not found.");

  const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "image.jpg";
  const blob = await put(`chat-images/${chat.id}/${Date.now()}-${safeName}`, image, {
    access: CHAT_IMAGE_BLOB_ACCESS,
    addRandomSuffix: true,
    contentType: image.type
  });
  const asset = await prisma.mediaAsset.create({
    data: {
      userId,
      chatId: chat.id,
      pathname: blob.pathname,
      contentType: image.type,
      size: image.size,
      width: input.width,
      height: input.height,
      originalName: input.name
    }
  });

  return json({ attachment: serializeAsset(asset) }, { status: 201 });
}
