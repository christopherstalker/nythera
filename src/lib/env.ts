import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  INTERNAL_API_TOKEN: z.string().optional(),
  LLM_PROXY_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional()
});

export const env = envSchema.parse(process.env);

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
