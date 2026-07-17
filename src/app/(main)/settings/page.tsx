"use client";

import { useEffect, useState } from "react";
import { Brain, Eye, KeyRound, Paintbrush, Shield, UserCog, UserRound } from "lucide-react";
import { AppearanceSettingsClient } from "@/components/settings/appearance-settings-client";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { MemorySettingsClient } from "@/components/settings/memory-settings-client";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { UserPersonaSettingsClient } from "@/components/settings/user-persona-settings-client";
import { VoiceKeySettingsClient } from "@/components/settings/voice-key-settings-client";
import { PageHeader, PageShell } from "@/components/ui/page";
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
    <PageShell className="codex-settings space-y-10">
      <PageHeader icon={UserCog} title="Settings" description="The controls behind your voice, memory, appearance, and connected models." />
      <div className="grid min-w-0 border-y border-[var(--border-default)] lg:grid-cols-[240px_minmax(0,760px)] lg:justify-start">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <nav className="settings-orbital-nav scrollbar-none flex w-full max-w-full overflow-x-auto border-b border-[var(--border-default)] lg:grid lg:border-b-0 lg:border-r" aria-label="Settings sections">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="focus-ring flex h-12 shrink-0 items-center gap-2 border-r border-[var(--border-default)] px-4 text-xs font-medium uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--accent-mint)] lg:border-b lg:border-r-0"
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="grid min-w-0 lg:pl-10">
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
    <section id={id} className="settings-orbital-section min-w-0 border-b border-[var(--border-default)] py-8 sm:py-10">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center border border-[var(--border-default)] text-[var(--accent-violet)]">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-editorial text-3xl font-medium text-[var(--text-primary)]">{title}</h2>
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
    <div className="flex items-center justify-between gap-4 border-y border-[var(--border-default)] py-4">
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
