"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Ellipsis, Gem, PanelRightClose, PanelRightOpen, Plus, Share2, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { springSoft, springSnappy } from "@/lib/motion";

type ChatHeaderProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  personaName?: string | null;
  contextOpen?: boolean;
  onOpenContext?: () => void;
};

export function ChatHeader({ chatId, characterId, characterName, characterAvatarUrl, personaName, contextOpen = false, onOpenContext }: ChatHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function shareChat() {
    const response = await fetch(`/api/chats/${chatId}/share`, { method: "POST" });
    if (!response.ok) return;
    const body = await response.json();
    await navigator.clipboard?.writeText(`${window.location.origin}${body.url}`);
    setOpen(false);
  }

  async function deleteChat() {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setOpen(false);
    router.push("/chats");
  }

  return (
    <motion.header
      className="pointer-events-none absolute inset-x-0 top-0 z-30 border-b border-[var(--codex-rule)] bg-[color-mix(in_oklch,var(--codex-paper)_88%,transparent)] px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-5"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between gap-2 sm:h-[72px] sm:gap-3">
        <motion.div
          className="pointer-events-auto flex min-w-0 max-w-[min(520px,calc(100vw-7.5rem))] items-center gap-2"
          whileHover={{ y: -1 }}
          transition={springSnappy}
        >
          <HeaderIconButton ariaLabel="Go back" onClick={() => router.back()} subtle>
            <ArrowLeft className="h-6 w-6" />
          </HeaderIconButton>

          <Avatar name={characterName} src={characterAvatarUrl} size="md" className="h-10 w-10 shrink-0 border border-[var(--codex-rule)] lg:hidden" />

          <div className="min-w-0 flex-1 pr-1">
            <h1 className="truncate text-sm font-semibold uppercase tracking-[.16em] text-[var(--codex-ivory)] sm:text-base">{characterName}</h1>
            <p className="truncate text-[9px] font-medium uppercase tracking-[.18em] text-[var(--codex-violet)] sm:text-[10px]">
              Chapter 3 · {personaName ? `${personaName} active` : "After the storm"}
            </p>
          </div>

          <Link
            href={characterId ? `/character/${characterId}` : "/explore"}
            aria-label="Open character"
            className="focus-ring hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)] no-underline sm:grid"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </motion.div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <HeaderIconButton ariaLabel={contextOpen ? "Close story context" : "Open story context"} onClick={onOpenContext} elevated active={contextOpen}>
            {contextOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </HeaderIconButton>

          <div className="relative">
            <HeaderIconButton ariaLabel="Open chat menu" onClick={() => setOpen((current) => !current)} elevated>
              <Ellipsis className="h-6 w-6" />
            </HeaderIconButton>
            {open ? (
              <div
                className="orbital-floating absolute right-0 top-16 z-40 w-52 overflow-hidden rounded-[var(--radius-card)] p-1.5"
              >
                <button type="button" onClick={shareChat} className="nav-item w-full">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button type="button" onClick={shareChat} className="nav-item w-full">
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <Link href={characterId ? `/character/${characterId}` : "/explore"} className="nav-item" onClick={() => setOpen(false)}>
                  <Gem className="h-4 w-4" />
                  Character
                </Link>
                <button type="button" onClick={deleteChat} className="nav-item w-full text-red-300 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                  Delete chat
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function HeaderIconButton({
  ariaLabel,
  onClick,
  children,
  elevated = false,
  subtle = false,
  active = false
}: {
  ariaLabel: string;
  onClick?: () => void;
  children: React.ReactNode;
  elevated?: boolean;
  subtle?: boolean;
  active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={springSnappy}
      className={cn(
        "focus-ring grid shrink-0 place-items-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        elevated ? "h-10 w-10 border border-[var(--codex-rule)]" : "h-10 w-10",
        active && "text-[var(--text-primary)]",
        subtle ? "hover:bg-[var(--color-overlay)]" : "bg-transparent hover:bg-[var(--bg-elevated)]"
      )}
    >
      {children}
    </motion.button>
  );
}
