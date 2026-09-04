import { z } from "zod";

export const NytheraPersonaSchema = z
  .object({
    behavioral_drives: z.array(z.string().min(2)).min(3).max(12),
    boundaries: z.array(z.string().min(2)).min(2).max(12),
    speaking_style: z.object({
      voice: z.string().min(8).max(240),
      pacing: z.enum(["short", "balanced", "long", "cinematic"]),
      initiative: z.enum(["low", "medium", "high"]),
      intimacy: z.enum(["guarded", "warm", "intense"]),
      taboo_avoidance: z.array(z.string().min(2)).min(1).max(10)
    }),
    relationship_dynamics: z.object({
      default: z.enum(["friend", "mentor", "rival", "antagonist", "romantic"]),
      push_pull: z.string().min(8).max(240),
      trust_triggers: z.array(z.string().min(2)).min(2).max(10),
      rupture_triggers: z.array(z.string().min(2)).min(2).max(10),
      repair_style: z.string().min(8).max(240)
    }),
    memory_model: z.object({
      what_they_notice: z.array(z.string().min(2)).min(3).max(12),
      what_they_misread: z.array(z.string().min(2)).min(2).max(10),
      what_they_hide: z.array(z.string().min(2)).min(2).max(10)
    }),
    scene_engine: z.object({
      preferred_conflict: z.array(z.string().min(2)).min(2).max(10),
      escalation_levers: z.array(z.string().min(2)).min(2).max(10),
      deescalation_levers: z.array(z.string().min(2)).min(2).max(10),
      questions_they_ask: z.array(z.string().min(6)).min(3).max(10)
    })
  })
  .strict();

export const NytheraCharacterSeedSchema = z
  .object({
    id: z.string().min(6).max(80),
    name: z.string().min(2).max(70),
    archetype: z.string().min(6).max(120),
    emotional_hook: z.string().min(12).max(240),
    persona: NytheraPersonaSchema,
    scenario: z.string().min(40).max(1200),
    greeting: z.string().min(220).max(2200),
    conversation_hooks: z.array(z.string().min(10).max(220)).min(4).max(12),
    tags: z.array(z.string().min(2).max(40)).min(4).max(18)
  })
  .strict();

export type NytheraCharacterSeed = z.infer<typeof NytheraCharacterSeedSchema>;

export const NytheraCharacterBatchSchema = z.array(NytheraCharacterSeedSchema).min(1);

export function toPrismaCharacterFields(seed: NytheraCharacterSeed) {
  const communicationStyle = {
    tone: seed.persona.speaking_style.voice,
    initiative:
      seed.persona.speaking_style.initiative === "high"
        ? 8
        : seed.persona.speaking_style.initiative === "low"
          ? 3
          : 5,
    messageLength:
      seed.persona.speaking_style.pacing === "short"
        ? "short"
        : seed.persona.speaking_style.pacing === "long"
          ? "long"
          : "medium"
  };

  const persona = {
    name: seed.name,
    archetype: seed.archetype,
    personalityTraits: [
      ...seed.persona.behavioral_drives.slice(0, 6),
      ...seed.persona.memory_model.what_they_notice.slice(0, 4)
    ].slice(0, 12),
    speakingStyle: seed.persona.speaking_style.voice,
    emotionalTone: seed.emotional_hook,
    initiativeLevel: seed.persona.speaking_style.initiative,
    boundaries: seed.persona.boundaries.slice(0, 8),
    motivation: seed.persona.relationship_dynamics.push_pull,
    behavioralRules: [
      ...seed.persona.scene_engine.escalation_levers.slice(0, 4),
      ...seed.persona.scene_engine.deescalation_levers.slice(0, 4)
    ].slice(0, 8),
    forbiddenBehaviors: seed.persona.speaking_style.taboo_avoidance.slice(0, 8),
    verbosityLevel:
      seed.persona.speaking_style.pacing === "cinematic"
        ? "immersive"
        : seed.persona.speaking_style.pacing === "long"
          ? "expressive"
          : seed.persona.speaking_style.pacing === "short"
            ? "concise"
            : "balanced",
    relationshipDynamics: seed.persona.relationship_dynamics.default,
    relationshipStyle: seed.persona.relationship_dynamics.default
  };

  return {
    // prisma Character
    name: seed.name,
    description: `${seed.archetype}. ${seed.emotional_hook}`.trim(),
    personality: [
      `Archetype: ${seed.archetype}`,
      `Emotional hook: ${seed.emotional_hook}`,
      "Behavioral drives:",
      ...seed.persona.behavioral_drives.map((d) => `- ${d}`),
      "Boundaries:",
      ...seed.persona.boundaries.map((b) => `- ${b}`),
      "Conversation hooks:",
      ...seed.conversation_hooks.map((h) => `- ${h}`)
    ].join("\n"),
    scenario: seed.scenario,
    greeting: seed.greeting,
    tags: seed.tags,
    persona,
    communicationStyle
  };
}
