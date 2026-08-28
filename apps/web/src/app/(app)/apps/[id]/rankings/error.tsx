"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function RankingsError({
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
      title="Rankings could not be loaded"
    />
  );
}
