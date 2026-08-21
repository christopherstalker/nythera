import "server-only";

import { get } from "@vercel/blob";
import type { MediaAsset, MessageAttachment } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { CHAT_IMAGE_BLOB_ACCESS, CHAT_IMAGE_TYPES, MAX_CHAT_IMAGE_ATTACHMENTS, MAX_CHAT_IMAGE_BYTES, type ChatImageAttachment, type ChatImageType } from "@/lib/chat-attachments";
import { prisma } from "@/lib/prisma";
import type { PromptImage } from "@/types";

type AttachmentWithAsset = MessageAttachment & { asset: MediaAsset };

export const messageAttachmentsSelect = {
  orderBy: { position: "asc" as const },
  include: { asset: true }
};

export function serializeChatAttachment(attachment: AttachmentWithAsset): ChatImageAttachment {
  return {
    id: attachment.id,
    assetId: attachment.asset.id,
    url: `/api/media/${attachment.asset.id}`,
    contentType: attachment.asset.contentType as ChatImageType,
    width: attachment.asset.width,
    height: attachment.asset.height,
    name: attachment.asset.originalName
  };
}

export function serializeAsset(asset: MediaAsset): ChatImageAttachment {
  return {
    id: asset.id,
    assetId: asset.id,
    url: `/api/media/${asset.id}`,
    contentType: asset.contentType as ChatImageType,
    width: asset.width,
    height: asset.height,
    name: asset.originalName
  };
}

export async function resolveOwnedChatAssets(input: { assetIds: string[]; chatId: string; userId: string }) {
  const assetIds = [...new Set(input.assetIds)];
  if (assetIds.length > MAX_CHAT_IMAGE_ATTACHMENTS) {
    throw new HttpError(400, `Attach up to ${MAX_CHAT_IMAGE_ATTACHMENTS} images per message.`);
  }
  if (!assetIds.length) return [];

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: assetIds }, userId: input.userId }
  });
  if (assets.length !== assetIds.length) {
    throw new HttpError(400, "One or more image attachments are unavailable.");
  }

  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return assetIds.map((assetId) => byId.get(assetId)!);
}

export async function loadPromptImages(assets: MediaAsset[]): Promise<PromptImage[]> {
  return Promise.all(assets.map(async (asset) => {
    if (!CHAT_IMAGE_TYPES.includes(asset.contentType as ChatImageType) || asset.size > MAX_CHAT_IMAGE_BYTES) {
      throw new HttpError(400, "Unsupported image attachment.");
    }

    const blob = await get(asset.pathname, { access: CHAT_IMAGE_BLOB_ACCESS });
    if (!blob || blob.statusCode !== 200 || blob.blob.size > MAX_CHAT_IMAGE_BYTES) {
      throw new HttpError(400, "An attached image could not be loaded.");
    }

    const bytes = await new Response(blob.stream).arrayBuffer();
    return {
      data: Buffer.from(bytes).toString("base64"),
      mediaType: asset.contentType as ChatImageType
    };
  }));
}
