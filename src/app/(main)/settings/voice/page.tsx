import { Mic2 } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { VoiceKeySettingsClient } from "@/components/settings/voice-key-settings-client";

export default function VoiceSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={Mic2} title="Voice" description="Manage text-to-speech providers separately from the models that write your chats." />
      <VoiceKeySettingsClient />
    </div>
  );
}
