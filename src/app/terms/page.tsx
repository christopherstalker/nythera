import { FileText } from "lucide-react";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

export default function TermsPage() {
  return (
    <PageShell className="codex-legal">
      <Surface className="mx-auto max-w-4xl !border-x-0 !bg-transparent p-0">
        <PageHeader icon={FileText} title="Terms of Service" />
        <div className="font-editorial mt-8 grid text-lg leading-8 text-muted-foreground">
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">01</span>Nythera is an adult-oriented platform intended only for people aged 18 or older. By creating an account or accepting the adult-access notice, you confirm that you are at least 18.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">02</span>Users are responsible for securing their account and device. Parents and guardians should supervise minors’ internet and device access; the self-declared age gate does not replace that supervision.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">03</span>Users are responsible for the characters and messages they create. Public characters are subject to automated and manual moderation.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">04</span>Do not use this platform for illegal activity, harassment, sexual content involving minors, self-harm encouragement, hate, dangerous instructions, or misleading real-person impersonation.</p>
        <p className="border-b border-[var(--border-default)] py-6"><span className="codex-index mr-5">05</span>AI characters are fictional software outputs. They are not licensed professionals and cannot provide emergency, medical, legal, financial, or psychological services.</p>
      </div>
      </Surface>
    </PageShell>
  );
}
