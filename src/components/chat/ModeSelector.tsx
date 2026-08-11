"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CHAT_MODES, type ChatMode } from "@/lib/chat-mode";
import { cn } from "@/lib/utils";

export function ModeSelector({ mode, onChange }: { mode: ChatMode; onChange: (mode: ChatMode) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = CHAT_MODES.find((item) => item.id === mode) ?? CHAT_MODES[0];

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">AI model</p>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="chat-sidebar-mode flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>{active.icon}</span>
          <span className="font-medium text-[var(--text-primary)]">{active.label}</span>
          <span className="h-2 w-2 rounded-full" style={{ background: active.color }} />
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 space-y-1 border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-1.5">
          {CHAT_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-overlay)]",
                item.id === mode && "bg-[var(--color-overlay)]"
              )}
            >
              <span>{item.icon}</span>
              <span>
                <span className="block text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                <span className="block text-xs text-[var(--text-muted)]">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
