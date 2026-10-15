"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function ChartsError({
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
      title="Top charts could not be loaded"
    />
  );
}
