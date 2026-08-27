"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function ChangesError({
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
      title="Change timeline could not be loaded"
    />
  );
}
