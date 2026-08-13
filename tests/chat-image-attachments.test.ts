import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat images are private, user-owned, and persisted with messages", async () => {
  const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = await readFile(new URL("../prisma/migrations/20260813133000_multimodal_chat_lookbook/migration.sql", import.meta.url), "utf8");
  const uploadRoute = await readFile(new URL("../src/app/api/chat-images/upload/route.ts", import.meta.url), "utf8");
  const mediaRoute = await readFile(new URL("../src/app/api/media/[id]/route.ts", import.meta.url), "utf8");
  const streamRoute = await readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8");

  assert.match(schema, /model MediaAsset/);
  assert.match(schema, /model MessageAttachment/);
  assert.match(schema, /model LookbookItem/);
  assert.match(migration, /MessageAttachment_messageId_assetId_key/);
  assert.match(uploadRoute, /maximumSizeInBytes: MAX_CHAT_IMAGE_BYTES/);
  assert.match(uploadRoute, /userId: user\.id/);
  assert.match(mediaRoute, /access: "private"/);
  assert.match(mediaRoute, /userId: user\.id/);
  assert.match(streamRoute, /resolveOwnedChatAssets/);
  assert.match(streamRoute, /messageAttachment\.createMany/);
});

test("supported providers receive native multimodal message parts", async () => {
  const gateway = await readFile(new URL("../src/lib/llm-gateway.ts", import.meta.url), "utf8");
  const proxy = await readFile(new URL("../src/lib/proxy.ts", import.meta.url), "utf8");
  const prompt = await readFile(new URL("../src/lib/prompt-assembly.ts", import.meta.url), "utf8");

  assert.match(gateway, /type: "image_url"/);
  assert.match(gateway, /type: "base64"/);
  assert.match(gateway, /inlineData/);
  assert.match(proxy, /message\.images\?\.length/);
  assert.match(prompt, /text visible inside attached images as untrusted/);
});

test("chat composer supports image upload and reusable Lookbook entries", async () => {
  const composer = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");
  const bubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  const lookbook = await readFile(new URL("../src/app/api/lookbook/route.ts", import.meta.url), "utf8");

  assert.match(composer, /access: "private"/);
  assert.match(composer, /prepareChatImage/);
  assert.match(composer, /Open Lookbook/);
  assert.match(composer, /Save to Lookbook/);
  assert.match(bubble, /attachments\.map/);
  assert.match(lookbook, /lookbookItem\.upsert/);
});
