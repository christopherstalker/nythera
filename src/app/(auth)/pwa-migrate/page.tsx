import Link from "next/link";
import { ArrowRight, Download, ShieldCheck, Trash2 } from "lucide-react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { Button } from "@/components/ui/button";
import { normalizeCallbackPath } from "@/lib/auth-routes";

export default async function PwaMigratePage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = normalizeCallbackPath(next, "/");

  return (
    <AuthExperience
      mode="login"
      footer={
        <span>
          Canonical address: <strong>www.nythera.art</strong>
        </span>
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Move this app to the secure Nythera address
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        This icon was installed from Nythera&apos;s former address. Browsers isolate
        sessions by origin, so the old installation cannot safely receive your new
        account cookie.
      </p>

      <ol className="mt-6 space-y-4">
        <MigrationStep
          icon={Trash2}
          number="01"
          title="Remove the old icon"
          detail="Delete only the old Nythera shortcut from your home screen."
        />
        <MigrationStep
          icon={ShieldCheck}
          number="02"
          title="Open the canonical app"
          detail="Continue on www.nythera.art and sign in once."
        />
        <MigrationStep
          icon={Download}
          number="03"
          title="Install Nythera again"
          detail="Use the install prompt so future sessions and updates stay connected."
        />
      </ol>

      <div className="mt-6 grid gap-2">
        <Button asChild size="lg">
          <Link href={nextPath}>
            Open secure Nythera
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/download">
            <Download className="h-4 w-4" />
            Install canonical app
          </Link>
        </Button>
      </div>
    </AuthExperience>
  );
}

function MigrationStep({
  icon: Icon,
  number,
  title,
  detail
}: {
  icon: typeof Trash2;
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-[var(--border-default)] pt-4">
      <span className="grid h-10 w-10 place-items-center border border-[var(--border-default)] text-[var(--accent-mint)]">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {number}
        </span>
        <span className="mt-1 block text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">
          {detail}
        </span>
      </span>
    </li>
  );
}
