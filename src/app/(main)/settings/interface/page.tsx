import { Eye } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SettingsPreferenceToggle } from "@/components/settings/settings-preference-toggle";

export default function InterfaceSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={Eye} title="Interface" description="Keep Nythera comfortable to read without mixing visual controls into account or provider settings." />
      <div className="grid gap-6">
        <div className="border-y border-[var(--border-default)] py-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">Living Codex theme</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Nythera uses one permanent ink-dark theme and a fixed editorial palette.</p>
        </div>
        <SettingsPreferenceToggle preference="compactMode" />
      </div>
    </div>
  );
}
