"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AlertsError({
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
      title="Alerts could not be loaded"
    />
  );
}
