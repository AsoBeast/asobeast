"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function MetadataError({
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
      title="Metadata could not be loaded"
    />
  );
}
