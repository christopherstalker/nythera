"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Ellipsis, Gem, PanelRightOpen, Plus, Share2, Trash2 } from "lucide-react";
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
  onOpenContext?: () => void;
};

export function ChatHeader({ chatId, characterId, characterName, characterAvatarUrl, personaName, onOpenContext }: ChatHeaderProps) {
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
      className="pointer-events-none absolute inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-30 px-4 sm:px-6"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      <div className="mx-auto flex w-full max-w-[min(920px,calc(100vw-2rem))] items-start justify-between gap-3">
        <motion.div
          className="pointer-events-auto flex h-16 min-w-0 max-w-[min(480px,calc(100vw-7.25rem))] items-center gap-2 rounded-full border border-[var(--border-subtle)] px-2.5 shadow-[var(--shadow-elevated)]"
          style={{
            background: "color-mix(in oklch, var(--bg-base) 76%, transparent)",
            backdropFilter: "blur(24px) saturate(185%)",
            WebkitBackdropFilter: "blur(24px) saturate(185%)"
          }}
          whileHover={{ y: -1 }}
          transition={springSnappy}
        >
          <HeaderIconButton ariaLabel="Go back" onClick={() => router.back()} subtle>
            <ArrowLeft className="h-6 w-6" />
          </HeaderIconButton>

          <Avatar name={characterName} src={characterAvatarUrl} size="md" className="h-12 w-12 shrink-0 border border-[var(--border-subtle)]" />

          <div className="min-w-0 flex-1 pr-1">
            <h1 className="truncate text-xl font-bold leading-6 text-[var(--text-primary)] sm:text-2xl">{characterName}</h1>
            <p className="truncate text-xs font-semibold leading-4 text-[var(--text-muted)] sm:text-sm">
              {personaName ? `${personaName} active` : "Active scene"}
            </p>
          </div>

          <Link
            href={characterId ? `/character/${characterId}` : "/explore"}
            aria-label="Open character"
            className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-base)] no-underline"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </motion.div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-3">
          <HeaderIconButton ariaLabel="Open story context" onClick={onOpenContext} elevated>
            <PanelRightOpen className="h-5 w-5" />
          </HeaderIconButton>

          <div className="relative">
            <HeaderIconButton ariaLabel="Open chat menu" onClick={() => setOpen((current) => !current)} elevated>
              <Ellipsis className="h-6 w-6" />
            </HeaderIconButton>
            {open ? (
              <div
                className="absolute right-0 top-16 z-40 w-52 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-1.5 shadow-[var(--shadow-elevated)]"
                style={{
                  background: "color-mix(in oklch, var(--bg-elevated) 88%, transparent)",
                  backdropFilter: "blur(18px) saturate(165%)",
                  WebkitBackdropFilter: "blur(18px) saturate(165%)"
                }}
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
  subtle = false
}: {
  ariaLabel: string;
  onClick?: () => void;
  children: React.ReactNode;
  elevated?: boolean;
  subtle?: boolean;
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
        elevated ? "h-14 w-14 border border-[var(--border-subtle)] shadow-[var(--shadow-soft)]" : "h-10 w-10",
        subtle ? "hover:bg-[var(--color-overlay)]" : "bg-[var(--color-overlay)] hover:bg-[var(--bg-elevated)]"
      )}
      style={
        elevated
          ? {
              background: "color-mix(in oklch, var(--bg-base) 55%, transparent)",
              backdropFilter: "blur(18px) saturate(170%)",
              WebkitBackdropFilter: "blur(18px) saturate(170%)"
            }
          : undefined
      }
    >
      {children}
    </motion.button>
  );
}
