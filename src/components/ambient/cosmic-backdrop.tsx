"use client";

import { AuroraWebglBackground } from "@/components/ambient/aurora-webgl-background";

export function CosmicBackdrop() {
  return (
    <div aria-hidden="true" className="nythera-cosmic-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <AuroraWebglBackground className="absolute inset-0 z-0 opacity-30" />
      <div className="nythera-cosmic-starfield absolute inset-0" />
      <div className="nythera-cosmic-veil absolute inset-0" />
    </div>
  );
}
