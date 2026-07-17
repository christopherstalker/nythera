import { ShieldCheck } from "lucide-react";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

export default function PrivacyPage() {
  return (
    <PageShell className="codex-legal">
      <Surface className="mx-auto max-w-4xl !border-x-0 !bg-transparent p-0">
        <PageHeader icon={ShieldCheck} title="Privacy Policy" />
        <div className="font-editorial mt-8 grid text-lg leading-8 text-muted-foreground">
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">01</span>Chats, messages, memories, reports, and usage logs are stored to provide continuity, safety, abuse prevention, and billing controls.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">02</span>User-supplied provider API keys are encrypted server-side. Browser clients never receive saved OpenAI, Anthropic, Gemini, DeepSeek, Redis, or database credentials.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">03</span>Production deployments should enable export, deletion, retention limits, and regional compliance workflows before opening public signups.</p>
      </div>
      </Surface>
    </PageShell>
  );
}
