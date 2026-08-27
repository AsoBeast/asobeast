"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function SettingsError({
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
      title="Settings could not be loaded"
    />
  );
}
