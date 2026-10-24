"use client";

import { ErrorState } from "@/components/layout/ErrorState";

export default function PlaySignInError({
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
      title="The Google sign in could not be finished"
    />
  );
}
