"use client";

import { useEffect, useState } from "react";
import { Bell, Brain, Eye, KeyRound, Paintbrush, UserCog, UserRound } from "lucide-react";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { MemorySettingsClient } from "@/components/settings/memory-settings-client";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { UserPersonaSettingsClient } from "@/components/settings/user-persona-settings-client";
import { PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

const sections = [
  { id: "account", label: "Account", icon: UserCog },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "api-keys", label: "API Keys", icon: KeyRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "notifications", label: "Notifications", icon: Bell }
];

export default function SettingsPage() {
  const [compactMode, setCompactMode] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.profile) {
          return;
        }
        setCompactMode(Boolean(body.profile.compactMode));
        setMemoryEnabled(body.profile.memoryEnabled !== false);
        setNotificationsEnabled(Boolean(body.profile.notificationsEnabled));
      })
      .catch(() => undefined);
  }, []);

  async function savePreference(next: Partial<{ compactMode: boolean; memoryEnabled: boolean; notificationsEnabled: boolean }>) {
    if (next.compactMode !== undefined) {
      setCompactMode(next.compactMode);
    }
    if (next.memoryEnabled !== undefined) {
      setMemoryEnabled(next.memoryEnabled);
    }
    if (next.notificationsEnabled !== undefined) {
      setNotificationsEnabled(next.notificationsEnabled);
    }

    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next)
    });
  }

  return (
    <PageShell>
      <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="scrollbar-none flex gap-2 overflow-x-auto lg:grid" aria-label="Settings sections">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="focus-ring flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--text-secondary)] no-underline transition-colors duration-150 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="grid gap-5">
          <SettingsCard id="account" icon={UserCog} title="Account">
            <ProfileSettingsClient />
          </SettingsCard>

          <SettingsCard id="appearance" icon={Paintbrush} title="Appearance">
            <div className="grid gap-4">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
                <div className="mt-3 inline-flex rounded-[var(--radius-pill)] bg-[var(--bg-elevated)] p-1">
                  <button type="button" className="h-9 rounded-[var(--radius-pill)] bg-[var(--accent-purple)] px-4 text-sm font-medium text-white">
                    Dark
                  </button>
                </div>
              </div>
              <SwitchRow icon={Eye} label="Compact chat density" enabled={compactMode} onToggle={() => savePreference({ compactMode: !compactMode })} />
            </div>
          </SettingsCard>

          <SettingsCard id="persona" icon={UserRound} title="User Persona">
            <UserPersonaSettingsClient />
          </SettingsCard>

          <SettingsCard id="api-keys" icon={KeyRound} title="API Keys">
            <KeySettingsClient />
          </SettingsCard>

          <SettingsCard id="memory" icon={Brain} title="Memory">
            <div className="grid gap-4">
              <SwitchRow icon={Brain} label="Use saved memories in character chats" enabled={memoryEnabled} onToggle={() => savePreference({ memoryEnabled: !memoryEnabled })} />
              <MemorySettingsClient />
            </div>
          </SettingsCard>

          <SettingsCard id="notifications" icon={Bell} title="Notifications">
            <SwitchRow icon={Bell} label="Conversation and account notifications" enabled={notificationsEnabled} onToggle={() => savePreference({ notificationsEnabled: !notificationsEnabled })} />
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
    <section id={id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
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
  icon: typeof Bell;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
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
          enabled ? "bg-[var(--accent-purple)]" : "bg-[var(--bg-elevated)]"
        )}
      >
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] duration-150", enabled ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
