"use client";

import { useEffect, useState } from "react";
import { Brain, Eye, KeyRound, Paintbrush, Shield, UserCog, UserRound } from "lucide-react";
import { AppearanceSettingsClient } from "@/components/settings/appearance-settings-client";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { MemorySettingsClient } from "@/components/settings/memory-settings-client";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { UserPersonaSettingsClient } from "@/components/settings/user-persona-settings-client";
import { VoiceKeySettingsClient } from "@/components/settings/voice-key-settings-client";
import { PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

const sections = [
  { id: "api-keys", label: "API Keys", icon: KeyRound },
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "privacy", label: "Privacy", icon: Shield }
];

export default function SettingsPage() {
  const [compactMode, setCompactMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = await response.json();
        if (!body?.profile) return;

        setCompactMode(Boolean(body.profile.compactMode));
        setMemoryEnabled(body.profile.memoryEnabled !== false);
      } catch {}
    }

    void loadPreferences();
  }, []);

  async function savePreference(next: Partial<{ compactMode: boolean; memoryEnabled: boolean }>) {
    if (next.compactMode !== undefined) {
      setCompactMode(next.compactMode);
    }
    if (next.memoryEnabled !== undefined) {
      setMemoryEnabled(next.memoryEnabled);
    }
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next)
    });
  }

  return (
    <PageShell>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,720px)] lg:justify-start">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <nav className="scrollbar-none flex w-full max-w-full gap-2 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 lg:grid" aria-label="Settings sections">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="focus-ring flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-medium text-[var(--text-secondary)] no-underline transition-colors duration-150 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="grid min-w-0 gap-5">
          <SettingsCard id="api-keys" icon={KeyRound} title="API Keys">
            <div className="grid gap-4">
              <KeySettingsClient />
              <VoiceKeySettingsClient />
            </div>
          </SettingsCard>

          <SettingsCard id="persona" icon={UserRound} title="Persona">
            <UserPersonaSettingsClient />
          </SettingsCard>

          <SettingsCard id="appearance" icon={Paintbrush} title="Appearance">
            <div className="grid gap-4">
              <AppearanceSettingsClient />
              <SwitchRow icon={Eye} label="Compact chat density" enabled={compactMode} onToggle={() => savePreference({ compactMode: !compactMode })} />
            </div>
          </SettingsCard>

          <SettingsCard id="privacy" icon={Shield} title="Privacy">
            <div className="grid gap-4">
              <ProfileSettingsClient />
              <SwitchRow icon={Brain} label="Use saved memories in character chats" enabled={memoryEnabled} onToggle={() => savePreference({ memoryEnabled: !memoryEnabled })} />
              <MemorySettingsClient />
            </div>
          </SettingsCard>
        </div>
      </div>
    </PageShell>
  );
}

function SettingsCard({
  id,
  icon: Icon,
  title,
  children
}: {
  id: string;
  icon: typeof UserCog;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  icon: Icon,
  label,
  enabled,
  onToggle
}: {
  icon: typeof Brain;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          "focus-ring relative h-7 w-12 shrink-0 rounded-[var(--radius-pill)] transition-colors duration-150 active:scale-95",
          enabled ? "bg-primary" : "bg-[var(--bg-elevated)]"
        )}
      >
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] duration-150", enabled ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
