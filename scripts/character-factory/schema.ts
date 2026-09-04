import { z } from "zod";
import { CHARACTER_ORIGIN_TYPES } from "../../src/lib/character-provenance";

export const CatalogSourceSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9-_]{2,79}$/i),
    name: z.string().trim().min(2).max(80),
    originType: z.enum(CHARACTER_ORIGIN_TYPES),
    sourceLabel: z.string().trim().min(2).max(240),
    sourceUrls: z
      .array(
        z
          .string()
          .url()
          .max(1000)
          .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Source URLs must use HTTP or HTTPS.")
      )
      .min(1)
      .max(8),
    referenceBrief: z.string().trim().min(200).max(12_000),
    universe: z.string().trim().min(2).max(160).optional(),
    portrayal: z.string().trim().min(20).max(1000).optional(),
    locale: z.string().trim().min(2).max(24).default("en"),
    tags: z.array(z.string().trim().min(1).max(32)).max(8).default([]),
    isLiving: z.boolean().optional(),
    isNSFW: z.boolean().default(false),
    notes: z.string().trim().max(2000).optional()
  })
  .strict()
  .superRefine((source, context) => {
    if (source.originType === "REAL_PERSON" && source.isLiving === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isLiving"],
        message: "REAL_PERSON sources must state whether the subject is living."
      });
    }
    if (source.originType === "FAN_INTERPRETATION" && !source.universe) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["universe"],
        message: "FAN_INTERPRETATION sources must name their universe."
      });
    }
  });

export const CatalogSourceManifestSchema = z.union([
  z.array(CatalogSourceSchema).min(1),
  z.object({ sources: z.array(CatalogSourceSchema).min(1) }).strict()
]);

export const CharacterBlueprintSchema = z
  .object({
    canonicalFacts: z.array(z.string().trim().min(4).max(300)).min(5).max(20),
    knowledgeBoundary: z.array(z.string().trim().min(4).max(300)).min(2).max(12),
    coreWant: z.string().trim().min(20).max(500),
    coreFear: z.string().trim().min(20).max(500),
    contradiction: z.string().trim().min(20).max(500),
    relationshipPremise: z.string().trim().min(20).max(600),
    scenePremise: z.string().trim().min(40).max(1000),
    voiceRules: z.array(z.string().trim().min(5).max(240)).min(4).max(12),
    forbiddenCliches: z.array(z.string().trim().min(2).max(120)).min(4).max(16),
    secrets: z.array(z.string().trim().min(10).max(400)).min(2).max(8),
    arcSeeds: z.array(z.string().trim().min(10).max(400)).min(3).max(8)
  })
  .strict();

const PersonaSchema = z
  .object({
    role: z.string().trim().min(2).max(120),
    archetype: z.string().trim().min(2).max(120),
    personalityTraits: z.array(z.string().trim().min(2).max(160)).min(4).max(12),
    speakingStyle: z.string().trim().min(20).max(500),
    emotionalTone: z.string().trim().min(2).max(240),
    initiativeLevel: z.enum(["low", "medium", "high"]),
    verbosityLevel: z.enum(["concise", "balanced", "expressive", "immersive"]),
    relationshipStyle: z.enum(["friend", "romantic", "mentor", "rival", "antagonist"]),
    motivation: z.string().trim().min(20).max(800),
    boundaries: z.array(z.string().trim().min(2).max(160)).min(2).max(12),
    behavioralRules: z.array(z.string().trim().min(2).max(160)).min(4).max(12),
    forbiddenBehaviors: z.array(z.string().trim().min(2).max(160)).min(3).max(12)
  })
  .strict();

const CommunicationStyleSchema = z
  .object({
    tone: z.string().trim().min(2).max(80),
    humor: z.number().min(0).max(10),
    romanceLevel: z.number().min(0).max(10),
    seriousness: z.number().min(0).max(10),
    initiative: z.number().min(0).max(10),
    messageLength: z.enum(["short", "medium", "long"]),
    roleplayIntensity: z.number().min(0).max(10)
  })
  .strict();

const LorebookSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
            text: z.string().trim().min(20).max(2000)
          })
          .strict()
      )
      .min(3)
      .max(18)
  })
  .strict();

export const FactoryCharacterSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(30).max(700),
    personality: z.string().trim().min(200).max(5000),
    scenario: z.string().trim().min(100).max(5000),
    greeting: z.string().trim().min(180).max(2000),
    tags: z.array(z.string().trim().min(1).max(32)).min(3).max(12),
    persona: PersonaSchema,
    communicationStyle: CommunicationStyleSchema,
    lorebook: LorebookSchema
  })
  .strict();

export const CharacterReviewSchema = z
  .object({
    canonicalFidelity: z.number().int().min(0).max(10),
    voiceSpecificity: z.number().int().min(0).max(10),
    sceneEngine: z.number().int().min(0).max(10),
    consistency: z.number().int().min(0).max(10),
    userAgency: z.number().int().min(0).max(10),
    antiSlop: z.number().int().min(0).max(10),
    verdict: z.enum(["ACCEPT", "REVISE", "REJECT"]),
    strengths: z.array(z.string().trim().min(4).max(300)).max(8),
    requiredFixes: z.array(z.string().trim().min(4).max(300)).max(12),
    factualRisks: z.array(z.string().trim().min(4).max(300)).max(12)
  })
  .strict();

export type CatalogSource = z.infer<typeof CatalogSourceSchema>;
export type CharacterBlueprint = z.infer<typeof CharacterBlueprintSchema>;
export type FactoryCharacter = z.infer<typeof FactoryCharacterSchema>;
export type CharacterReview = z.infer<typeof CharacterReviewSchema>;

export type FactoryRecord = {
  format: "nythera-catalog-factory-v1";
  batchId: string;
  generatedAt: string;
  model: string;
  source: CatalogSource;
  blueprint: CharacterBlueprint;
  character: FactoryCharacter;
  review: CharacterReview;
  status: "READY_FOR_HUMAN_REVIEW" | "NEEDS_REVISION" | "REJECTED";
};

export function parseSourceManifest(value: unknown) {
  const parsed = CatalogSourceManifestSchema.parse(value);
  return Array.isArray(parsed) ? parsed : parsed.sources;
}

export function reviewScore(review: CharacterReview) {
  return (
    review.canonicalFidelity +
    review.voiceSpecificity +
    review.sceneEngine +
    review.consistency +
    review.userAgency +
    review.antiSlop
  );
}

export function recordStatus(review: CharacterReview): FactoryRecord["status"] {
  const score = reviewScore(review);
  if (review.verdict === "REJECT" || review.canonicalFidelity < 6 || review.userAgency < 6) {
    return "REJECTED";
  }
  if (review.verdict === "ACCEPT" && score >= 48 && review.antiSlop >= 7) {
    return "READY_FOR_HUMAN_REVIEW";
  }
  return "NEEDS_REVISION";
}
