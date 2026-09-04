import type { Metadata } from "next";
import { CreatorStudioClient } from "@/components/studio/creator-studio-client";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Creator Studio"
};

export default function CreatorStudioPage() {
  return (
    <PageShell className="min-w-0 max-w-[1240px] px-0 sm:px-5 lg:px-8">
      <CreatorStudioClient />
    </PageShell>
  );
}
