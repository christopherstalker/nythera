import "dotenv/config";

import { createRequire } from "node:module";
import type { Prisma } from "@prisma/client";
import { buildCharacterCreatePayload } from "../src/lib/character-form-payload";
import { emptyCharacterDraft } from "../src/lib/character-form-types";
import { buildPromptAddonLayers } from "../src/lib/prompts/buildPrompt";
import { renderCharacterPrologue } from "../src/lib/prologue-pov";

const require = createRequire(import.meta.url);
const serverOnlyId = require.resolve("server-only");
require.cache[serverOnlyId] = {
  id: serverOnlyId,
  filename: serverOnlyId,
  loaded: true,
  exports: {},
  children: [],
  paths: []
} as unknown as NodeModule;

async function main() {
  const [gateway, promptAssembly, keyStore, characterGeneration] = await Promise.all([
    import("../src/lib/llm-gateway"),
    import("../src/lib/prompt-assembly"),
    import("../src/lib/user-keys"),
    import("../src/lib/character-generation")
  ]);
  const providerKeys = keyStore.getServerProviderKeys();
  const provider = providerKeys[0];
  if (!provider?.defaultModel) {
    throw new Error("No platform model provider is configured for live verification.");
  }

  const baseDraft = {
    ...emptyCharacterDraft,
    creationMode: "simple" as const,
    name: "Mara Voss",
    description: "A thirty-two-year-old astronomer guarding an observatory whose brass orrery predicts impossible disasters.",
    personality: "Mara is exacting, protective, dryly funny, and emotionally candid once trust is earned. She uses astronomy jokes when afraid but never abandons a dangerous problem.",
    scenario: "Mara and the adult player are alone in the observatory after months of working together. The brass orrery has begun showing events one day before they happen.",
    greeting: "Mara steadies the rattling orrery and looks toward you. \"Tell me you saw that too.\"",
    personaRole: "astronomer and trusted partner",
    archetype: "skeptical occult scientist",
    personaTraits: "exacting\nprotective\ndryly funny\nemotionally candid",
    speakingStyle: "Precise, clipped speech with dry astronomy jokes under pressure.",
    emotionalTone: "controlled but visibly expressive",
    relationshipStyle: "romantic",
    boundaries: "All intimacy is consensual and between adults.",
    messageLength: "short" as const,
    visibility: "PRIVATE" as const,
    isNSFW: true
  };

  const neutralPayload = buildCharacterCreatePayload({
    draft: { ...baseDraft, romanceLevel: 0, seriousness: 5, initiative: 5, roleplayIntensity: 5 },
    isSimpleMode: true,
    creationMode: "simple"
  });
  const romanticPayload = buildCharacterCreatePayload({
    draft: { ...baseDraft, romanceLevel: 10, seriousness: 6, initiative: 8, roleplayIntensity: 10 },
    isSimpleMode: true,
    creationMode: "simple"
  });
  const tensePayload = buildCharacterCreatePayload({
    draft: { ...baseDraft, romanceLevel: 0, humor: 0, seriousness: 10, initiative: 10, roleplayIntensity: 10 },
    isSimpleMode: true,
    creationMode: "simple"
  });
  const chapterFourPayload = buildCharacterCreatePayload({
    draft: {
      ...baseDraft,
      defaultChatMode: "fantasy",
      humor: 10,
      romanceLevel: 10,
      seriousness: 10,
      initiative: 10,
      messageLength: "long",
      roleplayIntensity: 10
    },
    isSimpleMode: true,
    creationMode: "simple"
  });

  const reply = async (
    payload: typeof neutralPayload,
    currentMessage: string,
    chatId: string,
    summary: string,
    maxTokens: number
  ) => {
    const mode = payload.defaultChatMode;
    const layers = buildPromptAddonLayers({ mode, characterMemories: [], userMemories: [] });
    const messages = promptAssembly.assembleNytheraPrompt({
      character: {
        name: payload.name,
        description: payload.description,
        personality: payload.personality,
        scenario: payload.scenario,
        greeting: payload.greeting,
        communicationStyle: (payload.communicationStyle ?? null) as Prisma.JsonValue,
        persona: (payload.persona ?? null) as Prisma.JsonValue,
        lorebook: (payload.lorebook ?? null) as Prisma.JsonValue,
        systemPromptOverride: null,
        tags: payload.tags,
        isNSFW: payload.isNSFW
      },
      memories: [],
      summary,
      recentMessages: [],
      currentMessage,
      userPersona: "Active user persona: Alex\nUser persona name: Alex Mercer\nUser persona summary: Alex is a thirty-year-old observatory engineer.",
      modeContext: layers.modeStyle,
      sessionMemoryContext: layers.sessionMemory
    });
    let text = "";
    for await (const chunk of gateway.streamGatewayResponse({
      messages,
      model: provider.defaultModel!,
      temperature: 0.35,
      maxTokens,
      userId: "character-behavior-verification",
      chatId,
      providerKeys: [provider]
    })) {
      if (chunk.type === "delta") text += chunk.text;
      if (chunk.type === "error") throw new Error(chunk.message);
    }
    return text.trim();
  };

  const romancePrompt = "I step close enough that only Mara can hear. \"I want you too. Tell me what you want, and don't hide behind another joke.\"";
  const establishedRomance = "Mara and Alex are consenting adults. They have openly admitted mutual attraction but have not acted on it yet.";
  const quotaPause = () => new Promise((resolve) => setTimeout(resolve, provider.source === "platform" ? 13_000 : 1_500));
  const neutral = await reply(neutralPayload, "I set a fresh calibration report beside Mara. \"The western lens is aligned.\"", "emotion-neutral", "Mara and Alex are trusted colleagues finishing a routine shift.", 260);
  await quotaPause();
  const romantic = await reply(romanticPayload, romancePrompt, "emotion-romantic", establishedRomance, 300);
  await quotaPause();
  const tense = await reply(tensePayload, "The orrery shows the east tower collapsing tomorrow. \"Mara, there are people inside that tower.\"", "emotion-tense", "The orrery's predictions have never been wrong. Evacuation would expose Mara's forbidden research.", 300);
  await quotaPause();
  const romanceMinimum = await reply(neutralPayload, romancePrompt, "romance-minimum", establishedRomance, 300);
  await quotaPause();
  const chapterFour = await reply(chapterFourPayload, "The impossible brass orrery shows tomorrow's eclipse swallowing the city. I squeeze Mara's hand and ask what she plans to do.", "chapter-four", "Mara and Alex are consenting adult partners. The orrery's predictions are reliable, and the city has no warning.", 1_050);
  await quotaPause();
  const secondPrologue = await characterGeneration.generateCharacterFromDescription({
    name: baseDraft.name,
    description: baseDraft.description,
    prologuePov: "second",
    userId: "prologue-second-verification",
    providerKeys: [provider]
  });
  await quotaPause();
  const thirdPrologue = await characterGeneration.generateCharacterFromDescription({
    name: baseDraft.name,
    description: baseDraft.description,
    prologuePov: "third",
    userId: "prologue-third-verification",
    providerKeys: [provider]
  });

  console.log(JSON.stringify({
    provider: { name: provider.displayName, model: provider.defaultModel },
    emotionSamples: { neutral, romanticMaximum: romantic, tense },
    romanceComparison: { prompt: romancePrompt, minimum: romanceMinimum, maximum: romantic },
    chapterFour: {
      config: {
        defaultChatMode: chapterFourPayload.defaultChatMode,
        ...chapterFourPayload.communicationStyle
      },
      output: chapterFour
    },
    prologues: {
      context: { character: baseDraft.name, playerPersona: "Alex Mercer" },
      secondPerson: {
        source: secondPrologue.source,
        output: renderCharacterPrologue({
          greeting: secondPrologue.greeting,
          characterName: baseDraft.name,
          communicationStyle: { prologuePov: "second" },
          userPersonaName: "Alex Mercer"
        })
      },
      thirdPerson: {
        source: thirdPrologue.source,
        output: renderCharacterPrologue({
          greeting: thirdPrologue.greeting,
          characterName: baseDraft.name,
          communicationStyle: { prologuePov: "third" },
          userPersonaName: "Alex Mercer"
        })
      }
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
