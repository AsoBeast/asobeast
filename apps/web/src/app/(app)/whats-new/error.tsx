"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function WhatsNewError({
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
      title="What's New could not be loaded"
    />
  );
}
