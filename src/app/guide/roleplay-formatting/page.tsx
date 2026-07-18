import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Keyboard, Layers3, Sparkles } from "lucide-react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { FormattingPlayground } from "@/components/rich-text/formatting-playground";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { RICH_TEXT_FORMATS } from "@/lib/rich-text-formatting";

export const metadata: Metadata = {
  title: "Roleplay formatting guide · Nythera",
  description: "Learn how to format roleplay posts, dialogue, actions, subtext, and character subtitles in Nythera."
};

const POST_EXAMPLES = [
  {
    title: "Action and dialogue",
    source: '*She closes the archive and looks up.*\n> You came back. **Why?**'
  },
  {
    title: "Layered emphasis",
    source: '**He answers *almost silently*, but ==without hesitation==.**'
  },
  {
    title: "Character subtitle",
    source: '(Keeper of forgotten names)'
  }
];

export default function RoleplayFormattingGuidePage() {
  return (
    <PageShell className="codex-formatting-guide pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Nythera
            </Link>
          </Button>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-[var(--codex-violet)]">Writer&apos;s manual</p>
        <PageHeader
          icon={BookOpen}
          title="Format a roleplay post"
          description="Use lightweight punctuation to shape actions, dialogue, emphasis, and subtext. The same rules work in chat messages, edited posts, character subtitles, and opening messages."
        />

        <FormattingPlayground />

        <div className="mt-10 grid gap-10">
          <section aria-labelledby="syntax-heading">
            <div className="mb-5 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-[var(--codex-mint)]" />
              <h2 id="syntax-heading" className="font-editorial text-3xl text-[var(--codex-ivory)]">Formatting syntax</h2>
            </div>
            <div className="grid border-t border-[var(--codex-rule)] lg:grid-cols-2">
              {RICH_TEXT_FORMATS.map((format, index) => (
                <article
                  key={format.id}
                  className={`grid gap-4 border-b border-[var(--codex-rule)] py-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:px-6 ${index % 2 === 0 ? "lg:border-r" : ""}`}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--codex-violet)]">{format.label}</p>
                    <code className="mt-2 block break-words font-mono text-sm text-[var(--codex-mint)]">{format.syntax}</code>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{format.description}</p>
                  </div>
                  <div className="border-l-2 border-[var(--border-subtle)] pl-4">
                    <p className="mb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--text-muted)]">Rendered</p>
                    <RichMessageText
                      text={format.id === "quote" ? `> ${format.example}` : `${format.start}${format.example}${format.end}`}
                      className="font-editorial text-xl leading-8 text-[var(--codex-ivory)]"
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]" aria-labelledby="examples-heading">
            <Surface className="p-6 sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <Layers3 className="h-5 w-5 text-[var(--codex-mint)]" />
                <h2 id="examples-heading" className="font-editorial text-3xl text-[var(--codex-ivory)]">Complete examples</h2>
              </div>
              <div className="grid gap-6">
                {POST_EXAMPLES.map((example) => (
                  <article key={example.title} className="grid gap-3 border-t border-[var(--codex-rule)] pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--text-muted)]">{example.title} · source</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-6 text-[var(--codex-mint)]">{example.source}</pre>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--text-muted)]">Result</p>
                      <RichMessageText text={example.source} className="mt-2 font-editorial text-lg leading-7 text-[var(--codex-ivory)]" />
                    </div>
                  </article>
                ))}
              </div>
            </Surface>

            <div className="grid content-start gap-5">
              <Surface className="p-6">
                <div className="flex items-center gap-3">
                  <Keyboard className="h-5 w-5 text-[var(--codex-violet)]" />
                  <h2 className="font-editorial text-2xl text-[var(--codex-ivory)]">Shortcuts</h2>
                </div>
                <dl className="mt-5 grid gap-3 text-sm">
                  <Shortcut keys="Ctrl / Cmd + B" label="Bold" />
                  <Shortcut keys="Ctrl / Cmd + I" label="Italic" />
                  <Shortcut keys="Ctrl / Cmd + U" label="Underline" />
                  <Shortcut keys="Shift + Enter" label="New line in chat" />
                </dl>
              </Surface>

              <Surface className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--codex-violet)]">Literal punctuation</p>
                <h2 className="font-editorial mt-2 text-2xl text-[var(--codex-ivory)]">Escape a marker</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  Put a backslash before punctuation when it should remain visible: <code className="text-[var(--codex-mint)]">\*literal stars\*</code> or <code className="text-[var(--codex-mint)]">\(literal brackets\)</code>.
                </p>
              </Surface>

              <Surface className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--codex-violet)]">Character setup</p>
                <h2 className="font-editorial mt-2 text-2xl text-[var(--codex-ivory)]">Subtitle rule</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  The Essence field keeps its editable source, while character cards and profiles render the finished typography. Stars and formatting brackets never appear in the public subtitle.
                </p>
              </Surface>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-3">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd><kbd className="rounded-md border border-[var(--border-subtle)] bg-[var(--color-overlay)] px-2 py-1 font-mono text-xs text-[var(--text-primary)]">{keys}</kbd></dd>
    </div>
  );
}
