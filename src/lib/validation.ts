import { z } from "zod";
import { ELEVATED_CHAT_MESSAGE_LENGTH, ELEVATED_RESPONSE_PROMPT_LENGTH } from "@/lib/chat-limits";
import { resolveMusicEmbed } from "@/lib/music-embed";
import { isRussianLanguageLabel, RUSSIAN_LANGUAGE_ERROR } from "@/lib/language-policy";
import { MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS } from "@/lib/prompt-limits";
import { usernameSchema } from "@/lib/username";

const MAX_IMAGE_DATA_URL_BYTES = 140_000;
const MAX_IMAGE_DATA_URL_LENGTH = 190_000;
const imageDataUrlPattern = /^data:image\/(png|jpe?g|webp|gif);base64,([a-zA-Z0-9+/=\s]+)$/i;

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

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
  .max(MAX_IMAGE_DATA_URL_LENGTH, "Image must be smaller than 140KB.")
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
  roleplayIntensity: z.coerce.number().min(0).max(10).optional(),
  prologuePov: z.enum(["second", "third"]).optional()
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

const additionalCharacterPersonaSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(2).max(80),
  personality: z.string().trim().min(20).max(5000),
  role: z.string().trim().min(1).max(120).optional(),
  archetype: z.string().trim().min(1).max(120).optional(),
  personalityTraits: personaListSchema.optional(),
  speakingStyle: z.string().trim().max(500).optional(),
  emotionalTone: z.string().trim().max(240).optional(),
  motivation: z.string().trim().max(800).optional(),
  boundaries: personaListSchema.optional(),
  behavioralRules: personaListSchema.optional(),
  forbiddenBehaviors: personaListSchema.optional()
});

export const characterPersonaSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().min(1).max(120).optional(),
  archetype: z.string().trim().min(1).max(120).optional(),
  personalityTraits: personaListSchema.optional(),
  speakingStyle: z.string().trim().max(500).optional(),
  background: z.string().trim().max(5000).optional(),
  emotionalTone: z.string().trim().max(240).optional(),
  initiativeLevel: z.enum(["low", "medium", "high"]).optional(),
  boundaries: personaListSchema.optional(),
  motivation: z.string().trim().max(800).optional(),
  behavioralRules: personaListSchema.optional(),
  forbiddenBehaviors: personaListSchema.optional(),
  verbosityLevel: z.enum(["concise", "balanced", "expressive", "immersive"]).optional(),
  relationshipStyle: z.enum(["friend", "romantic", "mentor", "rival", "antagonist"]).optional(),
  relationshipDynamics: z.enum(["friend", "romantic", "mentor", "rival", "antagonist"]).optional(),
  additionalCharacters: z.array(additionalCharacterPersonaSchema).max(7).optional()
});

export const characterCreateSchema = z.object({
  creationMode: z.enum(["simple", "custom"]).default("custom"),
  name: z.string().min(2).max(80),
  avatarUrl: imageSourceSchema.optional().or(z.literal("")),
  description: z.string().min(10).max(5000),
  personality: z.string().min(20).max(5000),
  scenario: z.string().max(5000).optional(),
  greeting: z.string().min(2),
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
  maxTokens: z.number().int().min(1).max(4096).nullable().optional(),
  systemPromptOverride: z.string().trim().max(MAX_CHARACTER_SYSTEM_PROMPT_CHARACTERS).nullable().optional(),
  defaultChatMode: z.enum(["realism", "fantasy"]).default("realism")
});

export const characterUpdateSchema = characterCreateSchema.partial();

const unlimitedAdditionalCharacterPersonaSchema = additionalCharacterPersonaSchema.extend({
  name: z.string().trim().min(2),
  personality: z.string().trim().min(20),
  role: z.string().trim().min(1).optional(),
  archetype: z.string().trim().min(1).optional(),
  personalityTraits: z.array(z.string().trim().min(1)).max(16).optional(),
  speakingStyle: z.string().trim().optional(),
  emotionalTone: z.string().trim().optional(),
  motivation: z.string().trim().optional(),
  boundaries: z.array(z.string().trim().min(1)).max(16).optional(),
  behavioralRules: z.array(z.string().trim().min(1)).max(16).optional(),
  forbiddenBehaviors: z.array(z.string().trim().min(1)).max(16).optional()
});

