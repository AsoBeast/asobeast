"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function IntegrationsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      title="Integrations could not be loaded"
    />
  );
}
