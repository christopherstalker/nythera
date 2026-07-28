import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat messages are virtualized and bubble renders are memoized", async () => {
  const messageList = await readFile(new URL("../src/components/chat/MessageList.tsx", import.meta.url), "utf8");
  const messageBubble = await readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8");
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(packageJson, /"@tanstack\/react-virtual"/);
  assert.match(messageList, /useVirtualizer/);
  assert.match(messageList, /overscan:\s*8/);
  assert.match(messageList, /measureElement/);
  assert.match(messageBubble, /memo\(MessageBubbleComponent/);
  assert.match(messageBubble, /areMessageBubblePropsEqual/);
});

test("heavy character editor is dynamically loaded", async () => {
  const loader = await readFile(new URL("../src/components/characters/character-form-loader.tsx", import.meta.url), "utf8");
  const createPage = await readFile(new URL("../src/app/(main)/create-character/page.tsx", import.meta.url), "utf8");
  const editPage = await readFile(new URL("../src/app/(main)/character/[id]/edit/page.tsx", import.meta.url), "utf8");

  assert.match(loader, /dynamic\(/);
  assert.match(loader, /character-form/);
  assert.match(createPage, /CharacterFormLoader/);
  assert.doesNotMatch(createPage, /components\/characters\/character-form"/);
  assert.match(editPage, /CharacterFormLoader/);
  assert.doesNotMatch(editPage, /components\/characters\/character-form"/);
});

test("persistent avatar surfaces use Next image when the source can be optimized", async () => {
  const avatar = await readFile(new URL("../src/components/ui/avatar.tsx", import.meta.url), "utf8");
  const chatClient = await readFile(new URL("../src/components/chat/chat-client.tsx", import.meta.url), "utf8");
  const chatsPage = await readFile(new URL("../src/app/(main)/chats/page.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../src/components/home/home-page-client.tsx", import.meta.url), "utf8");

  for (const source of [avatar, chatClient, chatsPage, home]) {
    assert.match(source, /next\/image/);
    assert.match(source, /shouldBypassNextImageOptimization/);
    assert.match(source, /sizes=/);
  }
});
