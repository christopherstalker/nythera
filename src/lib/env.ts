import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  AUTH_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  API_KEY_ENCRYPTION_SECRET: z.string().optional(),
  MOBILE_AUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  INTERNAL_API_TOKEN: z.string().optional(),
  AI_SHIELD_SIGNING_SECRET: z.string().min(32).optional(),
  LLM_PROXY_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_BYPASS_USER_IDS: z.string().optional(),
  RATE_LIMIT_REQUIRE_DISTRIBUTED: z.enum(["true", "false", ""]).optional(),
  BYOK_ALLOW_PRIVATE_TEST_ENDPOINTS: z.enum(["true", "false", ""]).optional(),
  SENTRY_DSN: z.string().optional(),
  GUARDIAN_SHARED_SECRET: z.string().optional(),
  GUARDIAN_CANARY_USER_ID: z.string().optional(),
  GUARDIAN_CANARY_MODEL: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_ALLOWED_HOSTNAMES: z.string().optional()
});

export const env = envSchema.parse(process.env);

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
