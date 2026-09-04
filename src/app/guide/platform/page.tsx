import type { Metadata } from "next";
import Link from "next/link";
import { GitBranch, History, LifeBuoy, MessageCircle, PenLine, Sparkles, UsersRound } from "lucide-react";
import { GuideNavigation } from "@/components/guide/guide-navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Nythera platform manual",
  description: "A practical manual for characters, chats, personas, memories, rooms, reports, and story controls in Nythera.",
  alternates: { canonical: "/guide/platform" }
};

const characterModes = [
  { title: "Inscribe", text: "Start from a premise and let Nythera draft a complete dossier for review. The saved character uses the Complete data model." },
  { title: "Guided", text: "Work through identity, personality, scenario, and the opening scene. A Guided character always reopens in Guided when edited." },
  { title: "Complete", text: "Control persona, lorebook, visual language, model overrides, boundaries, sliders, visibility, and Character Card V2 data. Complete characters reopen in Complete." }
] as const;

const chatActions = [
  { icon: Sparkles, title: "Regenerate", text: "Creates another version of the latest character reply. Use the arrows to compare variants." },
  { icon: MessageCircle, title: "Continue", text: "Moves the current scene forward without writing a user reply." },
  { icon: History, title: "Rewind", text: "Keeps the selected message and removes everything that came after it." },
  { icon: GitBranch, title: "Branch", text: "Copies the story up to a selected message into a separate chat so both timelines remain available." }
] as const;

export default function PlatformGuidePage() {
  return (
    <PageShell className="pb-24">
      <div className="mx-auto max-w-6xl">
        <GuideNavigation current="/guide/platform" />
        <PageHeader icon={PenLine} title="Platform manual" description="A practical route from your first character to long-running stories, alternate timelines, rooms, memories, and support." />

        <div className="mt-10 grid gap-10">
          <ManualSection number="01" title="Begin with your identity">
            <p>Create an account, then open Settings to choose your display profile and create one or more user personas. A persona tells characters who you are inside a particular story without changing your account identity.</p>
          </ManualSection>

          <ManualSection number="02" title="Create the right kind of character">
            <div className="grid border-t border-[var(--codex-rule)] lg:grid-cols-3">
              {characterModes.map((mode) => (
                <article key={mode.title} className="border-b border-[var(--codex-rule)] p-6 lg:border-r last:lg:border-r-0">
                  <h3 className="font-editorial text-2xl text-[var(--codex-ivory)]">{mode.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{mode.text}</p>
                </article>
              ))}
            </div>
          </ManualSection>

          <ManualSection number="03" title="Shape a conversation">
            <p>Choose a character from Discover or Library and start a chat. Model and response instructions can be adjusted from the story controls when provider keys are available.</p>
            <div className="mt-6 grid gap-px bg-[var(--codex-rule)] sm:grid-cols-2">
              {chatActions.map((action) => {
                const Icon = action.icon;
                return (
                  <article key={action.title} className="bg-[var(--codex-paper)] p-6">
                    <Icon className="h-5 w-5 text-[var(--codex-mint)]" />
                    <h3 className="font-editorial mt-4 text-2xl text-[var(--codex-ivory)]">{action.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{action.text}</p>
                  </article>
                );
              })}
            </div>
          </ManualSection>

          <ManualSection number="04" title="Keep continuity">
            <div className="grid gap-5 md:grid-cols-2">
              <Surface className="p-6"><UsersRound className="h-5 w-5 text-[var(--codex-violet)]" /><h3 className="font-editorial mt-4 text-2xl">Personas and rooms</h3><p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Bind a persona to a chat, or place several characters in one room. Each room keeps its own conversation state.</p></Surface>
              <Surface className="p-6"><History className="h-5 w-5 text-[var(--codex-violet)]" /><h3 className="font-editorial mt-4 text-2xl">Memory</h3><p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">Enable memory in Settings to retrieve relevant facts across conversations. Review, edit, pin, or delete manual memories there.</p></Surface>
            </div>
          </ManualSection>

          <ManualSection number="05" title="Report or ask for help">
            <p>Use Report on a public character or chat message for moderation. For bugs, suggestions, account questions, or safety concerns, contact support.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild><Link href="/support"><LifeBuoy className="h-4 w-4" />Open support</Link></Button>
              <Button asChild variant="outline"><Link href="/guide/api">Read the API guide</Link></Button>
            </div>
          </ManualSection>
        </div>
      </div>
    </PageShell>
  );
}

function ManualSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-[var(--codex-rule)] pt-8 lg:grid-cols-[160px_minmax(0,1fr)]">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--codex-violet)]">Chapter {number}</p><h2 className="font-editorial mt-2 text-3xl text-[var(--codex-ivory)]">{title}</h2></div>
      <div className="text-sm leading-7 text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}
