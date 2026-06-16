"use client";

import { KeyboardEvent, useEffect, useRef } from "react";
import { ArrowUp, ChevronsRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model?: string;
  temperature?: number;
  onModelChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
  onOpenComposer?: () => void;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  model,
  temperature,
  onModelChange,
  onTemperatureChange,
  personaName,
  personaAvatarUrl,
  onOpenComposer
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    resize();
  }, [value]);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  const canSend = !disabled && Boolean(value.trim());

  return (
    <div className="relative z-20 shrink-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)] to-transparent px-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:pb-5">
      {onModelChange || onTemperatureChange ? (
        <div className="mx-auto mb-2 hidden max-w-[var(--chat-max-width)] gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_220px]">
          {onModelChange ? (
            <input
              value={model ?? ""}
              onChange={(event) => onModelChange(event.target.value)}
              placeholder="provider:model"
              className="focus-ring glass-input h-10 rounded-[var(--radius-md)] px-3 text-xs focus:border-[var(--accent-purple)]"
            />
          ) : null}
          {onTemperatureChange ? (
            <label className="glass-input flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-3 text-xs text-[var(--text-secondary)]">
              temp
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature ?? 0.8}
                onChange={(event) => onTemperatureChange(Number(event.target.value))}
                className="min-w-0 flex-1 accent-[var(--accent-purple)]"
              />
              <span className="w-8 text-right">{(temperature ?? 0.8).toFixed(1)}</span>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="nythera-chat-column flex items-end gap-2">
        <div className="composer-glass flex min-w-0 flex-1 items-end gap-2 rounded-[28px] border border-[var(--border-default)] px-2 py-2 backdrop-blur-2xl transition-colors duration-200 focus-within:border-[var(--accent-purple)] sm:rounded-[26px] sm:px-3 sm:py-2.5">
          {onOpenComposer ? (
            <button
              type="button"
              aria-label="Open memory, history, and persona"
              onClick={onOpenComposer}
              className="focus-ring mb-0.5 ml-0.5 grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-[var(--bg-elevated)] text-[var(--accent-purple)] transition hover:border-[rgb(var(--accent-rgb)_/_0.45)] active:scale-95 md:hidden"
            >
              <Avatar name={personaName ?? "You"} src={personaAvatarUrl} size="xs" className="h-9 w-9 border-0 bg-transparent" />
            </button>
          ) : null}
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onInput={resize}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="max-h-[132px] min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-1 text-base leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] sm:max-h-[160px] sm:px-0 sm:text-sm"
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-all duration-100 hover:bg-white/[0.06] active:scale-90 disabled:opacity-35 md:hidden"
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring mb-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[var(--brand-secondary)] via-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow)] transition-all duration-100 hover:brightness-110 active:scale-90 disabled:opacity-40 md:flex"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
