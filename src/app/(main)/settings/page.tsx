import { Download, Paintbrush, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KeySettingsClient } from "@/components/settings/key-settings-client";
import { ProfileSettingsClient } from "@/components/settings/profile-settings-client";

export default function SettingsPage() {
  return (
    <div className="container py-8">
      <h1 className="text-[32px] font-bold leading-10 tracking-tight">Keys and settings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Velora is free. You control model access by adding your own provider keys here.
      </p>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <KeySettingsClient />
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
          <div className="flex items-center gap-3">
            <Paintbrush className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Theme</h2>
              <p className="text-sm text-muted-foreground">Switch between dark and light base UI. Violet and red accents stay consistent.</p>
            </div>
          </div>
          <div className="mt-5">
            <ThemeToggle />
          </div>
        </section>
        <ProfileSettingsClient />
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card-glow">
          <h2 className="font-semibold">Data rights</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Export and deletion flows are kept separate from model keys. Production should process these through background jobs.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export data
            </Button>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
