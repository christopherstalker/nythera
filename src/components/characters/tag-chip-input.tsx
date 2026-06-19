"use client";

import { KeyboardEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayTagLabel } from "@/lib/character-tags";
import { cn } from "@/lib/utils";

type TagChipInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  presets?: readonly string[];
  placeholder?: string;
  className?: string;
};

export function TagChipInput({
  value,
  onChange,
  presets = [],
  placeholder = "Add a tag and press Enter",
  className
}: TagChipInputProps) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const next = raw.trim();
    if (!next) {
      return;
    }

    const exists = value.some((tag) => tag.toLowerCase() === next.toLowerCase());
    if (exists || value.length >= 12) {
      setInput("");
      return;
    }

    onChange([...value, next]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input);
    }
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => removeTag(tag)}
            className="focus-ring group inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-red-400/40 hover:text-red-100"
          >
            <Badge className="pointer-events-none">{displayTagLabel(tag)}</Badge>
            <X className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => addTag(input)} disabled={!input.trim() || value.length >= 12}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = value.some((tag) => tag.toLowerCase() === preset.toLowerCase());
            return (
              <button
                key={preset}
                type="button"
                onClick={() => (active ? removeTag(preset) : addTag(preset))}
                className={cn(
                  "focus-ring rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-[rgb(var(--accent-rgb)_/_0.45)] bg-[var(--accent-purple-soft)] text-[var(--text-primary)]"
                    : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[rgb(var(--accent-rgb)_/_0.35)] hover:text-[var(--text-primary)]"
                )}
              >
                {preset}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}