"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Plus, Star, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type PersonaProfile = {
  id: string;
  label: string;
  displayName: string;
  avatarUrl?: string | null;
  summary: string;
  isDefault: boolean;
};

type PersonaSwitcherProps = {
  collapsed?: boolean;
};

export function PersonaSwitcher({ collapsed = false }: PersonaSwitcherProps) {
  const [profiles, setProfiles] = useState<PersonaProfile[]>([]);
  const [defaultProfileId, setDefaultProfileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultProfile = profiles.find((profile) => profile.id === defaultProfileId) ?? null;

  useEffect(() => {
    void loadPersonas();

    const onPersonaUpdated = () => void loadPersonas();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("nythera:persona-updated", onPersonaUpdated);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("nythera:persona-updated", onPersonaUpdated);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  async function loadPersonas() {
    const response = await fetch("/api/user-persona", { cache: "no-store" });
    if (!response.ok) {
      setProfiles([]);
      setDefaultProfileId(null);
      return;
    }

    const body = await response.json().catch(() => null);
    const nextProfiles = Array.isArray(body?.profiles) ? body.profiles.map(profileFromApi) : [];
    setProfiles(nextProfiles);
    setDefaultProfileId(body?.defaultProfileId ?? null);
  }

  async function switchPersona(profile: PersonaProfile) {
    setDefaultProfileId(profile.id);
    setOpen(false);
    const response = await fetch("/api/user-persona", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultProfileId: profile.id })
    });

    if (response.ok) {
      window.dispatchEvent(new CustomEvent("nythera:persona-updated"));
    } else {
      void loadPersonas();
    }
  }

  return (
    <div ref={rootRef} className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "focus-ring flex h-12 w-full items-center gap-3 rounded-2xl px-2 text-left text-[var(--text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)]",
          open && "bg-[var(--accent-purple-soft)] text-[var(--text-primary)]"
        )}
        title={defaultProfile ? `Default persona: ${defaultProfile.displayName}` : "Default persona"}
      >
        {defaultProfile ? (
          <Avatar name={defaultProfile.displayName} src={defaultProfile.avatarUrl} size="xs" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
            <UserRound className="h-4 w-4" />
          </span>
        )}
        <span className={cn("min-w-0 flex-1 md:hidden lg:block", collapsed && "lg:hidden")}>
          <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">Default persona</span>
          <span className="block truncate text-xs text-[var(--text-muted)]">{defaultProfile?.displayName ?? (profiles.length ? "Not selected" : "Create persona")}</span>
        </span>
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90", collapsed && "lg:hidden")} />
      </button>

      {open ? (
        <div className={cn("absolute left-0 right-0 top-14 z-50 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 md:hidden lg:block", collapsed && "lg:hidden")}>
          {profiles.length ? (
            <div className="max-h-72 overflow-y-auto chat-scroll">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => void switchPersona(profile)}
                  className="focus-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
                >
                  <Avatar name={profile.displayName} src={profile.avatarUrl} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[var(--text-primary)]">{profile.label || profile.displayName}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">{profile.summary || profile.displayName}</span>
                  </span>
                  {defaultProfileId === profile.id ? <Check className="h-4 w-4 text-[var(--accent-purple)]" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-sm leading-5 text-[var(--text-secondary)]">No persona yet.</p>
          )}
          <Link href="/settings/personas" onClick={() => setOpen(false)} className="nav-item mt-1 h-10">
            {profiles.length ? <Star className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Manage personas
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function profileFromApi(profile: Record<string, unknown>): PersonaProfile {
  return {
    id: String(profile.id ?? "default"),
    label: String(profile.label ?? profile.displayName ?? "Persona"),
    displayName: String(profile.displayName ?? "Persona"),
    avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
    summary: String(profile.summary ?? ""),
    isDefault: profile.isDefault === true
  };
}
