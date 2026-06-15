"use client";

import { KeyboardEvent, useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model?: string;
  temperature?: number;
  onModelChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
};

export function ChatInput({ value, onChange, onSubmit, disabled = false, model, temperature, onModelChange, onTemperatureChange }: ChatInputProps) {
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

  return (
    <div className="relative z-20 shrink-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)] to-transparent px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:pb-5">
      {onModelChange || onTemperatureChange ? (
        <div className="mx-auto mb-2 grid max-w-[920px] gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
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
      <div className="mx-auto flex max-w-[920px] items-end gap-2 rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-2xl transition-colors duration-200 focus-within:border-[var(--accent-purple)]">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onInput={resize}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="max-h-[160px] min-h-8 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow)] transition-all duration-100 hover:brightness-110 active:scale-90 disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
