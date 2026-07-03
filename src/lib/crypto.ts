import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const MIN_PRODUCTION_SECRET_LENGTH = 32;

function getPrimarySecret() {
  const secret = env.API_KEY_ENCRYPTION_SECRET;
  if (secret) {
    assertStrongSecret("API_KEY_ENCRYPTION_SECRET", secret);
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing API_KEY_ENCRYPTION_SECRET for API key encryption.");
  }

  const legacySecret = env.NEXTAUTH_SECRET || env.AUTH_SECRET;
  if (legacySecret) {
    return legacySecret;
  }

  throw new Error("Missing API_KEY_ENCRYPTION_SECRET for API key encryption.");
}

function getDecryptionSecrets() {
  const secrets = [getPrimarySecret(), env.NEXTAUTH_SECRET, env.AUTH_SECRET].filter((secret): secret is string => Boolean(secret));
  return Array.from(new Set(secrets));
}

function assertStrongSecret(name: string, secret: string) {
  if (process.env.NODE_ENV === "production" && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(`${name} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production.`);
  }
}

function deriveKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(getPrimarySecret()), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(payload: string) {
  const [ivBase64, tagBase64, encryptedBase64] = payload.split(".");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted secret payload.");
  }

  let lastError: unknown = null;
  for (const secret of getDecryptionSecrets()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivBase64, "base64"));
      decipher.setAuthTag(Buffer.from(tagBase64, "base64"));

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedBase64, "base64")),
        decipher.final()
      ]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to decrypt secret payload.");
}
