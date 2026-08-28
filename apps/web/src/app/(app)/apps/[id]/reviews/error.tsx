"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function ReviewsError({
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
      title="Reviews could not be loaded"
    />
  );
}
