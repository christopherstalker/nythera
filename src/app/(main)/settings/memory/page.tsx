import { Brain } from "lucide-react";
import { MemorySettingsClient } from "@/components/settings/memory-settings-client";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SettingsPreferenceToggle } from "@/components/settings/settings-preference-toggle";

export default function MemorySettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={Brain} title="Memory & privacy" description="Decide whether chats may use saved memories, then review or remove the memories attached to your account." />
      <div className="grid gap-7">
        <SettingsPreferenceToggle preference="memoryEnabled" />
        <MemorySettingsClient />
      </div>
    </div>
  );
}
