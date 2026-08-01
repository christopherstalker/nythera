import { KeyRound } from "lucide-react";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";

export default function ProviderSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={KeyRound} title="Model providers" description="Connect model APIs, configure OpenRouter or custom endpoints, and choose a fallback order." />
      <KeySettingsClient />
    </div>
  );
}
