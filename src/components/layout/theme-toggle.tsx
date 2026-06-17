"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { saveStoredAppearance } from "@/components/providers/appearance-provider";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    saveStoredAppearance({ theme: nextTheme });
  }

  const isDark = !mounted || resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title="Toggle theme"
      aria-label="Toggle theme"
      onClick={toggleTheme}
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
