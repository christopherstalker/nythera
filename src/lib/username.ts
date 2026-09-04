import { z } from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

const RESERVED_USERNAMES = new Set([
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "character",
  "characters",
  "chat",
  "chats",
  "create",
  "discover",
  "explore",
  "guide",
  "help",
  "home",
  "library",
  "login",
  "moderation",
  "new",
  "nythera",
  "profile",
  "register",
  "room",
  "rooms",
  "settings",
  "staff",
  "studio",
  "support",
  "system",
  "u"
]);

export function normalizeUsername(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function usernameValidationMessage(value: string) {
  const username = normalizeUsername(value);

  if (username.length < USERNAME_MIN_LENGTH) {
    return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Use no more than ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Use lowercase letters, numbers, and underscores only.";
  }
  if (username.startsWith("_") || username.endsWith("_")) {
    return "A username cannot start or end with an underscore.";
  }
  if (username.includes("__")) {
    return "Use a single underscore between words.";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "That username is reserved by Nythera.";
  }

  return null;
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .superRefine((username, context) => {
    const message = usernameValidationMessage(username);
    if (message) context.addIssue({ code: z.ZodIssueCode.custom, message });
  });
