"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Ellipsis,
  Gem,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Share2,
  Trash2
} from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { springSoft, springSnappy } from "@/lib/motion";

type ChatHeaderProps = {
  chatId: string;
  chapterNumber: number;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  personaName?: string | null;
  contextOpen?: boolean;
  onOpenContext?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function ChatHeader({
  chatId,
  chapterNumber,
  characterId,
  characterName,
  characterAvatarUrl,
  personaName,
  contextOpen = false,
  onOpenContext,
  onRefresh,
  refreshing = false
}: ChatHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    menu?.querySelector<HTMLElement>("[data-chat-menu] button")?.focus();
    function dismiss(event: PointerEvent) {
      if (!menu?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      menu?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function shareChat(copyOnly = false) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/chats/${chatId}/share`, { method: "POST" });
      if (!response.ok) throw new Error();
      const body = await response.json();
      const url = `${window.location.origin}${body.url}`;
      if (!copyOnly && navigator.share) {
        await navigator.share({ title: `A story with ${characterName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Share link copied.");
      }
      setOpen(false);
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError"))
        setNotice("Could not share this chat. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function deleteChat() {
    if (pending || !window.confirm("Delete this chat and its messages? This cannot be undone.")) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setOpen(false);
      router.push("/chats");
    } catch {
      setNotice("Could not delete this chat. Your conversation is still here.");
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.header
      className="pointer-events-none absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-black/55 px-3 pt-[env(safe-area-inset-top)] sm:px-5"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between gap-2 sm:h-[72px] sm:gap-3">
        <div className="pointer-events-auto flex min-w-0 max-w-[min(520px,calc(100vw-10.5rem))] items-center gap-2">
          <HeaderIconButton ariaLabel="Back to chats" onClick={() => router.push("/chats")} subtle>
            <ArrowLeft className="h-6 w-6" />
          </HeaderIconButton>

          <motion.div className="min-w-0 flex-1" whileHover={{ y: -1 }} transition={springSnappy}>
            <Link
              href={characterId ? `/character/${characterId}` : "/explore"}
              aria-label={`Open ${characterName} profile`}
              className="focus-ring flex min-w-0 items-center gap-2 rounded-xl pr-1 no-underline"
            >
              <span className="relative shrink-0">
                <Avatar
                  name={characterName}
                  src={characterAvatarUrl}
                  size="md"
                  className="h-10 w-10 shrink-0 border border-[var(--codex-rule)] lg:hidden"
                />
              </span>
              <span className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold uppercase tracking-[.16em] text-[var(--codex-ivory)] sm:text-base">
                  {characterName}
                </h1>
                <p className="truncate text-[9px] font-medium uppercase tracking-[.18em] text-[var(--codex-violet)] sm:text-[10px]">
                  Chapter {chapterNumber} · AI character · {personaName ? `${personaName} active` : "After the storm"}
                </p>
              </span>
            </Link>
          </motion.div>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <HeaderIconButton
            ariaLabel={contextOpen ? "Close story context" : "Open story context"}
            onClick={onOpenContext}
            elevated
            active={contextOpen}
          >
            {contextOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </HeaderIconButton>

          <HeaderIconButton
            ariaLabel={refreshing ? "Refreshing chat" : "Refresh chat"}
            onClick={onRefresh}
            elevated
            disabled={refreshing}
          >
            <RefreshCcw className={cn("h-5 w-5", refreshing && "animate-spin")} />
          </HeaderIconButton>

          <div ref={menuRef} className="relative">
            <HeaderIconButton
              ariaLabel="Open chat menu"
              expanded={open}
              onClick={() => setOpen((current) => !current)}
              elevated
            >
              <Ellipsis className="h-6 w-6" />
            </HeaderIconButton>
            {open ? (
              <div
                data-chat-menu
                className="absolute right-0 top-16 z-40 w-52 overflow-hidden rounded-xl border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-1.5 shadow-xl"
              >
                <button type="button" disabled={pending} onClick={() => void shareChat()} className="nav-item w-full">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void shareChat(true)}
                  className="nav-item w-full"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <Link
                  href={characterId ? `/character/${characterId}` : "/explore"}
                  className="nav-item"
                  onClick={() => setOpen(false)}
                >
                  <Gem className="h-4 w-4" />
                  Character
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void deleteChat()}
                  className="nav-item w-full text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete chat
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {notice ? (
        <div
          role="status"
          className="pointer-events-auto mx-auto mb-3 flex max-w-[1100px] items-center justify-between gap-3 rounded-lg bg-[var(--codex-paper-raised)] px-3 py-2 text-sm"
        >
          <p>{notice}</p>
          <button type="button" className="focus-ring min-h-10 px-2 text-xs" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
    </motion.header>
  );
}

function HeaderIconButton({
  ariaLabel,
  onClick,
  children,
  elevated = false,
  subtle = false,
  active = false,
  disabled = false,
  expanded
}: {
  ariaLabel: string;
  onClick?: () => void;
  children: React.ReactNode;
  elevated?: boolean;
  subtle?: boolean;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={springSnappy}
      className={cn(
        "focus-ring grid shrink-0 place-items-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        elevated ? "h-10 w-10 border border-[var(--codex-rule)]" : "h-10 w-10",
        active && "text-[var(--text-primary)]",
        subtle ? "hover:bg-[var(--color-overlay)]" : "bg-transparent hover:bg-[var(--bg-elevated)]",
        disabled && "cursor-wait opacity-50"
      )}
    >
      {children}
    </motion.button>
  );
}
