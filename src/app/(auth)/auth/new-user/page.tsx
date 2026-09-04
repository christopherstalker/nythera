import { redirect } from "next/navigation";
import { AdultConsentClient } from "@/components/auth/adult-consent-client";
import { auth } from "@/lib/auth";
import { normalizeCallbackPath } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";

export default async function NewUserRedirectPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const callbackPath = normalizeCallbackPath(callbackUrl, "/explore");
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/auth/new-user?callbackUrl=${encodeURIComponent(callbackPath)}`)}`);
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { adultTermsAcceptedAt: true }
  });

  if (!user) {
    redirect("/login");
  }

  const afterPasswordPath = callbackPath.startsWith("/auth/pwa/complete?transactionId=")
    ? callbackPath
    : `/tutorial?callbackUrl=${encodeURIComponent(callbackPath)}`;
  const passwordSetupPath = `/register/password?callbackUrl=${encodeURIComponent(afterPasswordPath)}`;

  if (!user.adultTermsAcceptedAt) {
    return <AdultConsentClient callbackPath={passwordSetupPath} />;
  }

  redirect(passwordSetupPath);
}
