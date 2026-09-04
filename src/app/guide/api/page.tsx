import type { Metadata } from "next";
import Link from "next/link";
import { Braces, CheckCircle2, KeyRound, LockKeyhole, Route, Settings2 } from "lucide-react";
import { GuideNavigation } from "@/components/guide/guide-navigation";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { FIRST_CLASS_PROVIDER_PRESETS } from "@/lib/provider-presets";

export const metadata: Metadata = {
  title: "Nythera API connection guide",
  description: "Connect AI provider API keys and OpenAI-compatible endpoints to Nythera safely.",
  alternates: { canonical: "/guide/api" }
};

export default function ApiGuidePage() {
  return (
    <PageShell className="pb-24">
      <div className="mx-auto max-w-6xl">
        <GuideNavigation current="/guide/api" />
        <PageHeader icon={Braces} title="API connections" description="Connect the model providers you already use. Nythera routes character generation and chat through your encrypted provider keys." />

        <Surface className="mt-10 border-[var(--codex-violet)]/30 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--codex-violet)]">Important distinction</p>
          <h2 className="font-editorial mt-2 text-3xl text-[var(--codex-ivory)]">Provider APIs, not a public Nythera REST API</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">This manual explains how to connect OpenAI, Anthropic, Gemini, DeepSeek, xAI, and compatible endpoints. Nythera&apos;s internal application routes are not a supported public developer API.</p>
        </Surface>

        <div className="mt-10 grid gap-10">
          <ApiStep icon={KeyRound} number="01" title="Save a provider key">
            <p>Open Settings → API Keys, select a provider, paste the key issued by that provider, and save it. The browser never receives the stored key again.</p>
            <Button asChild className="mt-5"><Link href="/settings/providers">Open API Keys</Link></Button>
          </ApiStep>

          <ApiStep icon={CheckCircle2} number="02" title="Supported provider presets">
            <div className="grid gap-px bg-[var(--codex-rule)] sm:grid-cols-2 lg:grid-cols-3">
              {FIRST_CLASS_PROVIDER_PRESETS.map((provider) => (
                <article key={provider.provider} className="bg-[var(--codex-paper)] p-5">
                  <p className="font-medium text-[var(--codex-ivory)]">{provider.displayName}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">Default: {provider.defaultModel}</p>
                </article>
              ))}
            </div>
          </ApiStep>

          <ApiStep icon={Route} number="03" title="Use fallback routing">
            <p>Arrange saved providers, choose an exact model for each step, and move any provider into the primary position. Nythera advances past exhausted or invalid credentials and skips directly to the next provider during an outage; malformed requests still stop immediately.</p>
          </ApiStep>

          <ApiStep icon={Settings2} number="04" title="Connect a custom endpoint">
            <p>Use Add custom provider endpoint for an OpenAI-compatible service. Enter a unique provider ID, display name, base URL, default model, and API key. The endpoint must implement the OpenAI chat-completions request shape.</p>
            <pre className="mt-5 overflow-x-auto border-y border-[var(--codex-rule)] py-4 font-mono text-xs leading-6 text-[var(--codex-mint)]">{`Base URL: https://your-provider.example/v1\nModel: your-model-id\nFormat: OpenAI compatible`}</pre>
          </ApiStep>

          <ApiStep icon={LockKeyhole} number="05" title="Security and troubleshooting">
            <ul className="grid gap-3">
              <li>Keys are encrypted server-side and omitted from API responses.</li>
              <li>Never paste a key into chat, character text, support requests, screenshots, or public repositories.</li>
              <li>A 401 normally means the provider rejected the credential; create a new key at that provider.</li>
              <li>A 429 means the provider or Nythera rate limit was reached; wait and retry or enable fallback.</li>
              <li>For custom endpoints, verify the base URL, model ID, HTTPS certificate, and chat-completions compatibility.</li>
            </ul>
          </ApiStep>
        </div>
      </div>
    </PageShell>
  );
}

function ApiStep({ icon: Icon, number, title, children }: { icon: typeof Braces; number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-[var(--codex-rule)] pt-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div><Icon className="h-5 w-5 text-[var(--codex-mint)]" /><p className="mt-4 text-xs font-semibold uppercase tracking-[.2em] text-[var(--codex-violet)]">Step {number}</p><h2 className="font-editorial mt-2 text-3xl text-[var(--codex-ivory)]">{title}</h2></div>
      <div className="text-sm leading-7 text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}
