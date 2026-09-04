import { HttpError } from "@/lib/api";

export const ADULT_CONSENT_VERSION = "2026-08-06";

export function requireAdultConsent(user: { adultTermsAcceptedAt?: Date | null }) {
  if (!user.adultTermsAcceptedAt) {
    throw new HttpError(403, "Adult consent is required before starting or continuing a chat.");
  }
}
