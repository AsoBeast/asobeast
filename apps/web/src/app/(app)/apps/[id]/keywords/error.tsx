"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function KeywordsError({
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
      title="Keywords could not be loaded"
    />
  );
}
