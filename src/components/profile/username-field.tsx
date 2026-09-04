"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";
import { cn } from "@/lib/utils";

type Availability = "idle" | "checking" | "available" | "unavailable" | "error";

type UsernameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange?: (available: boolean | null) => void;
  currentUsername?: string | null;
  id?: string;
};

export function UsernameField({ value, onChange, onAvailabilityChange, currentUsername, id = "username" }: UsernameFieldProps) {
  const [availability, setAvailability] = useState<Availability>("idle");
  const [message, setMessage] = useState("Your permanent public address.");
  const normalized = normalizeUsername(value);
  const localError = value ? usernameValidationMessage(value) : null;

  useEffect(() => {
    if (!value || localError) {
      setAvailability(value ? "unavailable" : "idle");
      setMessage(localError ?? "Your permanent public address.");
      onAvailabilityChange?.(value ? false : null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAvailability("checking");
      setMessage("Checking availability…");
      onAvailabilityChange?.(null);

      try {
        const response = await fetch(`/api/profile/username?value=${encodeURIComponent(normalized)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not check this username.");

        setAvailability(body.available ? "available" : "unavailable");
        setMessage(body.available ? `nythera.com/u/${body.username} is available.` : body.reason ?? "That username is already taken.");
        onAvailabilityChange?.(Boolean(body.available));
      } catch (error) {
        if (controller.signal.aborted) return;
        setAvailability("error");
        setMessage(error instanceof Error ? error.message : "Could not check this username.");
        onAvailabilityChange?.(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [localError, normalized, onAvailabilityChange, value]);

  const isCurrent = Boolean(currentUsername && normalizeUsername(currentUsername) === normalized);
  const invalid = availability === "unavailable" || availability === "error";

  return (
    <div className="grid gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-sm text-[var(--text-muted)]">@</span>
        <Input
          id={id}
          name="username"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          minLength={3}
          maxLength={24}
          autoComplete="username"
          spellCheck={false}
          aria-describedby={`${id}-status`}
          aria-invalid={invalid}
          className="pl-8 pr-11"
          placeholder="creator_name"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center" aria-hidden>
          {availability === "checking" ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--text-muted)]" /> : null}
          {availability === "available" ? <Check className="h-4 w-4 text-emerald-400" /> : null}
          {invalid ? <X className="h-4 w-4 text-rose-400" /> : null}
        </span>
      </div>
      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn(
          "text-xs normal-case leading-5 tracking-normal",
          availability === "available" && "text-emerald-400",
          invalid && "text-rose-400",
          (availability === "idle" || availability === "checking") && "text-[var(--text-muted)]"
        )}
      >
        {isCurrent && availability === "available" ? "This is your current public address." : message}
      </p>
    </div>
  );
}
