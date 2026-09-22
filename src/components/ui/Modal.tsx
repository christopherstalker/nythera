"use client";

import { X } from "lucide-react";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
};

export function Modal({ open, title, children, onClose, className }: ModalProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop fixed inset-0 z-[80]" />
        <div className="pointer-events-none fixed inset-0 z-[81] flex items-end justify-center sm:items-center sm:p-6">
          <Dialog.Content
            onOpenAutoFocus={() => {
              triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (triggerRef.current?.isConnected) triggerRef.current.focus();
            }}
            aria-describedby={undefined}
            className={cn(
              "modal-panel pointer-events-auto relative max-h-[88svh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] p-5 outline-none sm:w-[min(560px,calc(100vw-48px))] sm:rounded-[var(--radius-lg)] sm:p-6",
              className
            )}
          >
            <div className="mb-4 flex items-center gap-3">
              <Dialog.Title
                className={title ? "min-w-0 flex-1 text-lg font-semibold text-[var(--text-primary)]" : "sr-only"}
              >
                {title || "Dialog"}
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close modal"
                className="focus-ring ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
