"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function SetupError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState error={error} retry={retry} title="Setup could not be loaded" />
  );
}
