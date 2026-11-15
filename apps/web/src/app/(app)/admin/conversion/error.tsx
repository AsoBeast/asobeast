"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AdminConversionError({
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
      title="Conversion could not be loaded"
    />
  );
}
