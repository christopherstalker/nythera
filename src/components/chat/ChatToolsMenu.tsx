"use client";

import { useEffect, useRef, type ChangeEventHandler } from "react";
import { Folder, FolderOpen, ImagePlus, Images, LoaderCircle, Mic, Paperclip, Settings2, Sparkles, X } from "lucide-react";
import { motion } from "motion/react";
import { springSnappy, springSoft } from "@/lib/motion";

type ChatToolsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachmentCount: number;
  imageUploading: boolean;
  imageLimitReached: boolean;
  generatingScene: boolean;
  recording: boolean;
  modelLoading: boolean;
  modelLabel: string;
  hasApiControls: boolean;
  onAttachImages: ChangeEventHandler<HTMLInputElement>;
  onAttachContextFile: ChangeEventHandler<HTMLInputElement>;
  onOpenLookbook: () => void;
  onGenerateScene: () => void;
  onToggleRecording: () => void;
  onOpenApiSettings: () => void;
};

const menuItemClass = "focus-ring flex min-h-14 items-center gap-3 rounded-sm border border-white/10 bg-white/[.025] px-3 py-2.5 text-left text-[var(--text-secondary)] transition hover:border-[var(--codex-mint)] hover:bg-white/[.05] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-45";

export function ChatToolsMenu({
  open,
  onOpenChange,
  attachmentCount,
  imageUploading,
  imageLimitReached,
  generatingScene,
  recording,
  modelLoading,
  modelLabel,
  hasApiControls,
  onAttachImages,
  onAttachContextFile,
  onOpenLookbook,
  onGenerateScene,
  onToggleRecording,
  onOpenApiSettings
}: ChatToolsMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <div ref={containerRef} className={`relative shrink-0 ${open ? "isolate z-50" : ""}`}>
      {open ? (
        <motion.div
          role="menu"
          aria-label="Chat tools"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springSoft}
          className="absolute -right-[3.25rem] bottom-full z-[60] mb-3 w-[min(310px,calc(100vw-3rem))] rounded-sm border border-white/15 bg-[#090909] p-3 shadow-2xl sm:right-0"
        >
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--codex-mint)]">Toolbox</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Choose what to add to this turn.</p>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="focus-ring grid h-8 w-8 place-items-center text-[var(--text-secondary)]" aria-label="Close chat tools">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label role="menuitem" className={`${menuItemClass} cursor-pointer ${imageUploading || imageLimitReached ? "pointer-events-none opacity-45" : ""}`}>
              {imageUploading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : <ImagePlus className="h-4 w-4 shrink-0" />}
              <span><span className="block text-xs font-semibold text-[var(--text-primary)]">Photos</span><span className="mt-0.5 block text-[10px]">Attach an image</span></span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={imageUploading || imageLimitReached}
                onChange={(event) => {
                  onOpenChange(false);
                  onAttachImages(event);
                }}
              />
            </label>

            <button type="button" role="menuitem" onClick={() => run(onOpenLookbook)} className={menuItemClass}>
              <Images className="h-4 w-4 shrink-0" />
              <span><span className="block text-xs font-semibold text-[var(--text-primary)]">Lookbook</span><span className="mt-0.5 block text-[10px]">Saved looks</span></span>
            </button>

            <button type="button" role="menuitem" onClick={() => run(onGenerateScene)} disabled={generatingScene} className={menuItemClass}>
              {generatingScene ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="h-4 w-4 shrink-0" />}
              <span><span className="block text-xs font-semibold text-[var(--text-primary)]">Illustrate</span><span className="mt-0.5 block text-[10px]">Current scene</span></span>
            </button>

            <label role="menuitem" className={`${menuItemClass} cursor-pointer`}>
              <Paperclip className="h-4 w-4 shrink-0" />
              <span><span className="block text-xs font-semibold text-[var(--text-primary)]">Context file</span><span className="mt-0.5 block text-[10px]">TXT, MD or JSON</span></span>
              <input
                type="file"
                accept=".txt,.md,.json,text/plain,application/json"
                className="sr-only"
                onChange={(event) => {
                  onOpenChange(false);
                  onAttachContextFile(event);
                }}
              />
            </label>

            <button type="button" role="menuitem" onClick={() => run(onToggleRecording)} className={menuItemClass}>
              <Mic className={`h-4 w-4 shrink-0 ${recording ? "animate-pulse text-red-400" : ""}`} />
              <span><span className="block text-xs font-semibold text-[var(--text-primary)]">{recording ? "Stop voice" : "Voice note"}</span><span className="mt-0.5 block text-[10px]">Transcribe tone</span></span>
            </button>

            {hasApiControls ? (
              <button type="button" role="menuitem" onClick={() => run(onOpenApiSettings)} className={menuItemClass}>
                {modelLoading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : <Settings2 className="h-4 w-4 shrink-0" />}
                <span className="min-w-0"><span className="block text-xs font-semibold text-[var(--text-primary)]">Model & style</span><span className="mt-0.5 block truncate text-[10px]">{modelLabel}</span></span>
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      <motion.button
        type="button"
        aria-label={open ? "Close chat tools" : "Open chat tools"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        whileTap={{ scale: 0.92 }}
        transition={springSnappy}
        className="focus-ring relative grid h-11 w-11 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--text-primary)]"
      >
        {open ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
        {attachmentCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--codex-mint)] px-1 text-[10px] font-bold text-black">{attachmentCount}</span> : null}
        {recording ? <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-red-400" /> : null}
      </motion.button>
    </div>
  );
}
