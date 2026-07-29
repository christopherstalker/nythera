import { redirect } from "next/navigation";
import { normalizeCallbackPath } from "@/lib/auth-routes";

export default async function NewUserRedirectPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const callbackPath = normalizeCallbackPath(callbackUrl, "/settings");

  if (callbackPath.startsWith("/auth/pwa/complete?transactionId=")) {
    redirect(callbackPath);
  }

  redirect("/settings");
}
