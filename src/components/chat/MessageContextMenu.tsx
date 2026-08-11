"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Copy, Edit3, GitFork, History, Pin, Play, RefreshCcw, ShieldAlert, Trash2, X } from "lucide-react";

type MessageContextMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onContinue?: () => void;
  onRewind?: () => void;
  onPin?: () => void;
  onBranch?: () => void;
  onReport?: () => void;
  onDelete: () => void;
  isUserMessage?: boolean;
  isPinned?: boolean;
};

export function MessageContextMenu({
  isOpen,
  onClose,
  onCopy,
  onEdit,
  onRegenerate,
  onContinue,
  onRewind,
  onPin,
  onBranch,
  onReport,
  onDelete,
  isUserMessage,
  isPinned,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/20 px-3 pt-3 backdrop-blur-[2px] md:items-center md:p-6">
      <button type="button" aria-label="Close message actions" className="absolute inset-0" onClick={onClose} />
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-actions-title"
        className="relative z-[9999] flex max-h-[min(82dvh,42rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[rgba(12,12,14,0.72)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_70px_rgba(0,0,0,.38)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 supports-[backdrop-filter]:bg-[rgba(12,12,14,0.58)] md:rounded-2xl md:p-4 md:shadow-[0_24px_90px_rgba(0,0,0,.48)] md:slide-in-from-bottom-2"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-1 pb-3">
          <div>
            <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
            <p id="message-actions-title" className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--text-muted)]">
              Message actions
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close actions"
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="side-panel-scroll grid min-h-0 grid-cols-4 gap-2 overflow-y-auto py-3">
          <MenuItem onClick={onCopy} icon={<Copy className="h-4 w-4" />}>
            Copy
          </MenuItem>

          {onEdit ? (
            <MenuItem onClick={onEdit} icon={<Edit3 className="h-4 w-4" />}>
              Edit
            </MenuItem>
          ) : null}

          {!isUserMessage && onRegenerate ? (
            <MenuItem onClick={onRegenerate} icon={<RefreshCcw className="h-4 w-4" />}>
              Regenerate
            </MenuItem>
          ) : null}

          {onContinue ? (
            <MenuItem onClick={onContinue} icon={<Play className="h-4 w-4" />}>
              Continue
            </MenuItem>
          ) : null}

          {onRewind ? (
            <MenuItem onClick={onRewind} icon={<History className="h-4 w-4" />}>
              Rewind
            </MenuItem>
          ) : null}

          <MenuItem onClick={onPin} icon={<Pin className="h-4 w-4" />}>
            {isPinned ? "Unpin" : "Pin"}
          </MenuItem>

          {onBranch ? (
            <MenuItem onClick={onBranch} icon={<GitFork className="h-4 w-4" />}>
              Branch
            </MenuItem>
          ) : null}

          {onReport ? (
            <MenuItem onClick={onReport} icon={<ShieldAlert className="h-4 w-4" />}>
              Report
            </MenuItem>
          ) : null}
        </div>
        <div className="h-px bg-white/10" />
        <MenuItem onClick={onDelete} destructive wide icon={<Trash2 className="h-4 w-4" />}>
          Delete
        </MenuItem>
      </div>
    </div>,
    document.body
  );
}

function MenuItem({
  children,
  onClick,
  icon,
  disabled = false,
  destructive = false,
  wide = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-16 w-full flex-col items-center justify-center gap-2 rounded-xl border border-transparent bg-white/[0.025] px-1.5 py-2 text-center text-[11px] transition-all duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 md:min-h-20 md:text-sm",
        wide && "mt-2 min-h-11 flex-row gap-2 bg-transparent text-sm md:min-h-12",
        destructive
          ? "text-red-400 hover:border-red-400/15 hover:bg-red-500/10 hover:text-red-200"
          : "text-[var(--text-primary)] hover:border-white/10 hover:bg-white/[0.075]"
      )}
    >
      <span className={destructive ? "text-red-400" : "text-[var(--text-secondary)]"}>{icon}</span>
      {children}
    </button>
  );
}
