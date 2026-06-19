"use client";

import { ChevronDown, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormAccordionSectionProps = {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  open: boolean;
  onToggle: () => void;
  onAssist?: () => void;
  assisting?: boolean;
  children: React.ReactNode;
};

export function FormAccordionSection({
  title,
  description,
  icon: Icon,
  open,
  onToggle,
  onAssist,
  assisting = false,
  children
}: FormAccordionSectionProps) {
  return (
    <section className="glass-panel overflow-hidden">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {Icon ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)]">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <button type="button" onClick={onToggle} className="focus-ring min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
              {description ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")} />
          </div>
        </button>
        {onAssist ? (
          <Button type="button" variant="outline" size="sm" onClick={onAssist} disabled={assisting} className="shrink-0">
            <Sparkles className="h-4 w-4" />
            {assisting ? "Assisting..." : "AI Assist"}
          </Button>
        ) : null}
      </div>

      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="grid gap-4 border-t border-[var(--border-default)] px-4 py-5 sm:px-5">{children}</div>
        </div>
      </div>
    </section>
  );
}