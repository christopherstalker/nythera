import { AccountHubClient } from "@/components/account/account-hub-client";
import "@/components/account/account-hub.css";
import { PageShell } from "@/components/ui/page";

export default function AccountPage() {
  return (
    <PageShell className="codex-workspace account-page min-w-0 max-w-full">
      <AccountHubClient />
    </PageShell>
  );
}
