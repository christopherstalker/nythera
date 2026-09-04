import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildCharacterCreatePayload, validateCharacterCreatePayload } from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";
import { characterCreateSchemaFor } from "../src/lib/validation";

const root = process.cwd();

function longCharacterPayload() {
  const longText = "x".repeat(20_000);

  return {
    creationMode: "custom" as const,
    name: longText,
    avatarUrl: "",
    description: longText,
    personality: longText,
    scenario: longText,
    greeting: longText,
    communicationStyle: { tone: longText },
    persona: {
      name: longText,
      role: longText,
      background: longText,
      personalityTraits: [longText]
    },
    lorebook: {
      entries: [{ id: longText, keywords: [longText], text: longText }]
    },
    visualIdentity: { chatBackground: longText },
    visibility: "PRIVATE" as const,
    tags: ["roleplay"],
    isNSFW: false,
    systemPromptOverride: longText,
    defaultChatMode: "realism" as const
  };
}

test("owner schema accepts long character fields while the default schema keeps its limits", () => {
  const payload = longCharacterPayload();

  assert.equal(characterCreateSchemaFor(false).safeParse(payload).success, false);
  assert.equal(characterCreateSchemaFor(true).safeParse(payload).success, true);
});

test("owner form payload preserves long nested character text", () => {
  const longText = "lore".repeat(1_500);
  const draft = {
    ...emptyCharacterDraft,
    name: "Unlimited character",
    description: "A sufficiently detailed character description.",
    personality: "A sufficiently detailed personality for this character.",
    greeting: "Hello there.",
    background: longText,
    speakingStyle: longText,
    lorebookText: `keyword => ${longText}`,
    systemPromptOverride: longText
  };

  const regularPayload = buildCharacterCreatePayload({ draft });
  const ownerPayload = buildCharacterCreatePayload({ draft, unlimitedCharacterFields: true });
  const regularPersona = regularPayload.persona as { background: string; speakingStyle: string };
  const ownerPersona = ownerPayload.persona as { background: string; speakingStyle: string };
  const ownerLorebook = ownerPayload.lorebook as { entries: Array<{ text: string }> };

  assert.equal(regularPersona.background.length, 5_000);
  assert.equal(regularPersona.speakingStyle.length, 500);
  assert.equal(ownerPersona.background, longText);
  assert.equal(ownerPersona.speakingStyle, longText);
  assert.equal(ownerLorebook.entries[0]?.text, longText);
  assert.equal(validateCharacterCreatePayload(regularPayload).success, true);
  assert.equal(validateCharacterCreatePayload(ownerPayload, true).success, true);
});

test("web and mobile character routes apply the owner-only schema and body-size bypass", () => {
  const files = [
    "src/app/api/characters/route.ts",
    "src/app/api/characters/[id]/route.ts",
    "src/app/api/mobile/characters/route.ts",
    "src/app/api/mobile/characters/[id]/route.ts"
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(source, /user\.unlimitedCharacterFields/);
    assert.match(source, /character(?:Create|Update)SchemaFor\(unlimitedCharacterFields\)/);
    assert.match(source, /maxBytes: unlimitedCharacterFields \? null : undefined/);
  }
});

test("character form receives the owner capability without exposing it as a user-controlled field", () => {
  const createPage = fs.readFileSync(path.join(root, "src/app/(main)/create-character/page.tsx"), "utf8");
  const form = fs.readFileSync(path.join(root, "src/components/characters/character-form.tsx"), "utf8");

  assert.match(createPage, /select: \{ unlimitedCharacterFields: true \}/);
  assert.match(form, /Owner access · character text fields have no length limit/);
  assert.match(form, /maxLength=\{unlimitedCharacterFields \? undefined : MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS\}/);
  assert.match(form, /validateCharacterCreatePayload\(payload, unlimitedCharacterFields\)/);
});

test("the account capability is opt-in and additive", () => {
  const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const migration = fs.readFileSync(
    path.join(root, "prisma/migrations/20260831164500_user_unlimited_character_fields/migration.sql"),
    "utf8"
  );

  assert.match(schema, /unlimitedCharacterFields\s+Boolean\s+@default\(false\)/);
  assert.match(migration, /ADD COLUMN "unlimitedCharacterFields" BOOLEAN NOT NULL DEFAULT false/);
});
