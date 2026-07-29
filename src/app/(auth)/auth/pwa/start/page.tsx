import Link from "next/link";
import { headers } from "next/headers";
import { AuthExperience } from "@/components/auth/auth-experience";
import { PwaOAuthStart } from "@/components/auth/pwa-oauth-start";
import { OAUTH_PROVIDER_META } from "@/lib/oauth-providers";
import {
  getPwaAuthTransactionForStart,
  PwaAuthTransactionError
} from "@/lib/pwa-auth-transactions";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export default async function PwaAuthStartPage({
  searchParams
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId = "" } = await searchParams;
  let transaction: Awaited<ReturnType<typeof getPwaAuthTransactionForStart>> | null = null;
  let message = "Secure sign-in is temporarily unavailable.";

  try {
    const requestHeaders = await headers();
    await enforceRateLimit({
      ip:
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip"),
      route: "auth:pwa-start"
    });
    transaction = await getPwaAuthTransactionForStart(transactionId);
  } catch (error) {
    if (error instanceof PwaAuthTransactionError) {
      message = error.message;
    }
  }

  if (transaction) {
    const provider = OAUTH_PROVIDER_META[transaction.provider];
    return (
      <AuthExperience
        mode="login"
        footer={<Link href="/login">Return to regular sign-in</Link>}
      >
        <PwaOAuthStart
          provider={transaction.provider}
          providerLabel={provider.shortLabel}
          transactionId={transactionId}
        />
      </AuthExperience>
    );
  }

  return (
    <AuthExperience
      mode="login"
      footer={<Link href="/login">Start a new sign-in</Link>}
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Sign-in request unavailable
      </h2>
      <p className="mt-3 border-l border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {message}
      </p>
    </AuthExperience>
  );
}
