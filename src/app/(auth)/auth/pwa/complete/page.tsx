import Link from "next/link";
import { AuthExperience } from "@/components/auth/auth-experience";
import { PwaOAuthComplete } from "@/components/auth/pwa-oauth-complete";

export default async function PwaAuthCompletePage({
  searchParams
}: {
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const { transactionId = "" } = await searchParams;
  const validTransactionId = /^[A-Za-z0-9_-]{32}$/.test(transactionId);

  return (
    <AuthExperience
      mode="login"
      footer={<Link href="/">Return to Nythera</Link>}
    >
      {validTransactionId ? (
        <PwaOAuthComplete transactionId={transactionId} />
      ) : (
        <>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Sign-in request unavailable
          </h2>
          <p className="mt-3 border-l border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            This secure sign-in request is invalid or has expired.
          </p>
        </>
      )}
    </AuthExperience>
  );
}
