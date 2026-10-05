"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminCapacityError({
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
      title="Instance capacity could not be loaded"
    />
  );
}
