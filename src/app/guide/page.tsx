import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Braces, LifeBuoy, PenLine } from "lucide-react";
import { GuideNavigation } from "@/components/guide/guide-navigation";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Nythera help center",
  description: "Learn the Nythera platform, connect AI provider APIs, format roleplay, and contact support.",
  alternates: { canonical: "/guide" }
};

const manuals = [
  {
    href: "/guide/platform",
    icon: PenLine,
    number: "01",
    title: "Platform manual",
    description: "Characters, Guided and Complete creation, chats, regeneration, branches, personas, memories, rooms, and reports."
  },
  {
    href: "/guide/api",
    icon: Braces,
    number: "02",
    title: "API connections",
    description: "Bring provider keys, select models, configure fallback, and connect an OpenAI-compatible endpoint safely."
  },
  {
    href: "/guide/roleplay-formatting",
    icon: BookOpen,
    number: "03",
    title: "Roleplay formatting",
    description: "Write actions, dialogue, emphasis, quotes, subtext, and clean character subtitles."
  },
  {
    href: "/support",
    icon: LifeBuoy,
    number: "04",
    title: "Support",
    description: "Send a bug report, suggestion, account question, or safety concern to the Nythera support address."
  }
] as const;

export default function GuideHomePage() {
  return (
    <PageShell className="pb-24">
      <div className="mx-auto max-w-6xl">
        <GuideNavigation current="/guide" />
        <PageHeader icon={BookOpen} title="Help center" description="Everything needed to build a character, continue a story, connect a model provider, and get help without leaving Nythera." />

        <div className="mt-10 grid border-t border-[var(--codex-rule)] md:grid-cols-2">
          {manuals.map((manual, index) => {
            const Icon = manual.icon;
            return (
              <Link key={manual.href} href={manual.href} className={`group no-underline ${index % 2 === 0 ? "md:border-r md:border-[var(--codex-rule)]" : ""}`}>
                <Surface className="h-full rounded-none border-x-0 border-t-0 p-7 transition-colors group-hover:bg-[var(--color-overlay)] sm:p-9">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--codex-violet)]">{manual.number}</span>
                    <Icon className="h-5 w-5 text-[var(--codex-mint)]" />
                  </div>
                  <h2 className="font-editorial mt-8 text-3xl text-[var(--codex-ivory)]">{manual.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{manual.description}</p>
                  <span className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[var(--codex-mint)]">
                    Open manual <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Surface>
              </Link>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
