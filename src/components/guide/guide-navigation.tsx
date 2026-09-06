import Link from "next/link";
import { BookOpen, Braces, LifeBuoy, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const guideLinks = [
  { href: "/guide", label: "Guide home", icon: BookOpen },
  { href: "/guide/platform", label: "Platform", icon: PenLine },
  { href: "/guide/api", label: "API connections", icon: Braces },
  { href: "/guide/roleplay-formatting", label: "Formatting", icon: BookOpen },
  { href: "/support", label: "Support", icon: LifeBuoy }
] as const;

export function GuideNavigation({ current }: { current: string }) {
  return (
    <nav aria-label="Help center" className="scrollbar-none mb-6 flex gap-2 overflow-x-auto py-2">
      {guideLinks.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? "page" : undefined}
            className={cn(
              "focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] no-underline transition-colors hover:bg-[var(--bg-input)] hover:text-[var(--codex-ivory)]",
              current === item.href && "bg-[var(--color-overlay)] text-[var(--codex-mint)]"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
