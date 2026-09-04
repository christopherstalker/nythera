export const OAUTH_PROVIDER_IDS = [
  "google",
  "discord",
  "twitter",
  "microsoft-entra-id",
  "apple"
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];
