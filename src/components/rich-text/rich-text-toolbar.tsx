"use client";

import Link from "next/link";
import type { RefObject } from "react";
import {
  Bold,
  BookOpen,
  Highlighter,
  Italic,
  MessageSquareQuote,
  Parentheses,
  Strikethrough,
  Underline
} from "lucide-react";
import { applyRichTextFormat, RICH_TEXT_FORMATS, type RichTextFormat } from "@/lib/rich-text-formatting";
import { cn } from "@/lib/utils";

type RichTextToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
};

const ICONS = {
  bold: Bold,
  italic: Italic,
  boldItalic: Bold,
  underline: Underline,
  strike: Strikethrough,
  highlight: Highlighter,
  subtext: Parentheses,
  quote: MessageSquareQuote
} satisfies Record<RichTextFormat, typeof Bold>;

export function RichTextToolbar({ textareaRef, value, onChange, className, compact = false }: RichTextToolbarProps) {
  function apply(format: RichTextFormat) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const result = applyRichTextFormat(value, textarea.selectionStart, textarea.selectionEnd, format);
    onChange(result.value);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-x-auto pb-1 text-[var(--text-muted)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="toolbar"
      aria-label="Text formatting"
    >
      {RICH_TEXT_FORMATS.map((format) => {
        const Icon = ICONS[format.id];
        return (
          <button
            key={format.id}
            type="button"
            aria-label={format.label}
            title={`${format.label}${"shortcut" in format ? ` · ${format.shortcut}` : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(format.id)}
            className={cn(
              "focus-ring grid shrink-0 place-items-center rounded-full border border-transparent text-[var(--text-secondary)] transition hover:border-[var(--border-subtle)] hover:bg-[var(--color-overlay)] hover:text-[var(--text-primary)]",
              compact ? "h-8 w-8" : "h-9 w-9"
            )}
          >
            <Icon className={cn("h-4 w-4", format.id === "boldItalic" && "italic")} strokeWidth={format.id === "boldItalic" ? 2.7 : 2} />
          </button>
        );
      })}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--border-subtle)]" aria-hidden />
      <Link
        href="/guide/roleplay-formatting"
        aria-label="Open roleplay formatting guide"
        title="Formatting guide"
        className={cn(
          "focus-ring grid shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] text-[var(--codex-mint)] no-underline transition hover:bg-[var(--color-overlay)]",
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        <BookOpen className="h-4 w-4" />
      </Link>
    </div>
  );
}
