"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Copy, Edit3, GitFork, History, Pin, Play, RefreshCcw, ShieldAlert, Trash2 } from "lucide-react";

type MessageContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number };
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
  position,
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

    const handleScroll = () => onClose();
    const handleResize = () => onClose();

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const coords = getMenuCoords(position);
  const useSheet = typeof window !== "undefined" && window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;

  return createPortal(
    <div className={cn(useSheet && "fixed inset-0 z-[9999] flex items-end bg-black/72 p-3", !useSheet && "contents")}>
      {useSheet ? <button type="button" aria-label="Close message actions" className="absolute inset-0" onClick={onClose} /> : null}
      <div
        ref={menuRef}
        style={
          useSheet
            ? undefined
            : {
                position: "fixed",
                top: coords.top,
                left: coords.left,
              }
        }
        className={cn(
          "z-[9999] flex max-h-[min(80dvh,42rem)] flex-col gap-0.5 overflow-y-auto border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 animate-in fade-in duration-150",
          useSheet
            ? "relative w-full rounded-t-[var(--radius-xl)] pb-[calc(0.75rem+env(safe-area-inset-bottom))] slide-in-from-bottom-4"
            : "w-[200px] rounded-xl slide-in-from-bottom-1"
        )}
      >
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

      <MenuItem onClick={onRewind} icon={<History className="h-4 w-4" />}>
        Rewind
      </MenuItem>

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

      <div className="my-0.5 h-px bg-[var(--border-subtle)]" />

      <MenuItem onClick={onDelete} destructive icon={<Trash2 className="h-4 w-4" />}>
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-35",
        destructive
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-200"
          : "text-[var(--text-primary)] hover:bg-white/[0.055]"
      )}
    >
      <span className={destructive ? "text-red-400" : "text-[var(--text-secondary)]"}>{icon}</span>
      {children}
    </button>
  );
}

function getMenuCoords(position: { x: number; y: number }) {
  const menuWidth = 200;
  const menuHeight = 280;

  let left = position.x;
  let top = position.y;

  if (typeof window !== "undefined") {
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 12;
    }
  }

  return { top, left };
}
