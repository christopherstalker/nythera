import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  containsRussianLanguage,
  isRussianLanguageLabel,
  RUSSIAN_CHARACTER_PUBLICATION_ERROR,
  RUSSIAN_LANGUAGE_ERROR
} from "../src/lib/language-policy";

test("Russian messages are detected, including short conversational text", () => {
  const russianSamples = [
    "Привет, как дела?",
    "Я тебя люблю.",
    "Это персонаж, который всегда говорит спокойно и хорошо знает свою работу.",
    "Она подошла к окну. Сейчас здесь очень тихо, но она хочет что-то сказать.",
    "Я говорю по-русски."
  ];

  for (const sample of russianSamples) {
    assert.equal(containsRussianLanguage(sample), true, sample);
  }
});

test("Ukrainian and other supported languages are not treated as Russian", () => {
  const supportedSamples = [
    "Привіт, як справи?",
    "Це персонаж, який завжди говорить спокійно й добре знає свою роботу.",
    "Вона підійшла до вікна. Зараз тут дуже тихо, але вона хоче щось сказати.",
    "Здравей, как си?",
    "Здраво, како си?",
    "Прывітанне, як справы?",
    "Hello, how are you?",
    "你好，今天怎么样？"
  ];

  for (const sample of supportedSamples) {
    assert.equal(containsRussianLanguage(sample), false, sample);
  }
});

test("Russian translation labels are rejected while Chinese is supported", () => {
  for (const label of ["Russian", "русский", "Русский язык", "ru", "ru_RU"]) {
    assert.equal(isRussianLanguageLabel(label), true, label);
  }
  assert.equal(isRussianLanguageLabel("Chinese"), false);
  assert.equal(isRussianLanguageLabel("Ukrainian"), false);
});

test("server routes enforce the shared language policy", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/app/api/chats/[id]/stream/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/mobile/chats/[id]/message/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/rooms.ts", import.meta.url), "utf8")
  ]);

  for (const source of sources) {
    assert.match(source, /containsRussianLanguage/);
    assert.match(source, /RUSSIAN_LANGUAGE_ERROR/);
  }
});

test("character publication and composer expose explicit rejection messages", async () => {
  const [mutations, composer] = await Promise.all([
    readFile(new URL("../src/lib/character-mutations.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/chat/ChatInput.tsx", import.meta.url), "utf8")
  ]);

  assert.match(mutations, /visibility === "PRIVATE"/);
  assert.match(mutations, /containsRussianLanguage/);
  assert.match(mutations, /RUSSIAN_CHARACTER_PUBLICATION_ERROR/);
  assert.match(composer, /RUSSIAN_LANGUAGE_ERROR/);
  assert.match(RUSSIAN_CHARACTER_PUBLICATION_ERROR, /cannot be published/i);
  assert.match(RUSSIAN_LANGUAGE_ERROR, /not supported/i);
  assert.doesNotMatch(composer, /option value="Russian"/);
  assert.match(composer, /option value="Chinese">Chinese/);
});
