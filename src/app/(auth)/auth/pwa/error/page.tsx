import { AlertCircle } from "lucide-react";
import { PwaAuthFrame } from "@/components/auth/pwa-auth-frame";

const ERROR_COPY = {
  expired: {
    title: "Registration link expired",
    detail: "Return to the installed Nythera app and start registration again."
  },
  unavailable: {
    title: "Registration is temporarily unavailable",
    detail: "Return to Nythera and try your provider again in a moment."
  }
} as const;

export default async function PwaAuthErrorPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = reason === "expired" ? ERROR_COPY.expired : ERROR_COPY.unavailable;

  return (
    <PwaAuthFrame>
      <AlertCircle className="h-6 w-6 text-destructive" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        {copy.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        {copy.detail}
      </p>
    </PwaAuthFrame>
  );
}
