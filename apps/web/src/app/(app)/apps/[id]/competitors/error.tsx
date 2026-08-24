"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function CompetitorsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      error={error}
      retry={unstable_retry}
      title="Competitors could not be loaded"
    />
  );
}
