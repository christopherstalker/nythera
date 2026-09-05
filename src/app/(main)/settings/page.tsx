"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [query, setQuery] = useState("");
  const matchingSections = SETTINGS_SECTIONS.filter((section) =>
    `${section.label} ${section.description}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <div>
      <header className="mb-7 border-b border-[var(--border-default)] pb-6 sm:mb-9 sm:pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--text-muted)]">
          Account control center
        </p>
        <h1 className="mt-3 font-editorial text-[clamp(2rem,4vw,3rem)] font-medium leading-none text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          Find the controls for your profile, conversations and privacy.
        </p>
      </header>

      <div className="mb-6">
        <SearchBar value={query} onChange={setQuery} placeholder="Find a setting: voice, API keys, memory…" />
      </div>
      {query ? (
        <p role="status" className="mb-4 text-xs text-[var(--text-muted)]">
          {matchingSections.length} {matchingSections.length === 1 ? "section" : "sections"} found
        </p>
      ) : null}

      <div className="grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2">
        {matchingSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="focus-ring group min-w-0 bg-[var(--bg-base)] p-5 no-underline transition-colors hover:bg-[color-mix(in_oklch,var(--codex-mint)_6%,var(--bg-base))] sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--border-default)] text-[var(--accent-violet)] group-hover:text-[var(--codex-mint)]">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--codex-mint)]" />
              </div>
              <h3 className="mt-5 font-editorial text-2xl font-medium text-[var(--text-primary)]">{section.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{section.description}</p>
            </Link>
          );
        })}
      </div>
      {!matchingSections.length ? (
        <div className="py-8 text-sm text-[var(--text-secondary)]">
          <p>No settings match your search.</p>
          <Button variant="ghost" onClick={() => setQuery("")}>
            Show all settings
          </Button>
        </div>
      ) : null}
    </div>
  );
}
