import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("chat appearance persists per conversation and supports image, GIF, and video backgrounds", async () => {
  const [schema, migration, validation, panel, client, uploadRoute] = await Promise.all([
    read("../prisma/schema.prisma"),
    read("../prisma/migrations/20260806120000_chat_appearance/migration.sql"),
    read("../src/lib/validation.ts"),
    read("../src/components/chat/ChatAppearancePanel.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/app/api/chat-backgrounds/upload/route.ts")
  ]);

  assert.match(schema, /appearance\s+Json\?/);
  assert.match(migration, /ADD COLUMN "appearance" JSONB/);
  assert.match(validation, /chatAppearanceSchema/);
  assert.match(panel, /image\/gif/);
  assert.match(panel, /video\/mp4/);
  assert.match(panel, /multipart: file\.size > 5 \* 1024 \* 1024/);
  assert.match(panel, /fontFamily/);
  assert.match(panel, /textColor/);
  assert.match(client, /appearance\.backgroundMode === "default"/);
  assert.match(client, /<video[\s\S]*autoPlay loop muted playsInline/);
  assert.match(client, /--chat-font-family/);
  assert.match(uploadRoute, /userId: user\.id/);
  assert.match(uploadRoute, /pathname\.startsWith\(`chat-backgrounds\/\$\{chatId\}\//);
  assert.match(uploadRoute, /maximumSizeInBytes: MAX_BACKGROUND_BYTES/);
});

test("right-panel history is scoped and sorted by the active character", async () => {
  const [tabs, panel, preview] = await Promise.all([
    read("../src/components/chat/chat-panel-tabs.tsx"),
    read("../src/components/panel/SidePanel.tsx"),
    read("../src/hooks/use-chat-quick-panel.ts")
  ]);

  assert.match(tabs, /chat\.character\.id === characterId/);
  assert.match(tabs, /lastActiveAt/);
  assert.match(tabs, /Only chats with/);
  assert.match(panel, /characterId=\{activeCharacterId\}/);
  assert.match(panel, /async function startNewChat/);
  assert.match(preview, /character:\s*\{[\s\S]*?id: string/);
  assert.match(preview, /\/api\/chats\?characterId=/);
  assert.doesNotMatch(preview, /body\.chats\) \? body\.chats\.slice\(0, 8\)/);
  assert.match(panel, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(panel, /data-testid="story-context-scroll"/);
  assert.match(panel, /side-panel-scroll min-h-0 min-w-0 touch-pan-y overflow-y-auto/);
  assert.doesNotMatch(panel, /side-panel-scroll absolute inset-0/);
});

test("message editing uses a full-height editor and secondary actions stay in More", async () => {
  const [bubble, menu] = await Promise.all([
    read("../src/components/chat/MessageBubble.tsx"),
    read("../src/components/chat/MessageContextMenu.tsx")
  ]);

  assert.match(bubble, /Edit response/);
  assert.match(bubble, /h-\[min\(82dvh,760px\)\]/);
  assert.match(bubble, /Save/);
  assert.match(bubble, /Ctrl\/⌘ \+ Enter/);
  assert.match(bubble, /ActionButton label="More"/);
  assert.doesNotMatch(bubble, /window\.addEventListener\("click", handleClose\)/);
  assert.match(menu, /window\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /max-w-\[720px\]/);
  assert.match(menu, /grid min-h-0 grid-cols-4/);
  assert.match(menu, /bg-\[rgba\(12,12,14,0\.72\)\]/);
  assert.match(menu, /backdrop-blur-2xl/);
  assert.doesNotMatch(menu, /const useSheet|getMenuCoords/);
  assert.match(bubble, /const \[actionsOpen, setActionsOpen\]/);
  assert.doesNotMatch(bubble, /menuPosition/);
  assert.match(bubble, /Version \{variantIndex! \+ 1\} of \{variantCount\}/);
  assert.doesNotMatch(bubble, /ActionButton label="Delete"/);
});

test("chat chapter follows the conversation order for the active character", async () => {
  const [route, page, client, header] = await Promise.all([
    read("../src/app/api/chats/[id]/route.ts"),
    read("../src/app/(main)/chat/[id]/page.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/components/chat/ChatHeader.tsx")
  ]);

  assert.match(route, /const chapterNumber = await prisma\.chat\.count/);
  assert.match(route, /characterId: chat\.characterId/);
  assert.match(route, /createdAt: \{ lt: chat\.createdAt \}/);
  assert.match(route, /chat: \{ \.\.\.chat, chapterNumber \}/);
  assert.match(page, /chapterNumber=\{chat\.chapterNumber\}/);
  assert.match(client, /Chapter \{chapterNumber\}/);
  assert.match(header, /Chapter \{chapterNumber\}/);
  assert.doesNotMatch(`${client}\n${header}`, /Chapter 3/);
});
