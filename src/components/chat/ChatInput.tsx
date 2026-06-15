"use client";

import { KeyboardEvent, useEffect, useRef } from "react";
import { ArrowUp, Lightbulb, SmilePlus } from "lucide-react";

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
    <div className="relative z-20 shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 md:px-8 md:pb-6">
      {onModelChange || onTemperatureChange ? (
        <div className="mx-auto mb-2 hidden max-w-[900px] gap-2 opacity-75 sm:grid-cols-[minmax(0,1fr)_220px] md:grid">
          {onModelChange ? (
            <input
              value={model ?? ""}
              onChange={(event) => onModelChange(event.target.value)}
              placeholder="provider:model"
              className="focus-ring h-9 rounded-full border border-white/10 bg-black/24 px-4 text-xs font-bold text-white placeholder:text-white/35 backdrop-blur-xl"
            />
          ) : null}
          {onTemperatureChange ? (
            <label className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/24 px-4 text-xs font-bold text-white/60 backdrop-blur-xl">
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
      <div className="mx-auto flex max-w-[900px] items-end gap-2 rounded-[34px] border border-white/18 bg-white/22 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_18px_55px_rgba(0,0,0,0.26)] backdrop-blur-2xl transition-colors duration-200 focus-within:border-white/30">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/60">
          <Lightbulb className="h-7 w-7 stroke-[2.6]" />
        </span>
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          onChange={(event) => onChange(event.target.value)}
          onInput={resize}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          className="max-h-[160px] min-h-11 flex-1 resize-none overflow-y-auto rounded-full bg-black/20 px-2 py-2 text-[26px] font-black leading-8 text-white outline-none placeholder:text-white/78 md:text-[22px]"
          disabled={disabled}
        />
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white">
          <SmilePlus className="h-7 w-7 fill-white text-white stroke-[2.2]" />
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff200] text-black transition-all duration-100 hover:brightness-110 active:scale-90 disabled:hidden"
        >
          <ArrowUp className="h-6 w-6 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
