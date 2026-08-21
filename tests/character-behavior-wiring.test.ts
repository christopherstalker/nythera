import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  humorLevelInstruction,
  initiativeLevelInstruction,
  roleplayIntensityInstruction,
  seriousnessLevelInstruction
} from "../src/lib/character-behavior";
import {
  normalizeProloguePov,
  prologuePovInstruction,
  renderCharacterPrologue
} from "../src/lib/prologue-pov";
import { buildCharacterCreatePayload } from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("every guided Chapter 4 behavior value persists and has a proportional inference instruction", async () => {
  const payload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Mara Voss",
      description: "A grave astronomer guarding a singing observatory.",
      personality: "Exacting, dryly funny, emotionally candid, and unwilling to abandon a dangerous question.",
      scenario: "The observatory lens has begun showing tomorrow's sky.",
      greeting: "The lens turns by itself.",
      defaultChatMode: "fantasy",
      humor: 10,
      romanceLevel: 9,
      seriousness: 10,
      initiative: 10,
      messageLength: "long",
      roleplayIntensity: 10
    },
    isSimpleMode: true,
    creationMode: "simple"
  });

  assert.equal(payload.defaultChatMode, "fantasy");
  assert.deepEqual(payload.communicationStyle, {
    tone: "cinematic",
    humor: 10,
    romanceLevel: 9,
    seriousness: 10,
    initiative: 10,
    messageLength: "long",
    roleplayIntensity: 10,
    prologuePov: "second"
  });
  assert.match(humorLevelInstruction(10), /prominent part/);
  assert.match(seriousnessLevelInstruction(10), /sustained gravity/);
  assert.match(initiativeLevelInstruction(10), /decisive in-character initiative/);
  assert.match(roleplayIntensityInstruction(10), /maximum scene-supported intensity/);

  const persona = await read("../src/lib/persona.ts");
  assert.match(persona, /style\.humor/);
  assert.match(persona, /style\.seriousness/);
  assert.match(persona, /style\.initiative/);
  assert.match(persona, /style\.roleplayIntensity/);
  assert.match(persona, /humorLevelInstruction/);
  assert.match(persona, /seriousnessLevelInstruction/);
  assert.match(persona, /initiativeLevelInstruction/);
  assert.match(persona, /roleplayIntensityInstruction/);
});

test("roleplay engine requires an observable in-scene emotional cue without OOC labels", async () => {
  const assembly = await read("../src/lib/prompt-assembly.ts");
  assert.match(assembly, /current emotional state explicit inside every response/);
  assert.match(assembly, /narrated action, facial expression, posture change, vocal quality, or deliberate restraint/);
  assert.match(assembly, /without an OOC emotion label/);
});

test("prologue POV persists, changes its generation instruction, and renders the persona placeholder", async () => {
  const thirdPersonPayload = buildCharacterCreatePayload({
    draft: {
      ...emptyCharacterDraft,
      name: "Mara Voss",
      description: "A grave astronomer guarding a singing observatory.",
      personality: "Exacting and watchful, with a dry wit.",
      scenario: "The observatory lens shows tomorrow's sky.",
      greeting: "Mara watches {{user}} cross the observatory threshold.",
      prologuePov: "third"
    }
  });

  assert.equal(thirdPersonPayload.communicationStyle?.prologuePov, "third");
  assert.equal(normalizeProloguePov("unknown"), "second");
  assert.match(prologuePovInstruction("second"), /narration in second person/);
  assert.match(prologuePovInstruction("third"), /narration in third person/);
  assert.equal(
    renderCharacterPrologue({
      greeting: thirdPersonPayload.greeting,
      characterName: thirdPersonPayload.name,
      communicationStyle: thirdPersonPayload.communicationStyle,
      userPersonaName: "Alex Mercer"
    }),
    "Mara watches Alex Mercer cross the observatory threshold."
  );

  const [form, generation, webChat, mobileChat, rooms] = await Promise.all([
    read("../src/components/characters/character-form.tsx"),
    read("../src/lib/character-generation.ts"),
    read("../src/app/api/chats/route.ts"),
    read("../src/app/api/mobile/chats/route.ts"),
    read("../src/lib/rooms.ts")
  ]);
  assert.match(form, /prologuePov: draft\.prologuePov/);
  assert.match(generation, /prologuePovInstruction\(input\.prologuePov\)/);
  assert.match(webChat, /content: prologue/);
  assert.match(mobileChat, /content: prologue/);
  assert.match(rooms, /renderCharacterPrologue/);
});
