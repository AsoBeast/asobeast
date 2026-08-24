"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function SettingsError({
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
      title="Settings could not be loaded"
    />
  );
}
