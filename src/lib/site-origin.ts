export const CANONICAL_SITE_ORIGIN = "https://www.nythera.art";
export const FALLBACK_SITE_ORIGIN = "https://nythera-ai-character-platform.vercel.app";
const FALLBACK_SITE_HOST = new URL(FALLBACK_SITE_ORIGIN).hostname;

const PRODUCTION_SITE_ORIGINS = new Set([
  CANONICAL_SITE_ORIGIN,
  FALLBACK_SITE_ORIGIN
]);

function configuredSiteOrigin() {
  const configuredOrigin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;

  if (!configuredOrigin) {
    return null;
  }

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin() {
  if (process.env.VERCEL_ENV === "production") {
    const origin = configuredSiteOrigin();
    return origin && PRODUCTION_SITE_ORIGINS.has(origin)
      ? origin
      : CANONICAL_SITE_ORIGIN;
  }

  return configuredSiteOrigin() ?? CANONICAL_SITE_ORIGIN;
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

    if (!PRODUCTION_SITE_ORIGINS.has(origin)) {
      throw new Error(
        `${name} must use an approved production origin: ${[...PRODUCTION_SITE_ORIGINS].join(", ")}.`
      );
    }
  }

  if (
    authUrl &&
    nextAuthUrl &&
    new URL(authUrl).origin !== new URL(nextAuthUrl).origin
  ) {
    throw new Error("AUTH_URL and NEXTAUTH_URL must use the same production origin.");
  }
}

export function productionDeploymentRedirectUrl(
  requestUrl: string,
  forwardedHost: string | null,
  vercelEnvironment: string | undefined,
  productionOrigin = resolveSiteOrigin()
) {
  if (vercelEnvironment !== "production") {
    return null;
  }

  const requestHost = forwardedHost
    ?.split(",", 1)[0]
    ?.trim()
    .split(":", 1)[0]
    ?.toLowerCase();

  if (!requestHost?.endsWith(".vercel.app")) {
    return null;
  }

  const productionHost = new URL(productionOrigin).hostname;
  if (
    requestHost === productionHost ||
    (productionHost !== FALLBACK_SITE_HOST && requestHost === FALLBACK_SITE_HOST)
  ) {
    return null;
  }

  const destination = new URL(requestUrl);
  destination.protocol = "https:";
  destination.host = productionHost;
  return destination;
}
