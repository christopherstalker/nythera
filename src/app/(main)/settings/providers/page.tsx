import { KeyRound } from "lucide-react";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { normalizeCallbackPath } from "@/lib/auth-routes";

export default async function ProviderSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ onboarding?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = normalizeCallbackPath(params.callbackUrl, "/explore");
  return (
    <div>
      <SettingsPageHeader icon={KeyRound} title="Model providers" description="Connect model APIs, configure OpenRouter or custom endpoints, and choose a fallback order." />
      <KeySettingsClient onboarding={params.onboarding === "1"} callbackUrl={callbackUrl} />
    </div>
  );
}
