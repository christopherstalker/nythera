import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat images are proxied, user-owned, and persisted with messages", async () => {
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
  assert.match(mediaRoute, /CHAT_IMAGE_BLOB_ACCESS/);
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
  const [input, tools, imageRoute] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/ChatToolsMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/chat-images/route.ts", import.meta.url), "utf8")
  ]);
  const composer = `${input}\n${tools}`;
  const bubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  const lookbook = await readFile(new URL("../src/app/api/lookbook/route.ts", import.meta.url), "utf8");

  assert.match(imageRoute, /access: CHAT_IMAGE_BLOB_ACCESS/);
  assert.match(imageRoute, /request\.formData\(\)/);
  assert.match(composer, /new FormData\(\)/);
  assert.match(composer, /accept="image\/\*"/);
  assert.match(composer, /prepareChatImage/);
  assert.match(composer, /Lookbook/);
  assert.match(composer, /Save to Lookbook/);
  assert.match(bubble, /attachments\.map/);
  assert.match(lookbook, /lookbookItem\.upsert/);
});

test("chat image preparation cannot hang indefinitely in a mobile webview", async () => {
  const imageClient = await readFile(new URL("../src/lib/chat-image-client.ts", import.meta.url), "utf8");

  assert.match(imageClient, /image\.onload/);
  assert.match(imageClient, /image\.onerror/);
  assert.match(imageClient, /IMAGE_LOAD_TIMEOUT_MS/);
  assert.match(imageClient, /CANVAS_ENCODE_TIMEOUT_MS/);
  assert.match(imageClient, /CHAT_IMAGE_TYPES\.includes/);
  assert.doesNotMatch(imageClient, /await image\.decode\(\)/);
});

test("Lookbook uses an opaque surface above the chat composer", async () => {
  const input = await readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8");

  assert.match(input, /z-\[60\][^\"]*bg-\[#090909\]/);
  assert.doesNotMatch(input, /bg-\[#090909\]\/98/);
});

test("mobile chat tools collapse into one accessible folder menu", async () => {
  const [input, tools] = await Promise.all([
    readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/ChatToolsMenu.tsx", import.meta.url), "utf8")
  ]);

  assert.match(input, /<ChatToolsMenu/);
  assert.match(tools, /aria-haspopup="menu"/);
  assert.match(tools, /aria-label="Chat tools"/);
  for (const label of ["Photos", "Lookbook", "Illustrate", "Context file", "Voice note", "Model & style"]) {
    assert.match(tools, new RegExp(label.replace(/[&]/g, "\\&")));
  }
});
