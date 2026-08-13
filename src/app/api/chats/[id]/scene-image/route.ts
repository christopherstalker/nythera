import OpenAI from "openai";
import { put } from "@vercel/blob";
import { z } from "zod";
import { HttpError, getRequestIp, json, parseJson, requireUser, routeError } from "@/lib/api";
import { serializeAsset } from "@/lib/chat-media";
import { prisma } from "@/lib/prisma";
import { getEffectiveProviderKeys } from "@/lib/user-keys";
import { enforceRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({ direction: z.string().trim().max(500).optional().default("") });

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    await enforceRateLimit({ userId: user.id, ip: getRequestIp(request), route: "chat:scene-image" });
    const { id } = await context.params;
    const input = await parseJson(request, requestSchema);
    const chat = await prisma.chat.findFirst({ where: { id, userId: user.id }, select: { id: true, character: { select: { name: true, description: true, visualIdentity: true } }, messages: { orderBy: { createdAt: "desc" }, take: 8, select: { role: true, content: true } } } });
    if (!chat) throw new HttpError(404, "Chat not found.");
    const key = (await getEffectiveProviderKeys(user.id)).find((candidate) => candidate.provider === "openai");
    if (!key) throw new HttpError(400, "Add an OpenAI key to generate scene illustrations.");
    const scene = chat.messages.reverse().map((message) => `${message.role}: ${message.content.slice(0, 700)}`).join("\n");
    const prompt = [`Cinematic story illustration. Character: ${chat.character.name}.`, chat.character.visualIdentity || chat.character.description, scene, input.direction, "Preserve established appearance and environment. No text, captions, UI, or watermark."].filter(Boolean).join("\n\n").slice(0, 7000);
    const generated = await new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl || undefined }).images.generate({ model: "dall-e-3", prompt, size: "1024x1024", quality: "standard", response_format: "b64_json" });
    const encoded = generated.data?.[0]?.b64_json;
    if (!encoded) throw new HttpError(502, "The image provider returned no illustration.");
    const bytes = Buffer.from(encoded, "base64");
    const pathname = `chat-images/${chat.id}/scene-${Date.now()}.png`;
    await put(pathname, bytes, { access: "private", contentType: "image/png", addRandomSuffix: false });
    const asset = await prisma.mediaAsset.create({ data: { userId: user.id, chatId: chat.id, pathname, contentType: "image/png", size: bytes.byteLength, width: 1024, height: 1024, originalName: "scene-illustration.png" } });
    return json({ attachment: serializeAsset(asset) }, { status: 201 });
  } catch (error) { return routeError(error); }
}
