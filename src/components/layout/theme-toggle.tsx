"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAppearanceTheme } from "@/components/providers/appearance-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { activeTheme, updateTheme } = useAppearanceTheme();

  function toggleTheme() {
    updateTheme(activeTheme === "light" ? "dark" : "light");
  }

  const isLight = activeTheme === "light";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={isLight ? "Use dark theme" : "Use light theme"}
      aria-label={isLight ? "Use dark theme" : "Use light theme"}
      onClick={toggleTheme}
      className={cn("text-[var(--text-muted)] hover:text-[var(--codex-ivory)]", className)}
    >
      {isLight ? <Moon size={20} weight="thin" /> : <Sun size={20} weight="thin" />}
    </Button>
  );
}
