"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateAuth } from "@/lib/queries";
import { holdSession, SessionNotKeptError } from "@/lib/session";

export function useSessionEntry<T>({
  establish,
  destination = () => "/",
  onFailure,
}: {
  establish: () => Promise<T>;
  destination?: (result: T) => string;
  onFailure?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => holdSession(establish),
    onSuccess: (result) => {
      invalidateAuth(queryClient);
      window.location.replace(destination(result));
    },
    onError: (error) => {
      if (!(error instanceof SessionNotKeptError)) onFailure?.(error);
    },
  });
  return {
    mutation,
    sessionDropped: mutation.error instanceof SessionNotKeptError,
  };
}
