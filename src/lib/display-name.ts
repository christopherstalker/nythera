import { z } from "zod";

export const DISPLAY_NAME_MAX_LENGTH = 60;

export const displayNameSchema = z
  .string()
  .refine((name) => !/[\p{Cc}\p{Zl}\p{Zp}\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/u.test(name), {
    message: "Display name must be a single line without hidden control characters."
  })
  .transform((name) => name.trim())
  .pipe(z.string().max(DISPLAY_NAME_MAX_LENGTH, "Display name must be 60 characters or fewer."))
  .transform((name) => name || null)
  .nullable();

export function userDisplayName(user: { name?: string | null; username?: string | null }) {
  return user.name?.trim() || user.username || "Traveler";
}
