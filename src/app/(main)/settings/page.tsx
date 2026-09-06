"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, SlidersHorizontal } from "lucide-react";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [query, setQuery] = useState("");
  const matchingSections = SETTINGS_SECTIONS.filter((section) =>
    `${section.label} ${section.description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const groups = ["Your identity", "Conversations", "Help"] as const;
  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">Settings</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Make Nythera work the way you like.</p>
      </header>
      <SearchBar value={query} onChange={setQuery} placeholder="Find a setting: voice, API keys, memory…" />
      {!query.trim() ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/settings/providers",
              icon: KeyRound,
              title: "Connect a model",
              text: "Manage API keys and choose your provider."
            },
            {
              href: "/settings/interface",
              icon: SlidersHorizontal,
              title: "Make reading comfortable",
              text: "Adjust message spacing and chat density."
            }
          ].map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="focus-ring flex items-center gap-4 rounded-2xl border border-[var(--codex-rule)] bg-[var(--bg-elevated)] p-5 no-underline hover:border-[var(--codex-mint)]"
            >
              <Icon className="h-5 w-5 shrink-0 text-[var(--codex-mint)]" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p role="status" className="text-xs text-[var(--text-muted)]">
          {matchingSections.length} {matchingSections.length === 1 ? "section" : "sections"} found
        </p>
      )}
      <div className="space-y-6">
        {groups.map((group) => {
          const groupSections = matchingSections.filter((section) => section.group === group);
          if (!groupSections.length) return null;
          return (
            <section key={group} aria-label={group}>
              <h2 className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">{group}</h2>
              <div className="divide-y divide-[var(--codex-rule)] overflow-hidden rounded-2xl border border-[var(--codex-rule)] bg-[var(--bg-elevated)]">
                {groupSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Link
                      key={section.href}
                      href={section.href}
                      className="focus-ring flex items-center gap-4 px-4 py-4 no-underline hover:bg-[var(--bg-input)] sm:px-5"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-input)] text-[var(--codex-mint)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{section.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
                          {section.description}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {!matchingSections.length ? (
        <div className="rounded-2xl border border-dashed border-[var(--codex-rule)] p-8 text-center text-sm">
          <p>No settings match your search.</p>
          <Button className="mt-3" variant="outline" onClick={() => setQuery("")}>
            Show all settings
          </Button>
        </div>
      ) : null}
    </div>
  );
}
