export const CANONICAL_SITE_ORIGIN = "https://www.nythera.art";

export function resolveSiteOrigin() {
  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_SITE_ORIGIN;
  }

  const configuredOrigin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;

  if (!configuredOrigin) {
    return CANONICAL_SITE_ORIGIN;
  }

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

export function assertCanonicalAuthOrigin(
  environment: string | undefined,
  authUrl: string | undefined,
  nextAuthUrl: string | undefined
) {
  if (environment !== "production") {
    return;
  }

  const configuredOrigins = [
    ["AUTH_URL", authUrl],
    ["NEXTAUTH_URL", nextAuthUrl]
  ] as const;

  for (const [name, value] of configuredOrigins) {
    if (!value) {
      throw new Error(`${name} must be set to ${CANONICAL_SITE_ORIGIN} in production.`);
    }

    let origin: string;
    try {
      origin = new URL(value).origin;
    } catch {
      throw new Error(`${name} must be a valid URL.`);
    }

    if (origin !== CANONICAL_SITE_ORIGIN) {
      throw new Error(`${name} must use the canonical production origin ${CANONICAL_SITE_ORIGIN}.`);
    }
  }
}
