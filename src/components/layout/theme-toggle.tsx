"use client";

import { Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { saveStoredAppearance } from "@/components/providers/appearance-provider";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  function toggleTheme() {
    setTheme("dark");
    saveStoredAppearance({ theme: "dark" });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title="Dark theme"
      aria-label="Dark theme"
      onClick={toggleTheme}
    >
      <Moon className="h-4 w-4" />
    </Button>
  );
}
