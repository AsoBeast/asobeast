"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function InspectError({
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
      title="Keyword inspections could not be loaded"
    />
  );
}
