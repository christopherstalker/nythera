import { UserRound } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { UserPersonaSettingsClient } from "@/components/settings/user-persona-settings-client";

export default function PersonaSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={UserRound} title="Personas" description="Create distinct roleplay identities and choose which one characters see in chat." />
      <UserPersonaSettingsClient />
    </div>
  );
}
