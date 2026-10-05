"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminAppsError({
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
      title="Tracked apps could not be loaded"
    />
  );
}