const unlimitedCharacterPersonaSchema = characterPersonaSchema.extend({
  name: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  archetype: z.string().trim().min(1).optional(),
  personalityTraits: z.array(z.string().trim().min(1)).max(16).optional(),
  speakingStyle: z.string().trim().optional(),
  background: z.string().trim().optional(),
  emotionalTone: z.string().trim().optional(),
  boundaries: z.array(z.string().trim().min(1)).max(16).optional(),
  motivation: z.string().trim().optional(),
  behavioralRules: z.array(z.string().trim().min(1)).max(16).optional(),
  forbiddenBehaviors: z.array(z.string().trim().min(1)).max(16).optional(),
  additionalCharacters: z.array(unlimitedAdditionalCharacterPersonaSchema).max(7).optional()
});

const unlimitedCharacterLorebookSchema = characterLorebookSchema.extend({
  entries: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        keywords: z.array(z.string().trim().min(1)).min(1).max(12),
        text: z.string().trim().min(1)
      })
    )
    .max(24)
});

const unlimitedCharacterCreateSchema = characterCreateSchema.extend({
  name: z.string().min(2),
  description: z.string().min(10),
  personality: z.string().min(20),
  scenario: z.string().optional(),
  greeting: z.string().min(2),
  communicationStyle: communicationStyleSchema.extend({
    tone: z.string().optional()
  }).optional(),
  persona: unlimitedCharacterPersonaSchema.optional(),
  lorebook: unlimitedCharacterLorebookSchema.optional(),
  visualIdentity: characterVisualIdentitySchema.extend({
    chatBackground: z.string().trim().optional()
  }).optional(),
  systemPromptOverride: z.string().trim().nullable().optional()
});

export const unlimitedCharacterUpdateSchema = unlimitedCharacterCreateSchema.partial();

export function characterCreateSchemaFor(unlimitedCharacterFields: boolean) {
  return unlimitedCharacterFields ? unlimitedCharacterCreateSchema : characterCreateSchema;
}

export function characterUpdateSchemaFor(unlimitedCharacterFields: boolean) {
  return unlimitedCharacterFields ? unlimitedCharacterUpdateSchema : characterUpdateSchema;
}

export const chatCreateSchema = z.object({
  characterId: z.string().min(1),
  title: z.string().max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().trim().min(1).max(160).optional(),
  chatMode: z.enum(["realism", "fantasy"]).optional()
});

export const chatAppearanceSchema = z.object({
  backgroundMode: z.enum(["default", "custom", "none"]),
  backgroundUrl: z.string().trim().max(1000),
  backgroundType: z.enum(["auto", "image", "video"]),
  backgroundFit: z.enum(["cover", "contain"]),
  backgroundPosition: z.enum(["center", "top", "bottom"]),
  backgroundDim: z.coerce.number().min(0).max(0.92),
  backgroundBlur: z.coerce.number().min(0).max(24),
  fontFamily: z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}\s._-]+$/u),
  fontUrl: z.string().trim().max(1000).refine((value) => !value || isHttpsUrl(value), "Custom fonts must use HTTPS."),
  fontSize: z.coerce.number().min(14).max(38),
  fontWeight: z.coerce.number().min(300).max(800),
  lineHeight: z.coerce.number().min(1.15).max(2.2),
  contentWidth: z.coerce.number().min(560).max(1200),
  textColor: hexColorSchema,
  music: z.object({
    enabled: z.boolean(),
    url: z.string().trim().max(500).refine((value) => !value || Boolean(resolveMusicEmbed(value)), "Use a supported HTTPS music link."),
    title: z.string().trim().max(100)
  })
});

export const chatUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  archived: z.boolean().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().trim().min(1).max(160).optional(),
  responsePrompt: z.string().trim().max(ELEVATED_RESPONSE_PROMPT_LENGTH).optional(),
  chatMode: z.enum(["realism", "fantasy"]).optional(),
  translationLanguage: z
    .string()
    .trim()
    .max(80)
    .refine((value) => !isRussianLanguageLabel(value), RUSSIAN_LANGUAGE_ERROR)
    .nullable()
    .optional(),
  activeAssistantMessageId: z.string().trim().min(1).max(120).nullable().optional(),
  appearance: chatAppearanceSchema.nullable().optional()
});

