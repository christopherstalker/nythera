"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

type OAuthButtonsProps = {
  intent: "login" | "register";
};

export function OAuthButtons({ intent }: OAuthButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const label = intent === "register" ? "Sign up with Google" : "Continue with Google";

  async function handleGoogleSignIn() {
    setIsLoading(true);
    await signIn("google", { callbackUrl: "/explore" });
    setIsLoading(false);
  }

  return (
    <div className="mt-7 space-y-5">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full border-white/[0.035] bg-white/[0.032] text-foreground hover:border-primary/[0.16] hover:bg-primary/[0.07]"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-[#1f1835]">G</span>
        {isLoading ? "Opening Google..." : label}
      </Button>
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-px flex-1 bg-white/[0.055]" />
        <span>or use email</span>
        <span className="h-px flex-1 bg-white/[0.055]" />
      </div>
    </div>
  );
}
