import { z } from "zod";

const MAX_IMAGE_DATA_URL_BYTES = 1_500_000;
const MAX_IMAGE_DATA_URL_LENGTH = 2_100_000;
const imageDataUrlPattern = /^data:image\/(png|jpe?g|webp|gif);base64,([a-zA-Z0-9+/=\s]+)$/i;

function decodeBase64ImageBytes(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (normalized.length > Math.ceil((MAX_IMAGE_DATA_URL_BYTES * 4) / 3) + 8) {
    return null;
  }

  try {
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(normalized, "base64"));
    }

    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function hasImageMagicBytes(format: string, bytes: Uint8Array) {
  if (format === "png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  if (format === "jpg" || format === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (format === "webp") {
    return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  if (format === "gif") {
    return bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
  }

  return false;
}

function isValidImageDataUrl(value: string) {
  const match = imageDataUrlPattern.exec(value);
  if (!match) {
    return false;
  }

  const bytes = decodeBase64ImageBytes(match[2]);
  return Boolean(bytes && bytes.byteLength <= MAX_IMAGE_DATA_URL_BYTES && hasImageMagicBytes(match[1].toLowerCase(), bytes));
}

function isAllowedRemoteImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      return true;
    }

    return process.env.NODE_ENV !== "production" && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export const imageSourceSchema = z
  .string()
  .trim()
  .max(MAX_IMAGE_DATA_URL_LENGTH, "Image must be smaller than 1.5MB.")
  .refine((value) => {
    if (value === "") {
      return true;
    }

    if (isValidImageDataUrl(value)) {
      return true;
    }

    return isAllowedRemoteImageUrl(value);
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

const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");

export const characterLorebookSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
        text: z.string().trim().min(1).max(2000)
      })
    )
    .max(24)
});

export const characterVisualIdentitySchema = z.object({
  accentColor: hexColorSchema.optional(),
  gradientFrom: hexColorSchema.optional(),
  gradientTo: hexColorSchema.optional(),
  chatBackground: z.string().trim().max(500).optional()
});

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
  lorebook: characterLorebookSchema.optional(),
  visualIdentity: characterVisualIdentitySchema.optional(),
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
  model: z.string().trim().min(1).max(160).optional()
});

export const chatUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  archived: z.boolean().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().trim().min(1).max(160).optional(),
  responsePrompt: z.string().trim().max(2000).optional()
});

export const streamMessageSchema = z
  .object({
    message: z.string().max(4000).optional().default(""),
    temperature: z.coerce.number().min(0).max(2).optional(),
    model: z.string().trim().min(1).max(160).optional(),
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

export const roomCreateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  characterIds: z.array(z.string().trim().min(1)).min(2).max(6),
  model: z.string().trim().min(1).max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  responsePrompt: z.string().trim().max(2000).optional().or(z.literal(""))
});

export const roomPatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  responsePrompt: z.string().trim().max(2000).optional().or(z.literal("")),
  archived: z.boolean().optional()
});

export const roomMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  requestId: z.string().trim().min(8).max(120).optional(),
  characterId: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).optional()
});

export const voiceKeySchema = z.object({
  provider: z.enum(["elevenlabs", "playht"]),
  apiKey: z.string().trim().min(6).max(1200),
  authId: z.string().trim().max(160).optional().or(z.literal("")),
  defaultVoiceId: z.string().trim().max(160).optional().or(z.literal("")),
  baseUrl: z.string().url().max(240).optional().or(z.literal(""))
});

export const voiceSynthesisSchema = z.object({
  provider: z.enum(["elevenlabs", "playht"]).default("elevenlabs"),
  text: z.string().trim().min(1).max(2500),
  voiceId: z.string().trim().max(160).optional().or(z.literal("")),
  format: z.enum(["mp3", "wav"]).default("mp3")
});