export const streamMessageSchema = z
  .object({
    message: z.string().max(ELEVATED_CHAT_MESSAGE_LENGTH).optional().default(""),
    attachmentIds: z.array(z.string().cuid()).max(2).optional().default([]),
    temperature: z.coerce.number().min(0).max(2).optional(),
    model: z.string().trim().min(1).max(160).optional(),
    responsePrompt: z.string().trim().max(ELEVATED_RESPONSE_PROMPT_LENGTH).optional(),
    requestId: z.string().min(8).max(120).optional(),
    regenerate: z.boolean().optional(),
    regenerateMessageId: z.string().min(1).max(120).optional(),
    retryUserMessageId: z.string().min(1).max(120).optional(),
    continueChat: z.boolean().optional(),
    skipTime: z.boolean().optional(),
    skipTimeValue: z.number().int().min(1).max(1_000_000_000).optional(),
    skipTimeUnit: z.enum(["minute", "hour", "day", "week", "month", "year"]).optional(),
    continueMessageId: z.string().min(1).max(120).optional(),
    branchMessageId: z.string().min(1).max(120).optional()
  })
  .refine((input) => (input.skipTimeValue === undefined) === (input.skipTimeUnit === undefined), {
    message: "Skip time value and unit must be provided together.",
    path: ["skipTimeValue"]
  })
  .refine((input) => input.continueChat || input.skipTime || input.regenerate || input.retryUserMessageId || input.message.trim().length > 0 || input.attachmentIds.length > 0, {
    message: "Message is required.",
    path: ["message"]
  });

