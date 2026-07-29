import Link from "next/link";
import { AuthExperience } from "@/components/auth/auth-experience";

export default function PwaAuthPreparingPage() {
  return (
    <AuthExperience
      mode="login"
      footer={<Link href="/login">Return to regular sign-in</Link>}
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Preparing secure sign-in
      </h2>
      <p className="mt-3 border-l border-[var(--accent-mint)] bg-white/[0.025] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        Keep this window open. Your provider will appear here in a moment.
      </p>
    </AuthExperience>
  );
}
