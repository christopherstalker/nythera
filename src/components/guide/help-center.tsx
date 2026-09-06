"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, KeyRound, LifeBuoy, PenLine } from "lucide-react";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";

const topics = [
  {
    href: "/guide/platform",
    icon: PenLine,
    title: "Create characters & stories",
    text: "Characters, chats, branches, personas and group rooms."
  },
  {
    href: "/guide/api",
    icon: KeyRound,
    title: "Connect an AI model",
    text: "API keys, providers, models and connection troubleshooting."
  },
  {
    href: "/guide/roleplay-formatting",
    icon: BookOpen,
    title: "Format your writing",
    text: "Dialogue, actions, emphasis, quotes and rich text."
  },
  { href: "/support", icon: LifeBuoy, title: "Contact support", text: "Report a bug or get help with your account." }
];
const questions = [
  {
    question: "Where can I review saved memories?",
    answer:
      "Open Memory & privacy in Settings to review saved facts, add a manual memory, pin something important or remove a memory you no longer want to keep.",
    href: "/settings/memory",
    label: "Review memories"
  },
  {
    question: "How do I start my first chat?",
    answer:
      "Open Discover, choose a character and start a conversation. Existing conversations are in Chats; the sidebar takes you to the latest conversation with each character.",
    href: "/explore",
    label: "Discover characters"
  },
  {
    question: "Why is my AI model not responding?",
    answer:
      "Check that your provider key is saved, the selected model is available to your provider account, and the provider has credit or quota. Open Model providers to review your connection and fallback order.",
    href: "/settings/providers",
    label: "Model providers"
  },
  {
    question: "What is the difference between my profile and a persona?",
    answer:
      "Your profile is your public identity. A persona describes who you play inside a conversation. You can use different personas for different stories.",
    href: "/settings/personas",
    label: "Manage personas"
  },
  {
    question: "Can I try another direction without losing my story?",
    answer:
      "Use Branch in the message actions to copy the story up to that point into a separate chat. Your original conversation remains available.",
    href: "/guide/platform",
    label: "Read about chat controls"
  },
  {
    question: "How do I create a group conversation?",
    answer:
      "Open Rooms, choose two to six characters in the cast builder, give the room an optional name and select Create room.",
    href: "/rooms",
    label: "Open rooms"
  }
];

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matchingTopics = topics.filter((topic) => `${topic.title} ${topic.text}`.toLowerCase().includes(needle));
  const matchingQuestions = questions.filter((item) =>
    `${item.question} ${item.answer}`.toLowerCase().includes(needle)
  );
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-sm text-[var(--codex-mint)]">Nythera help center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">How can we help?</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Find a quick answer or learn something new about your stories.
        </p>
      </header>
      <SearchBar value={query} onChange={setQuery} placeholder="Search help: API keys, characters, memory…" />
      {needle ? (
        <p role="status" className="text-xs text-[var(--text-muted)]">
          {matchingTopics.length + matchingQuestions.length}{" "}
          {matchingTopics.length + matchingQuestions.length === 1 ? "result" : "results"}
        </p>
      ) : null}
      {matchingTopics.length ? (
        <section aria-label="Help topics" className="grid gap-3 sm:grid-cols-2">
          {matchingTopics.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="focus-ring group flex gap-4 rounded-2xl border border-[var(--codex-rule)] bg-[var(--bg-elevated)] p-5 no-underline hover:border-[var(--codex-mint)]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bg-input)] text-[var(--codex-mint)]">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-base font-semibold">{title}</span>
                <span className="mt-2 block text-sm leading-6 text-[var(--text-secondary)]">{text}</span>
              </span>
            </Link>
          ))}
        </section>
      ) : null}
      {matchingQuestions.length ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Quick answers</h2>
          <div className="divide-y divide-[var(--codex-rule)] rounded-2xl border border-[var(--codex-rule)] bg-[var(--bg-elevated)]">
            {matchingQuestions.map((item) => (
              <details key={item.question} className="px-5">
                <summary className="focus-ring cursor-pointer py-4 text-sm font-medium">{item.question}</summary>
                <p className="pb-3 text-sm leading-6 text-[var(--text-secondary)]">{item.answer}</p>
                <Link
                  href={item.href}
                  className="focus-ring mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-[var(--codex-mint)]"
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </details>
            ))}
          </div>
        </section>
      ) : null}
      {!matchingTopics.length && !matchingQuestions.length ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[var(--codex-rule)] p-8 text-center">
          <p>No answers match your search.</p>
          <Button variant="outline" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--codex-rule)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Still need a hand?</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Send us a question or tell us what went wrong.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/support">Contact support</Link>
        </Button>
      </div>
    </div>
  );
}
