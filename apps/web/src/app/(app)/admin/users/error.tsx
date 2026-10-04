"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminUsersError({
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
      title="Accounts could not be loaded"
    />
  );
}
