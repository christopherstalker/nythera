import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("chat context is a floating grain glass layer with a vertical tool rail", async () => {
  const panel = await read("../src/components/chat/chat-quick-panel.tsx");

  assert.match(panel, /Story context/);
  assert.match(panel, /glass-grain/);
  assert.match(panel, /backdrop-blur-\[28px\]/);
  assert.match(panel, /<nav aria-label="Story context"/);
  assert.match(panel, /w-\[74px\][\s\S]*border-r/);
});

test("chat separates editorial character dialogue from compact user responses", async () => {
  const bubble = await read("../src/components/chat/MessageBubble.tsx");
  const styles = await read("../src/app/globals.css");
  const composer = await read("../src/components/chat/ChatInput.tsx");

  assert.match(bubble, /!isUser \? <p[\s\S]*\{characterName\}/);
  assert.match(styles, /\.bubble-char[\s\S]*border-left:[\s\S]*background: linear-gradient\(90deg/);
  assert.doesNotMatch(styles.match(/\.bubble-char[\s\S]*?\n  \}/)?.[0] ?? "", /255 122 24|backdrop-filter/);
  assert.match(composer, /composer-dock/);
  assert.match(composer, /bg-\[var\(--gradient-aurora-primary\)\]/);
  assert.match(composer, /Message character\.\.\./);
});

test("chat library uses a featured scene plus an earlier-conversation stream", async () => {
  const chats = await read("../src/app/(main)/chats/page.tsx");

  assert.match(chats, /Continue your latest scene/);
  assert.match(chats, /Earlier conversations/);
  assert.match(chats, /chats\[0\]/);
  assert.match(chats, /chats\.slice\(1\)/);
  assert.doesNotMatch(chats, /glass-card glass-card-hover/);
});
