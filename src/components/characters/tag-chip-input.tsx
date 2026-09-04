"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Bookmark, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CharacterTagOption,
  displayTagLabel,
  MAX_CHARACTER_TAGS,
  mergeCharacterTagOptions,
  normalizeCharacterTag
} from "@/lib/character-tags";
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
  const [tagOptions, setTagOptions] = useState<CharacterTagOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetch("/api/tags", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("TAG_LIBRARY_UNAVAILABLE");
        }
        const body = await response.json().catch(() => null);
        return Array.isArray(body?.tags) ? body.tags : [];
      })
      .then((options: CharacterTagOption[]) => {
        if (active) {
          setTagOptions(options);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const availableOptions = useMemo(() => {
    const query = input.trim().toLocaleLowerCase();
    const selected = new Set(value.map(normalizeCharacterTag));
    const presetOptions: CharacterTagOption[] = presets.map((label) => ({
      slug: normalizeCharacterTag(label),
      label: displayTagLabel(label),
      source: "system"
    }));

    return mergeCharacterTagOptions(tagOptions, presetOptions)
      .filter((option) => !selected.has(option.slug))
      .filter((option) => !query || option.label.toLocaleLowerCase().includes(query) || option.slug.includes(query))
      .slice(0, query ? 10 : 18);
  }, [input, presets, tagOptions, value]);

  const savedOptions = availableOptions.filter((option) => option.source === "saved");
  const suggestedOptions = availableOptions.filter((option) => option.source !== "saved");

  function addTag(raw: string) {
    const candidates = raw
      .split(/[,\n]/)
      .map(normalizeCharacterTag)
      .filter(Boolean);
    if (!candidates.length) {
      return;
    }

    const existing = new Set(value.map(normalizeCharacterTag));
    const next = [...value];
    for (const candidate of candidates) {
      if (!existing.has(candidate) && next.length < MAX_CHARACTER_TAGS) {
        existing.add(candidate);
        next.push(candidate);
      }
    }

    if (next.length !== value.length) {
      onChange(next);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    const slug = normalizeCharacterTag(tag);
    onChange(value.filter((item) => normalizeCharacterTag(item) !== slug));
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
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Search or create a tag"
            className="codex-tag-search-input w-full"
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={() => addTag(input)} disabled={!input.trim() || value.length >= MAX_CHARACTER_TAGS}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {savedOptions.length ? (
        <TagOptionGroup label="Saved tags" icon={<Bookmark className="h-3.5 w-3.5" />} options={savedOptions} onSelect={addTag} />
      ) : null}

      {suggestedOptions.length ? (
        <TagOptionGroup label={input.trim() ? "Matching tags" : "Suggested"} options={suggestedOptions} onSelect={addTag} />
      ) : null}

      {input.trim() && availableOptions.every((option) => option.slug !== normalizeCharacterTag(input)) ? (
        <p className="text-xs text-[var(--text-muted)]">
          Press Enter to create <span className="font-medium text-[var(--text-secondary)]">{displayTagLabel(input)}</span>. It will be saved after the character is created.
        </p>
      ) : null}

      <p className="text-[11px] text-[var(--text-muted)]">{value.length}/{MAX_CHARACTER_TAGS} tags</p>
    </div>
  );
}

function TagOptionGroup({
  label,
  icon,
  options,
  onSelect
}: {
  label: string;
  icon?: React.ReactNode;
  options: CharacterTagOption[];
  onSelect: (tag: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">
        {icon}
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.slug}
            type="button"
            onClick={() => onSelect(option.slug)}
            className="focus-ring rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[rgb(var(--accent-rgb)_/_0.35)] hover:text-[var(--text-primary)]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
