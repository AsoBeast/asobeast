"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";

const NOT_IMPLEMENTED = 501;

export function useFieldOutcome(unreachable: string) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function clear() {
    setError(null);
    setNote(null);
  }

  function fail(cause: unknown) {
    if (!(cause instanceof ApiError)) return setError(unreachable);
    if (cause.envelope.statusCode === NOT_IMPLEMENTED) {
      return setNote(cause.envelope.message);
    }
    setError(cause.envelope.message);
  }

  return { error, note, setError, clear, fail };
}
