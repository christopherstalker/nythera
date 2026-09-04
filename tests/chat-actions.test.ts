import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSkipTimePrompt, resolveChatActionMessage, SKIP_TIME_COMMAND } from "../src/lib/chat-actions";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("skip time is stored as a compact action while the model receives continuity instructions", () => {
  const action = resolveChatActionMessage(SKIP_TIME_COMMAND.toUpperCase());

  assert.equal(action.kind, "skip-time");
  assert.equal(action.persistedContent, SKIP_TIME_COMMAND);
  assert.match(action.promptContent, /next meaningful point in time/i);
  assert.match(action.promptContent, /Preserve established relationships, promises, injuries/i);
  assert.match(action.promptContent, /do not ask how much time should pass/i);
});

test("skip time accepts an exact duration from one minute to a custom interval", () => {
  assert.match(buildSkipTimePrompt({ value: 1, unit: "minute" }), /exactly 1 minute\./);
  assert.match(buildSkipTimePrompt({ value: 250, unit: "year" }), /exactly 250 years\./);
  assert.match(buildSkipTimePrompt({ value: 6, unit: "hour" }), /do not substitute a different duration/i);
});

test("skip time is an assistant-only message action", async () => {
  const [input, toolbox, messageActions, client, hook, webRoute, mobileRoute] = await Promise.all([
    read("../src/components/chat/ChatInput.tsx"),
    read("../src/components/chat/ChatToolsMenu.tsx"),
    read("../src/components/chat/MessageContextMenu.tsx"),
    read("../src/components/chat/chat-client.tsx"),
    read("../src/hooks/useChat.ts"),
    read("../src/app/api/chats/[id]/stream/route.ts"),
    read("../src/app/api/mobile/chats/[id]/message/route.ts")
  ]);

  assert.doesNotMatch(toolbox, />Skip time</);
  assert.doesNotMatch(input, /SKIP_TIME_COMMAND|onSkipTime/);
  assert.match(messageActions, />\s*Skip time\s*</);
  assert.match(messageActions, /How much time should pass\?/);
  assert.match(messageActions, /Choose from one minute to any custom interval/);
  assert.match(client, /skipTime: true, skipTimeDuration: duration, continueMessageId: assistantMessageId/);
  assert.match(hook, /const isAssistantAction = isContinuation \|\| isTimeSkip/);
  assert.match(hook, /skipTimeValue: options\?\.skipTimeDuration\?\.value/);
  assert.match(hook, /if \(isRegeneration \|\| isAssistantAction\)/);
  assert.match(webRoute, /if \(!input\.regenerate && !input\.retryUserMessageId && !assistantOnlyAction\)/);
  assert.match(webRoute, /branchSourceMessageId: assistantOnlyAction \? input\.continueMessageId : undefined/);
  assert.match(webRoute, /regenerationTurn\.trigger === "skip-time"/);
  assert.match(webRoute, /skipTimeClientRequestId/);
  assert.match(mobileRoute, /skipTimeClientRequestId/);
  assert.match(mobileRoute, /const userMessage = assistantOnlyAction/);
});

test("an empty composer collapses to one line and expands on focus", async () => {
  const input = await read("../src/components/chat/ChatInput.tsx");

  assert.match(input, /showExpandedComposer/);
  assert.match(input, /data-expanded=\{showExpandedComposer\}/);
  assert.match(input, /showExpandedComposer \? \([\s\S]*?\{value\.length\.toLocaleString\(\)\}/);
  assert.match(input, /onFocus=\{\(\) => setComposerExpanded\(true\)\}/);
  assert.match(input, /textarea\.style\.height = "32px"/);
  assert.match(input, /setComposerExpanded\(false\)/);
});

test("branch action stays in message actions and preserves the selected regeneration", async () => {
  const [bubble, messageActions, branchRoute, vector] = await Promise.all([
    read("../src/components/chat/MessageBubble.tsx"),
    read("../src/components/chat/MessageContextMenu.tsx"),
    read("../src/app/api/chats/[id]/branch/route.ts"),
    read("../src/lib/vector.ts")
  ]);

  assert.doesNotMatch(bubble, /Start branch/);
  assert.match(messageActions, />\s*Branch\s*</);
  assert.match(branchRoute, /conversationBranchThroughMessage/);
  assert.match(branchRoute, /data: \{ activeAssistantMessageId \}/);
  assert.match(vector, /"sourceChatId" = \$\{input\.sourceChatId \?\? null\}/);
});
