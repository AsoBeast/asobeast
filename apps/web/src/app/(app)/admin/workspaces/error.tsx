"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminWorkspacesError({
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
      title="Workspaces could not be loaded"
    />
  );
}
