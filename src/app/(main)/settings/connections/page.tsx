import { Link2 } from "lucide-react";
import { IntegrationSettingsClient } from "@/components/settings/integration-settings-client";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";

export default function ConnectionSettingsPage() {
  return (
    <div>
      <SettingsPageHeader
        icon={Link2}
        title="AI connections"
        description="Bring your characters to life from the AI tools you already use."
      />
      <IntegrationSettingsClient />
    </div>
  );
}
