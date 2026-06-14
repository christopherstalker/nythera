import { Download, Paintbrush, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";
import { PageHeader, PageShell, Surface, SurfaceMuted } from "@/components/ui/page";

export default function SettingsPage() {
  return (
    <PageShell className="space-y-10">
      <PageHeader
        icon={Settings}
        title="Keys and settings"
        description="Manage secure model access, profile details, theme, and account data from one calm place."
      />
      <div className="grid gap-7 xl:grid-cols-2 xl:items-start">
        <KeySettingsClient />

        <Surface className="p-6">
          <div className="flex items-start gap-3">
            <Paintbrush className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Theme</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Switch the base UI while keeping the same soft Velora accent system.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">Dark is optimized for long chats.</span>
          </div>
        </Surface>

        <ProfileSettingsClient />

        <Surface className="p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#8fd8c2]" />
            <div>
              <h2 className="font-semibold">Data rights</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Export and deletion flows are separate from model keys. Production should process these through background jobs.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SurfaceMuted className="p-5">
              <p className="text-sm font-semibold text-foreground">Export account data</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Download chats, character metadata, and profile settings.</p>
              <Button variant="outline" className="mt-4">
                <Download className="h-4 w-4" />
                Export data
              </Button>
            </SurfaceMuted>
            <SurfaceMuted className="p-5">
              <p className="text-sm font-semibold text-foreground">Delete account</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Request deletion for profile, chats, memories, and keys.</p>
              <Button variant="destructive" className="mt-4">
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
            </SurfaceMuted>
          </div>
        </Surface>
      </div>
    </PageShell>
  );
}
