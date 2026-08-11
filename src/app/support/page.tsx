import type { Metadata } from "next";
import { Bug, ExternalLink, Heart, Lightbulb, LifeBuoy, ShieldAlert } from "lucide-react";
import { GuideNavigation } from "@/components/guide/guide-navigation";
import { SupportEmailForm } from "@/components/support/support-email-form";
import { GlassButton } from "@/components/ui/GlassButton";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";
import { PATREON_SUPPORT_URL, SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Nythera support",
  description: "Email Nythera support with a bug report, suggestion, account question, or safety concern.",
  alternates: { canonical: "/support" }
};

const requestTypes = [
  { icon: Bug, title: "Bug reports", text: "Include the page, steps, expected result, and what actually happened." },
  { icon: Lightbulb, title: "Suggestions", text: "Describe the user problem and the outcome you would like to see." },
  { icon: LifeBuoy, title: "Account help", text: "Explain the account or sign-in issue without sending passwords or authentication codes." },
  { icon: ShieldAlert, title: "Safety concerns", text: "Use the in-product Report action for a character or message, or email support for a broader concern." }
] as const;

export default function SupportPage() {
  return (
    <PageShell className="pb-24">
      <div className="mx-auto max-w-6xl">
        <GuideNavigation current="/support" />
        <PageHeader icon={LifeBuoy} title="Support" description={`Prepare a structured email for ${SUPPORT_EMAIL}. Choose the request type and include enough detail for someone to reproduce or act on it.`} />

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Surface className="p-6 sm:p-8"><SupportEmailForm /></Surface>
          <aside className="grid content-start gap-px bg-[var(--codex-rule)]">
            {requestTypes.map((type) => {
              const Icon = type.icon;
              return <article key={type.title} className="bg-[var(--codex-paper)] p-5"><Icon className="h-5 w-5 text-[var(--codex-violet)]" /><h2 className="font-editorial mt-3 text-2xl text-[var(--codex-ivory)]">{type.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{type.text}</p></article>;
            })}
          </aside>
        </div>

        <div id="support-nythera" className="mt-8 scroll-mt-24">
          <Surface className="p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <Heart className="h-6 w-6 text-[var(--codex-violet)]" />
                <h2 className="font-editorial mt-4 text-3xl text-[var(--codex-ivory)]">Support Nythera</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                  Nythera is completely free. If you enjoy it and want to support continued development and future improvements, you can join Christopher Stalker on Patreon.
                </p>
              </div>
              <GlassButton asChild variant="glass-patreon" size="lg">
                <a href={PATREON_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                  <Heart className="h-4 w-4" />Patreon<ExternalLink className="h-4 w-4" />
                </a>
              </GlassButton>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  );
}
