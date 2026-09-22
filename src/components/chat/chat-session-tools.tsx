"use client";

import { useEffect, useState } from "react";
import { Brain, HardDrive, Sparkles, Square } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ContextInspector } from "@/components/chat/context-inspector";
import { FirstScenePanel } from "@/components/chat/first-scene-panel";
import { LocalModelPanel } from "@/components/settings/local-model-panel";
import { LOCAL_MODEL_EVENT, readLocalModel } from "@/lib/local-model";

export function ChatSessionTools({
  chatId,
  messageId,
  firstScene,
  onDraft,
  onModel,
  streaming,
  onStop
}: {
  chatId: string;
  messageId?: string | null;
  firstScene: boolean;
  onDraft: (draft: string) => void;
  onModel: (model: string) => void;
  streaming: boolean;
  onStop: () => void;
}) {
  const [panel, setPanel] = useState<"start" | "memory" | "local" | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setLocalName(readLocalModel()?.model ?? null);
      setDesktop(Boolean(window.nytheraDesktop?.local));
    };
    refresh();
    window.addEventListener(LOCAL_MODEL_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_MODEL_EVENT, refresh);
  }, []);
  const toolClass =
    "focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)]/90 px-3 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-purple)] hover:text-[var(--text-primary)] disabled:opacity-50";
  return (
    <>
      <div
        className="relative z-20 mx-auto flex w-full max-w-[var(--chat-content-width,1000px)] shrink-0 flex-wrap items-center gap-2 px-4 pb-2 sm:px-7"
        aria-label="Session tools"
      >
        {firstScene ? (
          <button type="button" className={toolClass} disabled={streaming} onClick={() => setPanel("start")}>
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
            Start here
          </button>
        ) : null}
        <button type="button" className={toolClass} disabled={streaming} onClick={() => setPanel("memory")}>
          <Brain className="h-3.5 w-3.5" />
          Reply context
        </button>
        {desktop ? (
          <button
            type="button"
            className={`${toolClass} max-w-full`}
            disabled={streaming}
            onClick={() => setPanel("local")}
          >
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{localName ? `Local · ${localName}` : "Local model"}</span>
          </button>
        ) : null}
        {streaming ? (
          <button type="button" className={`${toolClass} ml-auto`} onClick={onStop}>
            <Square className="h-3 w-3" />
            Stop reply
          </button>
        ) : null}
      </div>
      <Modal
        open={panel !== null}
        title={panel === "start" ? "Your first scene" : panel === "local" ? "Local model" : "What this reply remembers"}
        onClose={() => setPanel(null)}
      >
        {panel === "start" ? (
          <FirstScenePanel
            onModel={onModel}
            onReady={(draft) => {
              onDraft(draft);
              setPanel(null);
            }}
          />
        ) : panel === "local" ? (
          <LocalModelPanel />
        ) : panel === "memory" ? (
          <ContextInspector chatId={chatId} messageId={messageId} />
        ) : null}
      </Modal>
    </>
  );
}
