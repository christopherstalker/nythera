import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loginUrl } from "@/lib/auth-routes";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(loginUrl("/settings"));
  }

  return children;
}
