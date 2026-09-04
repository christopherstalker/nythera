import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/settings/settings-shell";
import { auth } from "@/lib/auth";
import { loginUrl } from "@/lib/auth-routes";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(loginUrl("/settings"));
  }

  return <SettingsShell>{children}</SettingsShell>;
}
