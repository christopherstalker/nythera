import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyRichTextFormat,
  parseInlineRichText,
  parseRichText,
  richTextToPlainText
} from "../src/lib/rich-text-formatting";

test("roleplay formatting parses nested styles without leaking punctuation", () => {
  const nodes = parseInlineRichText("**He answers *quietly* but ==firmly==.**");

  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]?.type, "format");
  assert.equal(nodes[0]?.type === "format" ? nodes[0].format : null, "bold");
  assert.deepEqual(
    nodes[0]?.type === "format"
      ? nodes[0].children.filter((node) => node.type === "format").map((node) => node.format)
      : [],
    ["italic", "highlight"]
  );
  assert.equal(richTextToPlainText("**He answers *quietly* but ==firmly==.**"), "He answers quietly but firmly.");
});

test("subtext, quotes, and escaped punctuation have predictable plain text", () => {
  assert.equal(richTextToPlainText("(almost inaudible)"), "almost inaudible");
  assert.equal(richTextToPlainText("\\(literal brackets\\) and \\*stars\\*"), "(literal brackets) and *stars*");
  assert.deepEqual(parseRichText("> The archive remembers.").map((block) => block.type), ["quote"]);
  assert.equal(richTextToPlainText("> The archive remembers."), "The archive remembers.");
});

test("unmatched formatting punctuation remains visible", () => {
  assert.equal(richTextToPlainText("An *unfinished action"), "An *unfinished action");
  assert.equal(richTextToPlainText("A normal ) bracket"), "A normal ) bracket");
});

test("a greeting wrapped in stars keeps italic formatting across line breaks", () => {
  const greeting = "*The door opens.\nShe studies you in silence.*";
  const blocks = parseRichText(greeting);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.children[0]?.type, "format");
  assert.equal(blocks[0]?.children[0]?.type === "format" ? blocks[0].children[0].format : null, "italic");
  assert.equal(richTextToPlainText(greeting), "The door opens.\nShe studies you in silence.");
});

test("selection formatting can combine and toggle styles", () => {
  const italic = applyRichTextFormat("quiet", 0, 5, "italic");
  assert.deepEqual(italic, { value: "*quiet*", selectionStart: 1, selectionEnd: 6 });

  const combined = applyRichTextFormat(italic.value, italic.selectionStart, italic.selectionEnd, "bold");
  assert.equal(combined.value, "***quiet***");
  assert.equal(richTextToPlainText(combined.value), "quiet");

  const unwrapped = applyRichTextFormat(italic.value, italic.selectionStart, italic.selectionEnd, "italic");
  assert.deepEqual(unwrapped, { value: "quiet", selectionStart: 0, selectionEnd: 5 });
});

test("formatting controls and character surfaces share the renderer", async () => {
  const files = await Promise.all([
    readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/MessageBubble.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/characters/character-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/characters/CharacterCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/guide/roleplay-formatting/page.tsx", import.meta.url), "utf8")
  ]);

  assert.match(files[0], /RichTextToolbar/);
  assert.match(files[1], /RichTextToolbar/);
  assert.match(files[2], /FormattedTextarea/);
  assert.match(files[3], /RichMessageText/);
  assert.match(files[4], /RICH_TEXT_FORMATS/);
});
