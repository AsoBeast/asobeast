"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function CompetitorsError({
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
      title="Competitors could not be loaded"
    />
  );
}