export const mobileStreamMessageSchema = streamMessageSchema.superRefine((input, context) => {
  const unsupported = [
    input.regenerate ? "regenerate" : null,
    input.regenerateMessageId ? "regenerateMessageId" : null,
    input.retryUserMessageId ? "retryUserMessageId" : null,
    input.attachmentIds.length > 0 ? "attachmentIds" : null,
    input.continueMessageId ? "continueMessageId" : null,
    input.branchMessageId ? "branchMessageId" : null
  ].filter((field): field is string => Boolean(field));
  if (unsupported.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Mobile chat does not support: ${unsupported.join(", ")}.`,
      path: [unsupported[0]]
    });
  }
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  username: usernameSchema,
  password: z.string().min(8).max(128),
  adultAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "Confirm that you are 18 or older before creating an account." })
  }),
  turnstileToken: z.string().trim().max(2048).optional()
});

export const adultConsentSchema = z.object({
  adultAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "Confirm that you are 18 or older before continuing." })
  }),
  turnstileToken: z.string().trim().max(2048).optional()
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
  surname: z.string().trim().max(80).optional().or(z.literal("")).nullable(),
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
  category: memoryCreateSchema.shape.category.optional(),
  status: z.enum(["PENDING", "ACTIVE", "REJECTED"]).optional()
});

export const storyFactCreateSchema = z.object({
  timelineId: z.string().trim().min(1).optional().nullable(),
  subjectEntityId: z.string().trim().min(1).optional().nullable(),
  objectEntityId: z.string().trim().min(1).optional().nullable(),
  sourceMessageId: z.string().trim().min(1).optional().nullable(),
  predicate: z.string().trim().min(1, "Choose whether the fact is true now.").max(120, "Truth state is too long."),
  objectText: z.string().trim().min(1, "Write the canonical fact.").max(6000, "Canonical facts can be up to 6,000 characters."),
  kind: z.enum(["PERMANENT", "STATE", "EVENT"]).default("PERMANENT"),
  worldTime: z.string().trim().max(200).optional().nullable(),
  validFromSequence: z.coerce.number().int().min(0).optional().nullable(),
  validUntilSequence: z.coerce.number().int().min(0).optional().nullable(),
  scope: z.enum(["STORY", "PARTICIPANT", "CHARACTER", "OWNER"]).default("STORY"),
  confidence: z.coerce.number().min(0).max(1).default(1),
  importance: z.coerce.number().min(0).max(5).default(1),
  locked: z.boolean().default(false),
  participantIds: z.array(z.string().trim().min(1)).max(24).default([])
});

export const storyFactUpdateSchema = storyFactCreateSchema
  .omit({ timelineId: true, sourceMessageId: true, participantIds: true })
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "SUPERSEDED", "RETRACTED"]).optional(),
    participantIds: z.array(z.string().trim().min(1)).max(24).optional(),
    knowledgeState: z.enum(["KNOWN", "SUSPECTED", "FORGOTTEN"]).optional()
  });

const storyStateListSchema = z.array(z.string().trim().min(1).max(300)).max(50).default([]);

export const storyStateSchema = z.object({
  sceneTitle: z.string().trim().max(160).nullable().default(null),
  time: z.string().trim().max(200).nullable().default(null),
  location: z.string().trim().max(240).nullable().default(null),
  weather: z.string().trim().max(200).nullable().default(null),
  inventory: storyStateListSchema,
  conditions: storyStateListSchema,
  threats: storyStateListSchema,
  notes: storyStateListSchema
});

export const storySceneAdvanceSchema = storyStateSchema.extend({
  previousSceneSummary: z.string().trim().max(2400).nullable().default(null),
  carryInventory: z.boolean().default(true)
});

const storyIntensitySchema = z.coerce.number().int().min(0).max(10);

export const storyDirectorSchema = z.object({
  tone: z.string().trim().max(160).nullable().default(null),
  pacing: z.enum(["SLOW", "BALANCED", "FAST"]).default("BALANCED"),
  initiative: z.enum(["REACTIVE", "BALANCED", "PROACTIVE"]).default("BALANCED"),
  conflictLevel: storyIntensitySchema.default(5),
  romanceLevel: storyIntensitySchema.default(3),
  mysteryLevel: storyIntensitySchema.default(5),
  humorLevel: storyIntensitySchema.default(3),
  allowOffscreenEvents: z.boolean().default(true),
  notes: z.string().trim().max(2000).nullable().default(null)
});

const narrativeBaseSchema = z.object({
  timelineId: z.string().trim().min(1).optional().nullable()
});

export const storyArcCreateSchema = narrativeBaseSchema.extend({
  kind: z.literal("arc"),
  title: z.string().trim().min(1).max(160),
  premise: z.string().trim().min(1).max(2400),
  priority: z.coerce.number().int().min(-10).max(10).default(0),
  targetBeatCount: z.coerce.number().int().min(1).max(100).optional().nullable()
});

export const storyBeatCreateSchema = narrativeBaseSchema.extend({
  kind: z.literal("beat"),
  arcId: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2400),
  status: z.enum(["PLANNED", "READY"]).default("PLANNED"),
  position: z.coerce.number().int().min(0).max(10000).default(0),
  priority: z.coerce.number().int().min(-10).max(10).default(0)
});

export const storyHookCreateSchema = narrativeBaseSchema.extend({
  kind: z.literal("hook"),
  arcId: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2400),
  payoff: z.string().trim().max(2400).optional().nullable(),
  urgency: storyIntensitySchema.default(0),
  directorOnly: z.boolean().default(false),
  dueSequence: z.coerce.number().int().min(0).max(1000000).optional().nullable()
});

export const storyRelationshipCreateSchema = narrativeBaseSchema.extend({
  kind: z.literal("relationship"),
  fromParticipantId: z.string().trim().min(1),
  toParticipantId: z.string().trim().min(1),
  label: z.string().trim().max(120).optional().nullable(),
  trust: z.coerce.number().int().min(-100).max(100).default(0),
  affection: z.coerce.number().int().min(-100).max(100).default(0),
  tension: z.coerce.number().int().min(-100).max(100).default(0),
  respect: z.coerce.number().int().min(-100).max(100).default(0),
  notes: z.string().trim().max(1600).optional().nullable()
});

export const storyEventCreateSchema = narrativeBaseSchema.extend({
  kind: z.literal("event"),
  actorParticipantId: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(160),
  instruction: z.string().trim().min(1).max(2400),
  channel: z.enum(["DIALOGUE", "ACTION", "THOUGHT", "WHISPER", "OOC", "SYSTEM"]).default("ACTION"),
  priority: z.coerce.number().int().min(-10).max(10).default(0),
  afterTurns: z.coerce.number().int().min(0).max(10000).default(0),
  triggerAt: z.coerce.date().optional().nullable()
});

export const storyNarrativeCreateSchema = z.discriminatedUnion("kind", [
  storyArcCreateSchema,
  storyBeatCreateSchema,
  storyHookCreateSchema,
  storyRelationshipCreateSchema,
  storyEventCreateSchema
]);

export const storyNarrativeUpdateSchema = z.object({
  kind: z.enum(["arc", "beat", "hook", "relationship", "event"]),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  premise: z.string().trim().min(1).max(2400).optional(),
  description: z.string().trim().min(1).max(2400).optional(),
  payoff: z.string().trim().max(2400).optional().nullable(),
  instruction: z.string().trim().min(1).max(2400).optional(),
  label: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1600).optional().nullable(),
  priority: z.coerce.number().int().min(-10).max(10).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  position: z.coerce.number().int().min(0).max(10000).optional(),
  urgency: storyIntensitySchema.optional(),
  trust: z.coerce.number().int().min(-100).max(100).optional(),
  affection: z.coerce.number().int().min(-100).max(100).optional(),
  tension: z.coerce.number().int().min(-100).max(100).optional(),
  respect: z.coerce.number().int().min(-100).max(100).optional(),
  arcStatus: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ABANDONED"]).optional(),
  beatStatus: z.enum(["PLANNED", "READY", "COMPLETED", "SKIPPED"]).optional(),
  hookStatus: z.enum(["OPEN", "ESCALATED", "RESOLVED", "DROPPED"]).optional(),
  eventStatus: z.enum(["SCHEDULED", "READY", "FIRED", "CANCELLED"]).optional(),
  directorOnly: z.boolean().optional()
});

export const storyParticipantStateSchema = z.object({
  kind: z.literal("participant_state"),
  timelineId: z.string().trim().min(1).optional().nullable(),
  participantId: z.string().trim().min(1),
  displayNameOverride: z.string().trim().max(120).optional().nullable(),
  pronouns: z.string().trim().max(80).optional().nullable(),
  currentMood: z.string().trim().max(160).optional().nullable(),
  appearance: z.string().trim().max(2400).optional().nullable(),
  currentGoal: z.string().trim().max(1600).optional().nullable(),
  innerConflict: z.string().trim().max(1600).optional().nullable(),
  voiceStyle: z.string().trim().max(160).optional().nullable(),
  speakingStyle: z.string().trim().max(1600).optional().nullable()
});

export const storyVoiceBindingSchema = z.object({
  kind: z.literal("voice"),
  participantId: z.string().trim().min(1),
  provider: z.enum(["elevenlabs", "playht"]),
  voiceId: z.string().trim().min(1).max(300),
  style: z.string().trim().max(160).optional().nullable(),
  speed: z.coerce.number().min(0.7).max(1.2).default(1),
  pitch: z.coerce.number().min(-1).max(1).default(0),
  autoPlay: z.boolean().default(false)
});

export const storySafetySchema = z.object({
  contentRating: z.enum(["GENERAL", "TEEN", "MATURE"]).default("MATURE"),
  hardLimits: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  softLimits: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  fadeToBlack: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  checkInInterval: z.coerce.number().int().min(0).max(100).default(0),
  paused: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional().nullable()
});

export const storyVisualReferenceSchema = z.object({
  kind: z.literal("visual"),
  timelineId: z.string().trim().min(1).optional().nullable(),
  participantId: z.string().trim().min(1).optional().nullable(),
  entityId: z.string().trim().min(1).optional().nullable(),
  visualKind: z.enum(["PORTRAIT", "OUTFIT", "LOCATION", "ITEM", "MOODBOARD", "OTHER"]),
  title: z.string().trim().min(1).max(160),
  imageUrl: z.string().trim().url().max(2048).optional().nullable(),
  prompt: z.string().trim().max(2400).optional().nullable(),
  notes: z.string().trim().max(1600).optional().nullable(),
  locked: z.boolean().default(false)
}).refine((input) => Boolean(input.imageUrl || input.prompt), {
  message: "A visual reference needs an image or prompt."
});

export const storyCheckpointSchema = z.object({
  kind: z.literal("checkpoint"),
  timelineId: z.string().trim().min(1).optional().nullable(),
  checkpointKind: z.enum(["MANUAL", "BOOKMARK"]).default("MANUAL"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(5000).optional().nullable(),
  openThreads: z.array(z.string().trim().min(1).max(300)).max(40).default([])
});

export const storyContinuityMutationSchema = z.union([
  storyParticipantStateSchema,
  storyVoiceBindingSchema,
  storyVisualReferenceSchema,
  storyCheckpointSchema
]);

export const roomCreateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  characterIds: z.array(z.string().trim().min(1)).min(2).max(6),
  model: z.string().trim().min(1).max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  responsePrompt: z.string().trim().optional().or(z.literal(""))
});

export const roomPatchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  responsePrompt: z.string().trim().optional().or(z.literal("")),
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
  storyId: z.string().trim().min(1).optional(),
  characterId: z.string().trim().min(1).optional(),
  format: z.enum(["mp3", "wav"]).default("mp3")
});
