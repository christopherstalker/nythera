"use client";

import Link from "next/link";
import { CloudOff, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ServiceUnavailable({
  title = "The library is reconnecting",
  description = "Nythera cannot reach its story database right now. Your characters and chats are safe; try again in a moment.",
  onRetry,
  className
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border-y border-[var(--codex-rule)] bg-[var(--codex-paper)] px-5 py-16 sm:px-10 sm:py-24",
        className
      )}
      aria-labelledby="service-unavailable-title"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-[var(--codex-violet)] opacity-[.08] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative max-w-2xl">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]">
          <CloudOff className="h-5 w-5" />
        </div>
        <p className="codex-kicker mt-8">Temporary connection issue</p>
        <h2
          id="service-unavailable-title"
          className="font-editorial mt-3 text-4xl font-medium leading-tight text-[var(--codex-ivory)] sm:text-6xl"
        >
          {title}
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={onRetry ?? (() => window.location.reload())}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
