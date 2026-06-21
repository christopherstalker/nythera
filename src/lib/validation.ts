import { z } from "zod";

const imageDataUrlPattern = /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[a-zA-Z0-9+/=\s]+$/;

export const imageSourceSchema = z
  .string()
  .trim()
  .max(2_100_000, "Image must be smaller than 1.5MB.")
  .refine((value) => {
    if (value === "") {
      return true;
    }

    if (imageDataUrlPattern.test(value)) {
      return true;
    }

    return z.string().url().safeParse(value).success;
  }, "Use a valid image file or image URL.");

export const communicationStyleSchema = z.object({
  tone: z.string().max(80).optional(),
  humor: z.coerce.number().min(0).max(10).optional(),
  romanceLevel: z.coerce.number().min(0).max(10).optional(),
  seriousness: z.coerce.number().min(0).max(10).optional(),
  initiative: z.coerce.number().min(0).max(10).optional(),
  messageLength: z.enum(["short", "medium", "long"]).optional(),
  roleplayIntensity: z.coerce.number().min(0).max(10).optional()
});

const personaListSchema = z.array(z.string().trim().min(1).max(160)).max(16);

export const characterPersonaSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().min(1).max(120).optional(),
  archetype: z.string().trim().min(1).max(120).optional(),
  personalityTraits: personaListSchema.optional(),
  speakingStyle: z.string().trim().max(500).optional(),
  emotionalTone: z.string().trim().max(240).optional(),
  initiativeLevel: z.enum(["low", "medium", "high"]).optional(),
  boundaries: personaListSchema.optional(),
  motivation: z.string().trim().max(800).optional(),
  behavioralRules: personaListSchema.optional(),
  forbiddenBehaviors: personaListSchema.optional(),
  verbosityLevel: z.enum(["concise", "balanced", "expressive", "immersive"]).optional(),
  relationshipStyle: z.enum(["friend", "romantic", "mentor", "rival", "antagonist"]).optional(),
  relationshipDynamics: z.enum(["friend", "romantic", "mentor", "rival", "antagonist"]).optional()
});

export const characterCreateSchema = z.object({
  creationMode: z.enum(["simple", "custom"]).default("custom"),
  name: z.string().min(2).max(80),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")),
  description: z.string().min(10).max(5000),
  personality: z.string().min(20).max(5000),
  scenario: z.string().max(5000).optional(),
  greeting: z.string().min(2).max(2000),
  communicationStyle: communicationStyleSchema.optional(),
  persona: characterPersonaSchema.optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE"),
  tags: z.array(z.string().min(1).max(32)).max(12).default([]),
  isNSFW: z.boolean().default(false),
  preferredProvider: z.string().trim().min(1).max(48).nullable().optional(),
  preferredModel: z.string().trim().min(1).max(160).nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  topP: z.number().min(0).max(1).nullable().optional(),
  frequencyPenalty: z.number().min(-2).max(2).nullable().optional(),
  presencePenalty: z.number().min(-2).max(2).nullable().optional(),
  maxTokens: z.number().int().min(1).max(32768).nullable().optional(),
  systemPromptOverride: z.string().trim().max(8000).nullable().optional()
});

export const characterUpdateSchema = characterCreateSchema.partial();

export const chatCreateSchema = z.object({
  characterId: z.string().min(1),
  title: z.string().max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  model: z.string().max(160).optional()
});

export const chatUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  archived: z.boolean().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().max(160).optional(),
  responsePrompt: z.string().trim().max(2000).optional()
});

export const streamMessageSchema = z
  .object({
    message: z.string().max(4000).optional().default(""),
    temperature: z.coerce.number().min(0).max(2).optional(),
    model: z.string().max(160).optional(),
    responsePrompt: z.string().trim().max(2000).optional(),
    requestId: z.string().min(8).max(120).optional(),
    regenerate: z.boolean().optional(),
    continueChat: z.boolean().optional()
  })
  .refine((input) => input.continueChat || input.message.trim().length > 0, {
    message: "Message is required.",
    path: ["message"]
  });

export const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can contain letters, numbers, and underscores only."),
  password: z.string().min(8).max(128)
});

export const reportSchema = z.object({
  reason: z.string().min(3).max(120),
  details: z.string().max(2000).optional()
});

export const ratingSchema = z.object({
  value: z.coerce.number().int().min(1).max(5),
  review: z.string().trim().max(1200).optional().or(z.literal(""))
});

const listFromTextSchema = z
  .array(z.string().trim().min(1).max(160))
  .max(24)
  .default([]);

export const userPersonaSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")).nullable(),
  summary: z.string().trim().min(10).max(8000),
  background: z.string().trim().max(3000).optional().or(z.literal("")).nullable(),
  traits: listFromTextSchema,
  likes: listFromTextSchema,
  dislikes: listFromTextSchema,
  boundaries: listFromTextSchema,
  visibility: z.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE")
});

export const memoryCreateSchema = z.object({
  content: z.string().trim().min(2).max(2000),
  characterId: z.string().min(1).optional().nullable(),
  category: z
    .enum([
      "USER_PROFILE",
      "PREFERENCE",
      "RELATIONSHIP",
      "FACT",
      "EMOTIONAL_CONTEXT",
      "RECURRING_TOPIC",
      "EVENT",
      "WORLD_STATE",
      "OTHER"
    ])
    .default("OTHER"),
  importance: z.coerce.number().min(0).max(5).default(1),
  pinned: z.boolean().default(false)
});

export const memoryUpdateSchema = z.object({
  content: z.string().trim().min(2).max(2000).optional(),
  importance: z.coerce.number().min(0).max(5).optional(),
  pinned: z.boolean().optional(),
  category: memoryCreateSchema.shape.category.optional()
});
