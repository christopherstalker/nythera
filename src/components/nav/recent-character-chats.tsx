"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type RecentChat = {
  id: string;
  title: string | null;
  character: { id: string; name: string; avatarUrl: string | null };
};

export function RecentCharacterChats({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const desktop = window.matchMedia("(min-width: 1200px)");
    let lastLoadedAt = 0;
    async function refresh() {
      if (!desktop.matches) return;
      try {
        const response = await fetch("/api/chats/recent-characters", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (controller.signal.aborted) return;
        setChats(body.chats);
        setUnavailable(false);
        lastLoadedAt = Date.now();
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    function refreshOnFocus() {
      if (document.visibilityState === "visible" && Date.now() - lastLoadedAt > 60_000) void refresh();
    }
    void refresh();
    desktop.addEventListener("change", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      controller.abort();
      desktop.removeEventListener("change", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [pathname, userId, attempt]);

  return (
    <section
      className="codex-recent-chats min-h-0 w-full flex-1 overflow-y-auto px-3 pb-3"
      aria-label="Recent character chats"
    >
      <p className="px-3 pb-2 pt-4 text-[10px] font-medium uppercase tracking-[.14em] text-[var(--text-muted)]">
        Recent chats
      </p>
      {loading ? (
        <p role="status" className="px-3 py-2 text-xs text-[var(--text-muted)]">
          Loading chats…
        </p>
      ) : null}
      {unavailable ? (
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="focus-ring w-full rounded-lg px-3 py-3 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          Could not refresh chats. Try again
        </button>
      ) : null}
      {!loading && !unavailable && !chats.length ? (
        <p className="px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">Your conversations will appear here.</p>
      ) : null}
      {chats.map((chat) => (
        <Link
          key={chat.character.id}
          href={`/chat/${chat.id}`}
          aria-current={pathname === `/chat/${chat.id}` ? "page" : undefined}
          title={`${chat.character.name}${chat.title ? ` · ${chat.title}` : ""}`}
          className={cn(
            "focus-ring flex min-h-12 items-center gap-2.5 rounded-lg px-2 py-2 no-underline hover:bg-[var(--bg-elevated)]",
            pathname === `/chat/${chat.id}` && "bg-[var(--bg-elevated)]"
          )}
        >
          <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="sm" className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-[var(--text-primary)]">{chat.character.name}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
              {chat.title || "Continue conversation"}
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
