"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AppActionsError({
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
      title="Actions could not be loaded"
    />
  );
}
