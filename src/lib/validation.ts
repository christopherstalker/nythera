import { z } from "zod";

export const communicationStyleSchema = z.object({
  tone: z.string().max(80).optional(),
  humor: z.coerce.number().min(0).max(10).optional(),
  romanceLevel: z.coerce.number().min(0).max(10).optional(),
  seriousness: z.coerce.number().min(0).max(10).optional(),
  initiative: z.coerce.number().min(0).max(10).optional(),
  messageLength: z.enum(["short", "medium", "long"]).optional(),
  roleplayIntensity: z.coerce.number().min(0).max(10).optional()
});

export const characterCreateSchema = z.object({
  name: z.string().min(2).max(80),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().min(20).max(5000),
  personality: z.string().min(20).max(5000),
  scenario: z.string().max(5000).optional(),
  greeting: z.string().min(2).max(2000),
  communicationStyle: communicationStyleSchema.optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "UNLISTED"]).default("PRIVATE"),
  tags: z.array(z.string().min(1).max(32)).max(12).default([]),
  isNSFW: z.boolean().default(false)
});

export const characterUpdateSchema = characterCreateSchema.partial();

export const chatCreateSchema = z.object({
  characterId: z.string().min(1),
  title: z.string().max(120).optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  model: z.string().max(80).default("gpt-3.5-turbo")
});

export const chatUpdateSchema = z.object({
  title: z.string().max(120).optional(),
  archived: z.boolean().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().max(80).optional()
});

export const streamMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  temperature: z.coerce.number().min(0).max(2).optional(),
  model: z.string().max(80).optional()
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
