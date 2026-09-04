"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthExperience } from "@/components/auth/auth-experience";
import { AccountPasswordClient } from "@/components/settings/account-password-client";

export default function RegistrationPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RegistrationPasswordContent />
    </Suspense>
  );
}

function RegistrationPasswordContent() {
  const callbackUrl = useSearchParams().get("callbackUrl") ?? "/explore";
  return (
    <AuthExperience
      mode="register"
      footer={
        <Link
          href="/explore"
          className="font-semibold text-primary no-underline hover:underline"
        >
          Continue with external sign-in only
        </Link>
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Secure your Nythera account
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Create a password for the same account, regardless of which registration
        method you used.
      </p>
      <div className="mt-6">
        <AccountPasswordClient setup callbackUrl={callbackUrl} />
      </div>
    </AuthExperience>
  );
}
