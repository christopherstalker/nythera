"use client";

import { useRef } from "react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { RichTextToolbar } from "@/components/rich-text/rich-text-toolbar";
import { Textarea } from "@/components/ui/textarea";
import { applyRichTextFormat, richTextFormatFromShortcut } from "@/lib/rich-text-formatting";
import { cn } from "@/lib/utils";

type FormattedTextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  previewLabel?: string;
};

export function FormattedTextarea({ value, onChange, previewLabel = "Rendered preview", className, ...props }: FormattedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const format = richTextFormatFromShortcut(event.key, event.ctrlKey || event.metaKey);
    if (!format) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const result = applyRichTextFormat(value, textarea.selectionStart, textarea.selectionEnd, format);
    onChange(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--bg-input)] focus-within:border-[var(--accent-purple)]">
      <RichTextToolbar textareaRef={textareaRef} value={value} onChange={onChange} compact className="border-b border-[var(--border-subtle)] px-2 py-1.5" />
      <Textarea
        ref={textareaRef}
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn("rounded-none border-0 bg-transparent focus:border-transparent", className)}
      />
      {value.trim() ? (
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--text-muted)]">{previewLabel}</p>
          <RichMessageText text={value} className="line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]" />
        </div>
      ) : null}
    </div>
  );
}
