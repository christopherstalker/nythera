import { AccountHubClient } from "@/components/account/account-hub-client";
import { PageShell } from "@/components/ui/page";

export default function AccountPage() {
  return (
    <PageShell className="max-w-[1180px] px-0 sm:px-5 lg:px-8">
      <AccountHubClient />
    </PageShell>
  );
}
