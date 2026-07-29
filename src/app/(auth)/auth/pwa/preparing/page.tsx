import { LoaderCircle } from "lucide-react";
import { PwaAuthFrame } from "@/components/auth/pwa-auth-frame";

export default function PwaAuthPreparingPage() {
  return (
    <PwaAuthFrame>
      <LoaderCircle className="h-6 w-6 animate-spin text-[var(--accent-mint)]" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        Opening registration
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        Your selected provider will open automatically.
      </p>
    </PwaAuthFrame>
  );
}
