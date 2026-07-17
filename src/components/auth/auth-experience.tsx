"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, MessageCircle, Sparkles, Users, Wand2 } from "lucide-react";
import { AUTH_WHISPERS, TRAVELER_NAMES } from "@/components/auth/auth-whispers";
import { BRAND_ICON_SMALL } from "@/lib/brand";
import { cn } from "@/lib/utils";

type AuthExperienceProps = {
  mode: "login" | "register";
  children: React.ReactNode;
  footer: React.ReactNode;
};

const FEATURES = [
  { icon: Users, label: "Living characters", detail: "Personas that remember your tone" },
  { icon: MessageCircle, label: "Branching chats", detail: "Pick up any thread, any scene" },
  { icon: BookOpen, label: "Your chronicle", detail: "Memories that follow the story" }
];

const COPY = {
  login: {
    eyebrow: "Return to the story",
    title: "The veil parts for those who remember.",
    subtitle: "Step back into your characters, chats, and the worlds you've shaped."
  },
  register: {
    eyebrow: "Begin your chronicle",
    title: "Every legend starts with a name.",
    subtitle: "Forge an identity, summon characters, and write scenes only you can tell."
  }
} as const;

function WhisperPanel({ whisperIndex }: { whisperIndex: number }) {
  const whisper = AUTH_WHISPERS[whisperIndex];

  return (
    <div className="relative mt-10 max-w-lg border-l border-[var(--accent-violet)] pl-5">
      <div className="nythera-auth-dialogue relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80">{whisper.scene}</p>
        <p key={whisper.line} className="nythera-auth-whisper-text mt-4 text-2xl font-medium leading-snug text-[var(--text-primary)] sm:text-[1.65rem]">
          &ldquo;{whisper.line}&rdquo;
        </p>
        <p key={whisper.name} className="nythera-auth-whisper-text mt-5 text-sm text-[var(--text-secondary)]">
          — <span className="font-semibold text-[var(--text-primary)]">{whisper.name}</span>
        </p>
      </div>
    </div>
  );
}

export function AuthExperience({ mode, children, footer }: AuthExperienceProps) {
  const [whisperIndex, setWhisperIndex] = useState(0);
  const copy = COPY[mode];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWhisperIndex((current) => (current + 1) % AUTH_WHISPERS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="nythera-auth-scene codex-auth relative min-h-dvh overflow-hidden">
      <div className="relative z-10 grid min-h-dvh w-full lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
        <section className="flex flex-col justify-center border-b border-[var(--border-default)] px-6 py-10 lg:border-b-0 lg:border-r lg:px-[clamp(3rem,7vw,8rem)] lg:py-14">
          <Link href="/" className="inline-flex w-fit items-center gap-3 no-underline">
            <span className="brand-mark-shell h-11 w-11">
              <Image src={BRAND_ICON_SMALL} alt="" width={28} height={28} className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold tracking-[0.22em] text-[var(--text-primary)]">NYTHERA</span>
          </Link>

          <p className="codex-kicker mt-12">{copy.eyebrow}</p>
          <h1 className="font-editorial mt-5 max-w-2xl text-5xl font-medium leading-[.95] text-[var(--text-primary)] sm:text-6xl xl:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-[var(--text-secondary)] sm:text-base">{copy.subtitle}</p>

          <div className="hidden lg:block">
            <WhisperPanel whisperIndex={whisperIndex} />
          </div>

          <ul className="mt-8 hidden gap-3 sm:grid lg:mt-10">
            {FEATURES.map((feature) => (
              <li
                key={feature.label}
                className="flex items-start gap-3 border-t border-[var(--border-default)] py-4"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center border border-[var(--border-default)] text-[var(--accent-mint)]">
                  <feature.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{feature.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{feature.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex w-full flex-col justify-center px-6 py-10 lg:px-[clamp(3rem,6vw,7rem)]">
          <div className="nythera-auth-portal relative mx-auto w-full max-w-md">
            <div className="relative border-y border-[var(--border-default)] py-7">
              <div className="relative">
                <div className="mb-6 flex items-center gap-2 text-primary">
                  {mode === "register" ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                    {mode === "register" ? "Summon your account" : "Cross the threshold"}
                  </span>
                </div>

                <div className="mb-6 border-l border-[var(--accent-violet)] pl-4 lg:hidden">
                  <WhisperPanel whisperIndex={whisperIndex} />
                </div>

                {children}
                <div className="mt-6 border-t border-[var(--border-default)] pt-5 text-sm text-[var(--text-secondary)]">
                  {footer}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function TravelerNameSuggestions({
  onSelect,
  className
}: {
  onSelect: (name: string) => void;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState(() => TRAVELER_NAMES.slice(0, 4));

  useEffect(() => {
    setSuggestions([...TRAVELER_NAMES].sort(() => Math.random() - 0.5).slice(0, 4));
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Need a traveler name?</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            className="focus-ring rounded-[var(--radius-pill)] border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:border-primary/35 hover:bg-primary/16"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
