"use client";

import { useEffect } from "react";
import { ServiceUnavailable } from "@/components/system/service-unavailable";
import { PageShell } from "@/components/ui/page";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Unhandled route error", error);
  }, [error]);

  return (
    <PageShell>
      <ServiceUnavailable
        title="This page lost its connection"
        description="Nythera hit a temporary server problem while loading this page. Your story is safe; retry the request or return home."
        onRetry={reset}
      />
    </PageShell>
  );
}
