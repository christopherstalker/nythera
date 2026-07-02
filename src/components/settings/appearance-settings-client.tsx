"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_COLOR,
  applyAccentColor,
  readStoredAppearance,
  saveStoredAppearance
} from "@/components/providers/appearance-provider";
import { cn } from "@/lib/utils";

export function AppearanceSettingsClient() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);

  useEffect(() => {
    setMounted(true);
    const storedAccent = readStoredAppearance().accentColor || DEFAULT_ACCENT_COLOR;
    setAccentColor(storedAccent);
    applyAccentColor(storedAccent);
    setTheme("dark");
  }, [setTheme]);

  function updateAccent(nextColor: string) {
    setAccentColor(nextColor);
    applyAccentColor(nextColor);
    saveStoredAppearance({ accentColor: nextColor });
  }

  const activeTheme = mounted ? resolvedTheme : "dark";

  return (
    <div className="grid gap-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{activeTheme === "dark" ? "Dark" : "Dark"}</p>
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
