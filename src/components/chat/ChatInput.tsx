"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronsRight, SlidersHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { RESPONSE_PROMPT_EXAMPLES } from "@/lib/response-prompt";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model?: string;
  temperature?: number;
  onModelChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
  responsePrompt?: string;
  onResponsePromptChange?: (value: string) => void;
  apiStatus?: string | null;
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
  responsePrompt,
  onResponsePromptChange,
  apiStatus,
  personaName,
  personaAvatarUrl,
  onOpenComposer
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [apiOpen, setApiOpen] = useState(false);

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
  const hasApiControls = Boolean(onModelChange || onTemperatureChange || onResponsePromptChange);
  const currentTemperature = temperature ?? 0.7;

  return (
    <div className="relative z-20 shrink-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)] to-transparent px-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:pb-5">
      {hasApiControls && apiOpen ? (
        <div className="mx-auto mb-2 grid max-w-[var(--chat-max-width)] gap-2 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-[var(--glass-highlight)] backdrop-blur-2xl sm:grid-cols-[minmax(0,1fr)_minmax(220px,300px)]">
          {onModelChange ? (
            <label className="grid gap-1">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Model</span>
              <input
                value={model ?? ""}
                onChange={(event) => onModelChange(event.target.value)}
                placeholder="provider:model"
                className="focus-ring glass-input h-10 rounded-[var(--radius-md)] px-3 text-xs focus:border-[var(--accent-purple)]"
              />
            </label>
          ) : null}
          {onTemperatureChange ? (
            <label className="grid gap-1">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Temperature</span>
              <span className="glass-input flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-3 text-xs text-[var(--text-secondary)]">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={currentTemperature}
                  onChange={(event) => onTemperatureChange(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-[var(--accent-purple)]"
                />
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={currentTemperature.toFixed(1)}
                  onChange={(event) => onTemperatureChange(Math.min(2, Math.max(0, Number(event.target.value) || 0)))}
                  className="w-14 rounded-lg border border-[var(--border-default)] bg-transparent px-1.5 py-1 text-right text-[var(--text-primary)] outline-none"
                />
              </span>
            </label>
          ) : null}
          {onResponsePromptChange ? (
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="flex items-center justify-between gap-3 px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">
                <span>Response instructions</span>
                <span>{(responsePrompt ?? "").length}/2000</span>
              </span>
              <textarea
                value={responsePrompt ?? ""}
                onChange={(event) => onResponsePromptChange(event.target.value.slice(0, 2000))}
                placeholder="Example: Write 2–4 immersive paragraphs, lead with dialogue, and never narrate my actions."
                rows={3}
                className="focus-ring glass-input min-h-20 resize-y rounded-[var(--radius-md)] px-3 py-2 text-xs leading-5 focus:border-[var(--accent-purple)]"
              />
              <p className="px-1 text-xs leading-5 text-[var(--text-muted)]">
                Tip: specify reply length, point of view, pacing, dialogue/action balance, or formatting. Character and safety rules always stay in control.
              </p>
              <span className="flex flex-wrap gap-1.5 px-1">
                {RESPONSE_PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => onResponsePromptChange(example.prompt)}
                    className="focus-ring rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    {example.label}
                  </button>
                ))}
              </span>
            </label>
          ) : null}
          {apiStatus ? <p className="px-1 text-xs text-[var(--text-muted)] sm:col-span-2">{apiStatus}</p> : null}
        </div>
      ) : null}
      <div className="nythera-chat-column composer-dock relative flex items-end gap-2 rounded-[30px] border border-white/[.12] p-2 shadow-[var(--shadow-card),var(--shadow-glow-soft)] backdrop-blur-2xl transition-colors duration-200 focus-within:border-[rgb(var(--accent-rgb)_/.58)] sm:p-2.5">
        <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" />
        <div className="relative flex min-w-0 flex-1 items-end gap-2 rounded-[22px] border border-white/[.09] bg-black/[.12] px-2 py-2 sm:px-3 sm:py-2.5">
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
            placeholder="Message character..."
            className="max-h-[132px] min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-1 text-base leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] sm:max-h-[160px] sm:px-0 sm:text-sm"
            disabled={disabled}
          />
          {hasApiControls ? (
            <button
              type="button"
              aria-label="API settings"
              title="API settings"
              onClick={() => setApiOpen((current) => !current)}
              className="focus-ring mb-0.5 flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-[var(--bg-elevated)] px-2.5 text-[var(--text-secondary)] transition hover:border-[rgb(var(--accent-rgb)_/_0.45)] hover:text-[var(--text-primary)] active:scale-95"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden max-w-28 truncate text-[11px] sm:block">{model || "Model"}</span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring relative mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--gradient-aurora-primary)] text-[color:oklch(var(--color-on-accent))] shadow-[var(--shadow-glow)] transition-all duration-100 hover:brightness-110 active:scale-90 disabled:opacity-35 md:hidden"
        >
          <ChevronsRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring relative mb-0.5 hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[var(--gradient-aurora-primary)] text-[color:oklch(var(--color-on-accent))] shadow-[var(--shadow-glow)] transition-all duration-100 hover:brightness-110 active:scale-90 disabled:opacity-40 md:flex"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
