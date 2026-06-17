"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type DesktopAppLinkProps = {
  className?: string;
  collapsed?: boolean;
};

export function DesktopAppLink({ className, collapsed = false }: DesktopAppLinkProps) {
  return (
    <Link
      href="/download"
      className={cn(
        "nav-item hidden w-full border border-white/[0.06] bg-white/[0.03] md:flex",
        className
      )}
      title="Install Nythera app"
    >
      <Download className="h-5 w-5 shrink-0" />
      <span className={cn("min-w-0 truncate md:hidden lg:block", collapsed && "lg:hidden")}>Install app</span>
    </Link>
  );
}
