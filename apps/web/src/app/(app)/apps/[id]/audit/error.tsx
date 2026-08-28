"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function AuditError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState error={error} retry={retry} title="Audit could not be loaded" />
  );
}
