"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Copy, Edit3, RefreshCcw, Pin, Trash2, History } from "lucide-react";

type MessageContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onRewind?: () => void;
  onPin?: () => void;
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
  onRewind,
  onPin,
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

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
      }}
      className="z-[9999] w-[200px] flex flex-col gap-0.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-1 duration-150"
    >
      <MenuItem onClick={onCopy} icon={<Copy className="h-4 w-4" />}>
        Copy
      </MenuItem>

      {onEdit ? (
        <MenuItem onClick={onEdit} icon={<Edit3 className="h-4 w-4" />}>
          Edit
        </MenuItem>
      ) : null}

      {!isUserMessage && (
        <MenuItem onClick={onRegenerate} icon={<RefreshCcw className="h-4 w-4" />}>
          Regenerate
        </MenuItem>
      )}

      <MenuItem onClick={onRewind} icon={<History className="h-4 w-4" />}>
        Rewind
      </MenuItem>

      <MenuItem onClick={onPin} icon={<Pin className="h-4 w-4" />}>
        {isPinned ? "Unpin" : "Pin"}
      </MenuItem>

      <div className="my-0.5 h-px bg-[var(--border-subtle)]" />

      <MenuItem onClick={onDelete} destructive icon={<Trash2 className="h-4 w-4" />}>
        Delete
      </MenuItem>
    </div>,
    document.body
  );
}

function MenuItem({
  children,
  onClick,
  icon,
  destructive = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150",
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
