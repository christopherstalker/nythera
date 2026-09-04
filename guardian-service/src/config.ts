import { z } from "zod";

const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  LOG_LEVEL: z.string().default("info"),
  GUARDIAN_TARGET_URL: z.string().url(),
  GUARDIAN_SHARED_SECRET: z.string().min(32),
  GUARDIAN_API_TOKEN: z.string().min(32),
  GUARDIAN_INTERVAL_MS: z.coerce.number().int().min(60_000).default(120_000),
  GUARDIAN_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(60_000).default(45_000),
  GUARDIAN_SLOW_RESPONSE_MS: z.coerce.number().int().min(1_000).default(12_000),
  GUARDIAN_ALERT_WEBHOOK_URL: optionalUrl,
  GUARDIAN_TELEGRAM_BOT_TOKEN: optionalString,
  GUARDIAN_TELEGRAM_CHAT_ID: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString
}).superRefine((config, context) => {
  if (Boolean(config.UPSTASH_REDIS_REST_URL) !== Boolean(config.UPSTASH_REDIS_REST_TOKEN)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Both Upstash Redis variables must be configured together." });
  }
  if (Boolean(config.GUARDIAN_TELEGRAM_BOT_TOKEN) !== Boolean(config.GUARDIAN_TELEGRAM_CHAT_ID)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Both Telegram variables must be configured together." });
  }
});

export type GuardianConfig = z.infer<typeof configSchema>;

export function loadGuardianConfig(environment: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(environment);
}
