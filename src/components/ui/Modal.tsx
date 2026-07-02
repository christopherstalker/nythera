"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
};

export function Modal({ open, title, children, onClose, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="Close modal backdrop" className="absolute inset-0" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("modal-panel relative max-h-[88svh] w-full overflow-hidden rounded-t-[var(--radius-xl)] p-5 sm:w-[min(560px,calc(100vw-48px))] sm:rounded-[var(--radius-lg)] sm:p-6", className)}
      >
        <div className="mb-4 flex items-center gap-3">
          {title ? <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-[var(--text-primary)]">{title}</h2> : <span className="flex-1" />}
          <button type="button" aria-label="Close modal" onClick={onClose} className="focus-ring grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
