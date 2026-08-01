"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Settings2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { RichTextToolbar } from "@/components/rich-text/rich-text-toolbar";
import type { ProviderModelGroup } from "@/lib/provider-model-options";
import { RESPONSE_PROMPT_EXAMPLES } from "@/lib/response-prompt";
import { springSnappy, springSoft } from "@/lib/motion";
import { applyRichTextFormat, richTextFormatFromShortcut } from "@/lib/rich-text-formatting";

const MAX_RESPONSE_PROMPT_LENGTH = 2000;

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model?: string;
  modelGroups?: ProviderModelGroup[];
  modelLoading?: boolean;
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
  modelGroups = [],
  modelLoading = false,
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const format = richTextFormatFromShortcut(event.key, event.ctrlKey || event.metaKey);
    if (format) {
      event.preventDefault();
      const textarea = event.currentTarget;
      const result = applyRichTextFormat(value, textarea.selectionStart, textarea.selectionEnd, format);
      onChange(result.value);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  const canSend = !disabled && Boolean(value.trim());
  const hasApiControls = Boolean(onModelChange || onTemperatureChange || onResponsePromptChange);
  const currentTemperature = temperature ?? 0.7;
  const modelOptions = modelGroups.flatMap((group) => group.options);
  const hasModelOptions = modelOptions.length > 0;
  const currentModelIsKnown = Boolean(model && modelOptions.some((option) => option.value === model));
  const modelLabel = modelLoading ? "Loading" : formatModelLabel(model ?? "Model");

  return (
    <div
      className="pointer-events-none sticky bottom-0 z-20 shrink-0 border-t border-[var(--codex-rule)] bg-[color-mix(in_oklch,var(--codex-paper)_92%,transparent)] px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7 md:px-10 md:pb-4"
    >
      {hasApiControls && apiOpen ? (
        <motion.div
          className="api-panel-enter orbital-functional pointer-events-auto mx-auto mb-3 grid max-w-[var(--chat-max-width)] gap-3 rounded-[28px] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
        >
          {onModelChange ? (
            <label className="grid gap-1">
              <span className="px-1 text-[11px] font-medium uppercase text-[var(--text-muted)]">Model</span>
              <select
                value={model ?? ""}
                onChange={(event) => onModelChange(event.target.value)}
                disabled={modelLoading || !hasModelOptions}
                className="focus-ring glass-input h-10 rounded-[var(--radius-md)] px-3 text-xs focus:border-[var(--accent-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modelLoading ? <option value="">Loading saved providers...</option> : null}
                {!modelLoading && !hasModelOptions ? <option value="">No saved providers</option> : null}
                {!modelLoading && model && !currentModelIsKnown ? (
                  <option value={model} disabled>
                    Current model unavailable: {model}
                  </option>
                ) : null}
                {modelGroups.map((group) => (
                  <optgroup
                    key={group.provider}
                    label={`${group.displayName}${group.last4 ? ` · key ••••${group.last4}` : ""}${group.isDefault ? " · primary" : ""}`}
                  >
                    {group.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!modelLoading && !hasModelOptions ? (
                <a href="/settings/providers" className="px-1 text-xs font-medium text-[var(--accent-purple)] hover:underline">
                  Add a provider key in Settings
                </a>
              ) : (
                <span className="px-1 text-[11px] text-[var(--text-muted)]">Per-message override; saved as this conversation&apos;s default.</span>
              )}
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
                <span>{(responsePrompt ?? "").length}/{MAX_RESPONSE_PROMPT_LENGTH}</span>
              </span>
              <textarea
                value={responsePrompt ?? ""}
                onChange={(event) => onResponsePromptChange(event.target.value.slice(0, MAX_RESPONSE_PROMPT_LENGTH))}
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
        </motion.div>
      ) : null}
      <motion.div
        className="composer-dock pointer-events-auto relative mx-auto flex w-full max-w-[1000px] flex-col gap-2 border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] px-4 py-3 sm:px-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
      >
        <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" />
        <RichTextToolbar
          textareaRef={textareaRef}
          value={value}
          onChange={onChange}
          compact
          className="relative border-b border-[var(--border-subtle)] pb-2"
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onInput={resize}
            onKeyDown={handleKeyDown}
            placeholder="Write what happens next…"
            className="font-editorial relative max-h-[220px] min-h-16 w-full flex-1 resize-none overflow-y-auto bg-transparent px-0 py-1 text-xl leading-8 text-[var(--codex-ivory)] outline-none placeholder:italic placeholder:text-[var(--text-muted)] sm:min-h-8 sm:text-2xl sm:leading-9"
            disabled={disabled}
          />

          <div className="relative flex w-full items-center justify-between gap-2 sm:w-auto">
          <div className="flex min-w-0 items-center gap-2 sm:hidden">
            {onOpenComposer ? (
              <motion.button
                type="button"
                aria-label="Open memory, history, and persona"
                onClick={onOpenComposer}
                whileTap={{ scale: 0.94 }}
                transition={springSnappy}
                className="focus-ring flex h-10 min-w-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-2.5 pr-3 text-sm font-semibold text-[var(--text-secondary)]"
              >
                <Avatar name={personaName ?? "You"} src={personaAvatarUrl} size="xs" className="h-7 w-7 border-0 bg-transparent" />
                <span className="max-w-[116px] truncate">{personaName ?? "You"}</span>
              </motion.button>
            ) : null}
            {hasApiControls ? (
              <motion.button
                type="button"
                aria-label="API settings"
                onClick={() => setApiOpen((current) => !current)}
                whileTap={{ scale: 0.96 }}
                transition={springSnappy}
                className="focus-ring flex h-10 min-w-0 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-3 text-sm font-semibold text-[var(--text-secondary)]"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="max-w-[112px] truncate">{modelLabel}</span>
              </motion.button>
            ) : null}
          </div>

            <div className="relative flex shrink-0 items-center gap-2">
          {hasApiControls ? (
            <motion.button
              type="button"
              aria-label="API settings"
              title="API settings"
              onClick={() => setApiOpen((current) => !current)}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              className="focus-ring hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--color-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] sm:grid"
            >
              {modelLoading ? <Sparkles className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
            </motion.button>
          ) : null}

          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send message"
            whileTap={canSend ? { scale: 0.92 } : undefined}
            transition={springSnappy}
            className="focus-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--codex-mint)] text-[var(--codex-mint)] disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: canSend ? "oklch(var(--color-accent-secondary) / .08)" : "transparent"
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatModelLabel(value: string) {
  return value
    .replace(/^openai:/, "")
    .replace(/^anthropic:/, "")
    .replace(/^google:/, "")
    .replace(/^xai:/, "")
    .replace(/^openrouter:/, "")
    .replace(/-/g, " ");
}
