import Link from "next/link";
import { BookOpen, LifeBuoy } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Button } from "@/components/ui/button";

export default function HelpSettingsPage() {
  return (
    <div>
      <SettingsPageHeader icon={LifeBuoy} title="Help & support" description="Find product guidance or prepare a support request without searching through account controls." />
      <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
        Read the platform and API manuals, or prepare a support email for a bug, suggestion, account question, or safety concern.
      </p>
      <div className="mt-5 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
        <Button asChild variant="outline"><Link href="/guide"><BookOpen className="h-4 w-4" />Open manuals</Link></Button>
        <Button asChild><Link href="/support"><LifeBuoy className="h-4 w-4" />Contact support</Link></Button>
      </div>
    </div>
  );
}
