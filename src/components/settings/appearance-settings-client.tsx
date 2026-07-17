"use client";

import { useEffect, useState } from "react";
import { Moon, Palette, Sun } from "lucide-react";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_COLOR,
  applyAccentColor,
  readStoredAppearance,
  saveStoredAppearance,
  useAppearanceTheme
} from "@/components/providers/appearance-provider";
import { cn } from "@/lib/utils";

export function AppearanceSettingsClient() {
  const { activeTheme, updateTheme: setAppearanceTheme } = useAppearanceTheme();
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);

  useEffect(() => {
    const storedAccent = readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR;
    setAccentColor(storedAccent);
    applyAccentColor(storedAccent);
  }, []);

  function updateAccent(nextColor: string) {
    setAccentColor(nextColor);
    applyAccentColor(nextColor);
    saveStoredAppearance({ accentColor: nextColor });
  }

  function updateTheme(nextTheme: "dark" | "light") {
    setAppearanceTheme(nextTheme);
  }

  return (
    <div className="grid gap-4">
      <div className="border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Choose ink-dark or archival paper.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["dark", "light"] as const).map((theme) => {
            const Icon = theme === "dark" ? Moon : Sun;
            const selected = activeTheme === theme;
            return (
              <button
                key={theme}
                type="button"
                aria-pressed={selected}
                onClick={() => updateTheme(theme)}
                className={cn(
                  "focus-ring flex min-h-12 items-center gap-3 border px-4 text-left text-sm capitalize transition-colors",
                  selected
                    ? "border-[var(--codex-mint)] bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--text-primary)]"
                    : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {theme}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Accent color</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{accentColor.toUpperCase()}</p>
          </div>
          <label className="focus-ring relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-[var(--border-default)] shadow-[var(--shadow-card)]" style={{ backgroundColor: accentColor }}>
            <Palette className="h-4 w-4 text-white drop-shadow" />
            <input
              type="color"
              aria-label="Choose accent color"
              value={accentColor}
              onChange={(event) => updateAccent(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color} accent`}
              title={color.toUpperCase()}
              onClick={() => updateAccent(color)}
              className={cn(
                "focus-ring h-9 w-9 rounded-full border transition-transform active:scale-95",
                accentColor.toLowerCase() === color.toLowerCase() ? "border-[var(--text-primary)] ring-2 ring-[var(--accent-purple)]" : "border-[var(--border-default)]"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
