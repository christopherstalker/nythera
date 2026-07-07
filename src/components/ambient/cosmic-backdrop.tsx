"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { SpaceBackground } from "@/components/ambient/space-background";
import { checkWebGLSupportAndCapability } from "@/lib/webgl-capability";

const SpaceBackgroundWebGL = dynamic(
  () => import("@/components/ambient/space-background-webgl").then((module) => module.SpaceBackgroundWebGL),
  { ssr: false, loading: () => null }
);

export function CosmicBackdrop() {
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglSupported(checkWebGLSupportAndCapability());
  }, []);

  if (webglSupported === false || webglSupported === null) {
    return <SpaceBackground />;
  }

  return (
    <Suspense fallback={<SpaceBackground />}>
      <SpaceBackgroundWebGL />
    </Suspense>
  );
}
