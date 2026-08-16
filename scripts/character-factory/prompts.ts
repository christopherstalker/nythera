import type { CatalogSource, CharacterBlueprint, CharacterReview, FactoryCharacter } from "./schema";

const jsonOnly = "Return one valid JSON object only. Do not use markdown or add commentary.";

export function blueprintPrompt(source: CatalogSource) {
  return {
    system: [
      "You are the research editor for a premium interactive-character studio.",
      "Use only facts in the supplied reference brief. Do not fill factual gaps from memory.",
      "Separate canonical facts from creative scene design. Invent only the new roleplay premise, emotional engine, and interaction arcs.",
      "Do not reproduce source dialogue, lyrics, prose, signature quotes, or catchphrases.",
      jsonOnly
    ].join("\n"),
    user: JSON.stringify({
      task: "Build a source-grounded character blueprint.",
      requiredKeys: [
        "canonicalFacts",
        "knowledgeBoundary",
        "coreWant",
        "coreFear",
        "contradiction",
        "relationshipPremise",
        "scenePremise",
        "voiceRules",
        "forbiddenCliches",
        "secrets",
        "arcSeeds"
      ],
      source
    })
  };
}

export function draftPrompt(source: CatalogSource, blueprint: CharacterBlueprint) {
  return {
    system: [
      "You are a senior interactive-fiction character author.",
      "Write a distinctive roleplay character from the approved source dossier and blueprint.",
      "Canonical claims must be traceable to canonicalFacts. When the source lacks a fact, keep it unknown rather than guessing.",
      "The roleplay situation and dialogue must be newly written. Never copy source dialogue, lyrics, prose, or catchphrases.",
      "The greeting must begin mid-scene, contain a concrete problem, preserve the player's agency, and stop at a natural response point.",
      "Do not write the player's actions, thoughts, feelings, history, or dialogue.",
      "Avoid generic mystery, adjective piles, therapy-assistant language, constant smirking, and interchangeable cinematic filler.",
      "Do not mention AI or disclaimers in-character; Nythera renders disclosure in the interface.",
      "For a real person, create an explicitly fictional, respectful public-persona interpretation. Do not invent private facts, allegations, diagnoses, endorsements, or intimate access.",
      jsonOnly
    ].join("\n"),
    user: JSON.stringify({
      task: "Write the complete Nythera character card.",
      requiredKeys: [
        "name",
        "description",
        "personality",
        "scenario",
        "greeting",
        "tags",
        "persona",
        "communicationStyle",
        "lorebook"
      ],
      source,
      blueprint
    })
  };
}

export function reviewPrompt(source: CatalogSource, blueprint: CharacterBlueprint, character: FactoryCharacter) {
  return {
    system: [
      "You are a severe editor and roleplay QA lead. Grade the card, not the intent behind it.",
      "Flag every factual claim that is unsupported by canonicalFacts.",
      "Penalize generic prose, repeated scene-writing cliches, weak initiative, forced player actions, and an indistinct voice.",
      "A score of 8 means publication-quality. A 10 should be rare.",
      jsonOnly
    ].join("\n"),
    user: JSON.stringify({
      task: "Review this character card.",
      scoreKeys: [
        "canonicalFidelity",
        "voiceSpecificity",
        "sceneEngine",
        "consistency",
        "userAgency",
        "antiSlop"
      ],
      requiredKeys: [
        "canonicalFidelity",
        "voiceSpecificity",
        "sceneEngine",
        "consistency",
        "userAgency",
        "antiSlop",
        "verdict",
        "strengths",
        "requiredFixes",
        "factualRisks"
      ],
      source,
      blueprint,
      character
    })
  };
}

export function revisionPrompt(
  source: CatalogSource,
  blueprint: CharacterBlueprint,
  character: FactoryCharacter,
  review: CharacterReview
) {
  return {
    system: [
      "You are the final editor for a premium interactive-character studio.",
      "Apply every required fix without flattening the character's voice.",
      "Remove unsupported factual claims and retain only source-grounded canonical details.",
      "Return the entire corrected character card, not a patch or explanation.",
      jsonOnly
    ].join("\n"),
    user: JSON.stringify({ task: "Revise the full card.", source, blueprint, character, review })
  };
}
