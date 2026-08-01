import { UserCog } from "lucide-react";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";

export default function AccountSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={UserCog} title="Account" description="Update the identity attached to your Nythera account and control age-gated access." />
      <ProfileSettingsClient />
    </div>
  );
}
