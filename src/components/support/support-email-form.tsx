"use client";

import { FormEvent, useState } from "react";
import { Copy, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL,
  supportCategoryLabel,
  type SupportCategory
} from "@/lib/support";

export function SupportEmailForm() {
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function openEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryLabel = supportCategoryLabel(category);
    const emailSubject = `[Nythera ${categoryLabel}] ${subject.trim()}`;
    const emailBody = [
      `Category: ${categoryLabel}`,
      replyTo.trim() ? `Reply-to: ${replyTo.trim()}` : null,
      `Page: ${window.location.origin}`,
      "",
      details.trim()
    ]
      .filter((line) => line !== null)
      .join("\n");

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    setStatus("Your email app is opening with the request filled in.");
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    setStatus(`${SUPPORT_EMAIL} copied.`);
  }

  return (
    <form onSubmit={openEmail} className="grid gap-6" aria-describedby="support-form-note">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--text-secondary)]">
          Request type
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SupportCategory)}
            className="focus-ring glass-input h-12 w-full px-4 text-sm text-[var(--text-primary)]"
          >
            {SUPPORT_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-[var(--text-secondary)]">
          Your email (optional)
          <Input type="email" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="you@example.com" />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-[var(--text-secondary)]">
        Subject
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={120} placeholder="What should we know?" required />
      </label>

      <label className="grid gap-2 text-sm text-[var(--text-secondary)]">
        Details
        <Textarea value={details} onChange={(event) => setDetails(event.target.value)} minLength={10} maxLength={4000} className="min-h-56" placeholder="Describe what happened, what you expected, and how to reproduce it. Never include API keys or passwords." required />
      </label>

      <p id="support-form-note" className="text-xs leading-5 text-[var(--text-muted)]">
        This opens your email app and sends directly to {SUPPORT_EMAIL}. Never include passwords, provider keys, or private authentication codes.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={subject.trim().length < 3 || details.trim().length < 10}>
          <Send className="h-4 w-4" />
          Prepare email
        </Button>
        <Button type="button" variant="outline" onClick={() => void copyAddress()}>
          <Copy className="h-4 w-4" />
          Copy address
        </Button>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 text-sm text-[var(--codex-mint)] no-underline hover:underline">
          <Mail className="h-4 w-4" />
          {SUPPORT_EMAIL}
        </a>
      </div>

      {status ? <p role="status" className="text-sm text-[var(--codex-mint)]">{status}</p> : null}
    </form>
  );
}
