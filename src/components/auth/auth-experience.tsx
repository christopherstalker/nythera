"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, MessageCircle, Sparkles, Users, Wand2 } from "lucide-react";
import { AUTH_WHISPERS, TRAVELER_NAMES } from "@/components/auth/auth-whispers";
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

function AuthStars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 48 }, (_, index) => ({
        id: index,
        left: `${(index * 17 + 7) % 100}%`,
        top: `${(index * 23 + 11) % 100}%`,
        size: index % 5 === 0 ? 2.5 : index % 3 === 0 ? 1.5 : 1,
        delay: `${(index % 12) * 0.35}s`,
        duration: `${2.8 + (index % 6) * 0.4}s`
      })),
    []
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star) => (
        <span
          key={star.id}
          className="nythera-auth-star absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.duration
          }}
        />
      ))}
    </div>
  );
}

function WhisperPanel({ whisperIndex }: { whisperIndex: number }) {
  const whisper = AUTH_WHISPERS[whisperIndex];

  return (
    <div className="relative mt-10 max-w-lg">
      <div className="nythera-auth-whisper absolute -left-3 top-6 h-24 w-24 rounded-full bg-primary/20 blur-3xl" />
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
    <div className="nythera-auth-scene relative min-h-dvh overflow-hidden">
      <AuthStars />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[#ffb347]/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1240px] flex-col px-[var(--page-padding-x)] py-5 sm:py-6 lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,420px)] lg:items-center lg:gap-8 lg:px-10 lg:py-10 xl:max-w-[1400px] 2xl:max-w-[1520px]">
        <section className="flex flex-col justify-center pb-8 lg:pb-0 lg:pr-6">
          <Link href="/" className="inline-flex w-fit items-center gap-3 no-underline">
            <span className="brand-mark-shell h-11 w-11">
              <Image src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold tracking-[0.22em] text-[var(--text-primary)]">NYTHERA</span>
          </Link>

          <p className="energy-pill mt-8 w-fit">{copy.eyebrow}</p>
          <h1 className="text-display mt-5 max-w-xl font-semibold tracking-tight text-[var(--text-primary)]">
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
                className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-white/[0.06] bg-white/[0.03] px-4 py-3 backdrop-blur-sm"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
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

        <section className="flex w-full flex-col justify-center">
          <div className="nythera-auth-portal relative mx-auto w-full max-w-md">
            <div aria-hidden="true" className="nythera-auth-portal-ring absolute -inset-px rounded-[calc(var(--radius-xl)+2px)]" />
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-white/[0.08] bg-[rgb(14_14_24/0.82)] p-6 shadow-[var(--shadow-card)] backdrop-blur-2xl sm:p-7">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-gradient opacity-40" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-2 text-primary">
                  {mode === "register" ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                    {mode === "register" ? "Summon your account" : "Cross the threshold"}
                  </span>
                </div>

                <div className="mb-6 rounded-[var(--radius-lg)] border border-white/[0.06] bg-black/20 p-4 lg:hidden">
                  <WhisperPanel whisperIndex={whisperIndex} />
                </div>

                {children}
                <div className="mt-6 rounded-[var(--radius-lg)] border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-[var(--text-secondary)]">
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
