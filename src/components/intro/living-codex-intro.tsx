"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { checkWebGLSupportAndCapability } from "@/lib/webgl-capability";
import { cn } from "@/lib/utils";

const INTRO_DURATION_MS = 2200;
const INTRO_EXIT_MS = 330;
const REDUCED_MOTION_DURATION_MS = 420;

const LivingCodexScene = dynamic(
  () => import("@/components/intro/living-codex-scene").then((module) => module.LivingCodexScene),
  { ssr: false, loading: () => <LivingCodexStaticMark /> }
);

export function LivingCodexIntro() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canRenderWebGL = checkWebGLSupportAndCapability({ allowTablet: true });
    const duration = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS;
    const exitAt = Math.max(0, duration - INTRO_EXIT_MS);

    setReducedMotion(prefersReducedMotion);
    setWebglReady(canRenderWebGL && !prefersReducedMotion);
    document.documentElement.dataset.livingCodexIntro = "active";

    const exitTimer = window.setTimeout(() => setLeaving(true), exitAt);
    const removeTimer = window.setTimeout(() => setVisible(false), duration);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
      delete document.documentElement.dataset.livingCodexIntro;
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      delete document.documentElement.dataset.livingCodexIntro;
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      data-living-codex-intro="true"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      className={cn("living-codex-intro fixed inset-0 z-[9000] overflow-hidden", leaving && "is-leaving")}
      role="status"
      aria-label="Opening the Living Codex"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-[var(--codex-paper)]">
        {webglReady ? <LivingCodexScene /> : <LivingCodexStaticMark />}
      </div>

      <div className="living-codex-intro-copy pointer-events-none absolute inset-x-0 bottom-[max(2rem,8svh)] z-10 text-center">
        <p className="codex-kicker text-[var(--codex-mint)]">The archive awakens</p>
        <p className="font-editorial mt-2 text-2xl italic text-[var(--codex-ivory)] sm:text-3xl">
          Opening the Living Codex
        </p>
      </div>

      <div className="living-codex-intro-veil pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}

function LivingCodexStaticMark() {
  return (
    <div className="living-codex-static-mark absolute inset-0 grid place-items-center" aria-hidden="true">
      <div className="living-codex-static-book">
        <div className="living-codex-static-cover living-codex-static-cover-left" />
        <div className="living-codex-static-page living-codex-static-page-left">
          <span />
          <span />
          <span />
        </div>
        <div className="living-codex-static-page living-codex-static-page-right">
          <span />
          <span />
          <span />
        </div>
        <div className="living-codex-static-cover living-codex-static-cover-right" />
        <div className="living-codex-static-spine" />
      </div>
    </div>
  );
}
