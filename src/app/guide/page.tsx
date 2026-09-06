import type { Metadata } from "next";
import { HelpCenter } from "@/components/guide/help-center";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Nythera help center",
  description: "Learn the Nythera platform, connect AI provider APIs, format roleplay, and contact support.",
  alternates: { canonical: "/guide" }
};

export default function GuideHomePage() {
  return (
    <PageShell className="codex-workspace">
      <div className="mx-auto max-w-5xl">
        <HelpCenter />
      </div>
    </PageShell>
  );
}
