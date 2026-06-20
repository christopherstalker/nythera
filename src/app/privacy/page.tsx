import { ShieldCheck } from "lucide-react";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

export default function PrivacyPage() {
  return (
    <PageShell>
      <Surface className="mx-auto max-w-3xl p-6 sm:p-8">
        <PageHeader icon={ShieldCheck} title="Privacy Policy" />
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>Chats, messages, memories, reports, and usage logs are stored to provide continuity, safety, abuse prevention, and billing controls.</p>
        <p>User-supplied provider API keys are encrypted server-side. Browser clients never receive saved OpenAI, Anthropic, Gemini, DeepSeek, Redis, or database credentials.</p>
        <p>Production deployments should enable export, deletion, retention limits, and regional compliance workflows before opening public signups.</p>
      </div>
      </Surface>
    </PageShell>
  );
}
