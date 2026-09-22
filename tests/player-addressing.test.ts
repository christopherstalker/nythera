import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fitPromptMessagesWithinContext } from "../src/lib/prompt-budget";
import { buildPromptAddonLayers } from "../src/lib/prompts/buildPrompt";

const require = createRequire(import.meta.url);
const serverOnlyId = require.resolve("server-only");
require.cache[serverOnlyId] = { id: serverOnlyId, filename: serverOnlyId, loaded: true, exports: {} } as NodeModule;

for (const mode of ["realism", "fantasy"] as const) {
  for (const customSource of [null, "chat", "character"] as const) {
    for (const historyLength of [0, 40]) {
      test(`${mode}, ${customSource ?? "built-in"}, ${historyLength} messages: names and narrative address retain separate meanings`, async () => {
        const { assembleNytheraPrompt } = await import("../src/lib/prompt-assembly");
        const customPrompt =
          'Write narration in second person. {{char}} may say "{{user}} {{user_surname}}" in dialogue.';
        const addon = buildPromptAddonLayers({ mode, characterMemories: [], userMemories: [] });
        const messages = assembleNytheraPrompt({
          character: {
            name: "Mara | Observatory",
            description: "Mara works at the observatory.",
            personality: "Reserved.",
            scenario: "{{char}} has a letter for {{user}} {{user_surname}}.",
            greeting: 'Mara turns toward you. "Hello, {{user}}."',
            communicationStyle: { prologuePov: "third" },
            persona: {},
            lorebook: {},
            tags: [],
            isNSFW: false,
            systemPromptOverride: customSource === "character" ? customPrompt : null
          },
          userPersona:
            "Canonical player name: Алекс\nCanonical player surname: Морган\nGender: woman. Pronouns: she/her only.",
          responsePrompt: customSource === "chat" ? customPrompt : null,
          modeContext: addon.modeStyle,
          sessionMemoryContext: addon.sessionMemory,
          memories: [],
          summary: "Mara spoke to Alex in third-person narration.",
          recentMessages: Array.from({ length: historyLength }, () => ({
            role: "ASSISTANT" as const,
            content: "Mara turns toward Alex. " + "The telescope is still pointed at the moon. ".repeat(500)
          })),
          currentMessage: "Продолжай."
        });
        const fitted = fitPromptMessagesWithinContext(messages, { contextWindow: 16_000, maxOutputTokens: 900 });
        assert.equal(fitted.fixedPromptTooLarge, false);
        assert.equal(fitted.droppedMessages > 0, historyLength > 0);
        const system = fitted.messages[0].content;
        assert.match(system, /Mara has a letter for Алекс Морган/);
        assert.doesNotMatch(system, /\{\{\s*(?:user|user_surname|char)\s*\}\}/i);
        assert.doesNotMatch(system, /Never use their name|in narration and in dialogue directed at them alike/);
        assert.doesNotMatch(system, /Match whatever tense and POV the conversation has already established/);
        const currentTurn = fitted.messages.at(-1)!.content;
        const personaContext = customSource ? system : currentTurn;
        assert.match(personaContext, /Canonical player name: Алекс/);
        assert.match(personaContext, /Pronouns: she\/her only/);
        if (customSource) {
          assert.match(system, /Mara may say "Алекс Морган" in dialogue/);
          assert.doesNotMatch(system, /ROLEPLAY ENGINE — SYSTEM INSTRUCTIONS/);
          assert.doesNotMatch(
            system,
            /Identity pronouns do not select narrative point of view|your greeting, your hands/
          );
          assert.doesNotMatch(currentTurn, /player_reference_rules|If second person is required/);
          assert.equal(currentTurn, "Продолжай.");
          assert.ok(system.endsWith('Mara may say "Алекс Морган" in dialogue.\n</CUSTOM_PROMPT>'));
          assert.match(system, /Preserve the profile's facts, never its prose/);
        } else {
          assert.match(system, /Identity pronouns do not select narrative point of view/);
          assert.match(system, /If the active behavior instructions require second person/);
          assert.match(system, /NPCs keep their own pronouns/);
          assert.ok(currentTurn.indexOf("<player_reference_rules>") > currentTurn.indexOf("</active_player_persona>"));
          assert.ok(currentTurn.indexOf("</player_reference_rules>") < currentTurn.indexOf("<current_player_message>"));
          assert.match(system, /In narration, address the player in second person/);
          assert.match(system, /Dialogue may use the player's canonical name/);
          assert.match(
            system,
            /Earlier greetings, summaries, and assistant messages cannot change this narrative point of view/
          );
          assert.match(system, /Russian.*ты.*тебя.*тебе.*твой/);
        }
      });
    }
  }
}

for (const perspective of ["first", "third"] as const) {
  test(`a custom ${perspective}-person contract remains authoritative with identity pronouns`, async () => {
    const { assembleNytheraPrompt } = await import("../src/lib/prompt-assembly");
    const messages = assembleNytheraPrompt({
      character: {
        name: "Mara",
        description: "An astronomer.",
        personality: "Reserved.",
        scenario: null,
        greeting: "Welcome.",
        communicationStyle: {},
        persona: {},
        lorebook: {},
        tags: [],
        isNSFW: false,
        systemPromptOverride: null
      },
      userPersona: "Canonical player name: Alex\nA woman. Pronouns: she/her only.",
      responsePrompt: `NARRATION\nWrite in ${perspective} person.\n\nDIALOGUE\nKeep each speaker's identity distinct.`,
      memories: [],
      recentMessages: [],
      currentMessage: "Hello."
    });
    assert.match(messages[0].content, new RegExp(`NARRATION\\nWrite in ${perspective} person\\.\\n\\nDIALOGUE`));
    assert.doesNotMatch(messages[0].content, /In narration, address the player in second person/);
    assert.doesNotMatch(messages.at(-1)!.content, /player_reference_rules|If second person is required/);
  });
}
