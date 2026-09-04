import { env } from "@/lib/env";
import {
  OAUTH_PROVIDER_IDS,
  type OAuthProviderId
} from "@/lib/oauth-provider-ids";

export { OAUTH_PROVIDER_IDS };
export type { OAuthProviderId };

export type OAuthProviderMeta = {
  id: OAuthProviderId;
  label: string;
  shortLabel: string;
  registerLabel: string;
  className: string;
};

export const OAUTH_PROVIDER_META: Record<OAuthProviderId, OAuthProviderMeta> = {
  google: {
    id: "google",
    label: "Continue with Google",
    shortLabel: "Google",
    registerLabel: "Summon with Google",
    className: "border-white/[0.08] bg-white/[0.04] hover:border-white/[0.16] hover:bg-white/[0.07]"
  },
  discord: {
    id: "discord",
    label: "Continue with Discord",
    shortLabel: "Discord",
    registerLabel: "Join via Discord",
    className: "border-[#5865F2]/30 bg-[#5865F2]/10 hover:border-[#5865F2]/45 hover:bg-[#5865F2]/16"
  },
  twitter: {
    id: "twitter",
    label: "Continue with X",
    shortLabel: "X",
    registerLabel: "Enter via X",
    className: "border-white/[0.1] bg-black/35 hover:border-white/[0.2] hover:bg-black/50"
  },
  "microsoft-entra-id": {
    id: "microsoft-entra-id",
    label: "Continue with Microsoft",
    shortLabel: "Microsoft",
    registerLabel: "Sign in with Microsoft",
    className: "border-[#0078D4]/25 bg-[#0078D4]/10 hover:border-[#0078D4]/40 hover:bg-[#0078D4]/16"
  },
  apple: {
    id: "apple",
    label: "Continue with Apple",
    shortLabel: "Apple",
    registerLabel: "Sign up with Apple",
    className: "border-white/[0.1] bg-white/[0.04] hover:border-white/[0.2] hover:bg-white/[0.08]"
  }
};

export function getEnabledOAuthProviders(): OAuthProviderId[] {
  const providers: OAuthProviderId[] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }
  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    providers.push("discord");
  }
  if (env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET) {
    providers.push("twitter");
  }
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    providers.push("microsoft-entra-id");
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    providers.push("apple");
  }

  return providers;
}
