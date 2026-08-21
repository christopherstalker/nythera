import { put } from "@vercel/blob";
import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { CHAT_IMAGE_BLOB_ACCESS } from "@/lib/chat-attachments";
import { serializeAsset } from "@/lib/chat-media";
import { prisma } from "@/lib/prisma";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { enforceRateLimit } from "@/lib/rate-limit";
import { generateSceneImageWithFallback } from "@/lib/scene-image-generation";
import { logSafeError } from "@/lib/secret-redaction";

const requestSchema = z.object({ direction: z.string().trim().max(500).optional().default("") });

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "chat:scene-image" });
    const { id } = await context.params;
    const input = await parseJson(request, requestSchema);
    const chat = await prisma.chat.findFirst({ where: { id, userId: user.id }, select: { id: true, model: true, character: { select: { name: true, description: true, visualIdentity: true } }, messages: { orderBy: { createdAt: "desc" }, take: 8, select: { role: true, content: true } } } });
    if (!chat) throw new HttpError(404, "Chat not found.");
    const scene = chat.messages.reverse().map((message) => `${message.role}: ${message.content.slice(0, 700)}`).join("\n");
    const prompt = [`Cinematic story illustration. Character: ${chat.character.name}.`, chat.character.visualIdentity || chat.character.description, scene, input.direction, "Preserve established appearance and environment. No text, captions, UI, or watermark."].filter(Boolean).join("\n\n").slice(0, 7000);
    const generated = await generateSceneImageWithFallback({
      keys: await getEffectiveProviderKeys(user.id),
      preferredModel: chat.model,
      prompt
    });
    const extension = generated.contentType === "image/jpeg" ? "jpg" : "png";
    const pathname = `chat-images/${chat.id}/scene-${Date.now()}.${extension}`;
    try {
      const storedImage = await put(pathname, generated.bytes, { access: CHAT_IMAGE_BLOB_ACCESS, contentType: generated.contentType, addRandomSuffix: true });
      const asset = await prisma.mediaAsset.create({ data: { userId: user.id, chatId: chat.id, pathname: storedImage.pathname, contentType: generated.contentType, size: generated.bytes.byteLength, width: 1024, height: 1024, originalName: `scene-illustration.${extension}` } });
      return json({ attachment: serializeAsset(asset), provider: generated.provider, model: generated.model }, { status: 201 });
    } catch (error) {
      logSafeError("Generated scene illustration could not be persisted.", error);
      throw new HttpError(502, "The illustration was generated but could not be saved. Check platform storage and try again.");
    }
  } catch (error) { return routeError(error); }
}
