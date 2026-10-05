"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminOverviewError({
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
      scope="admin"
      title="Admin overview could not be loaded"
    />
  );
}
