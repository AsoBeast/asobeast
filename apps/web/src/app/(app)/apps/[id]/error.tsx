"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AppDetailError({
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
      title="This app could not be loaded"
    />
  );
}
