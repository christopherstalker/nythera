import Image from "next/image";
import Link from "next/link";
import { BRAND_ICON_SMALL } from "@/lib/brand";

export function PwaAuthFrame({
  children,
  returnHref = "/login",
  returnLabel = "Return to Nythera"
}: {
  children: React.ReactNode;
  returnHref?: string;
  returnLabel?: string;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)] px-6 py-10">
      <main className="w-full max-w-sm border-y border-[var(--border-default)] py-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-3 no-underline"
        >
          <span className="brand-mark-shell h-11 w-11">
            <Image
              src={BRAND_ICON_SMALL}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
            />
          </span>
          <span className="text-sm font-semibold tracking-[0.22em] text-[var(--text-primary)]">
            NYTHERA
          </span>
        </Link>

        <div className="mt-8">{children}</div>

        <div className="mt-7 border-t border-[var(--border-default)] pt-5">
          <Link
            href={returnHref}
            className="text-sm text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]"
          >
            {returnLabel}
          </Link>
        </div>
      </main>
    </div>
  );
}
