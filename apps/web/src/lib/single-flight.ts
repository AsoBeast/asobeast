import { useMemo } from "react";

export function sharedFlight<TVariables, TResult>(
  run: (variables: TVariables) => Promise<TResult>,
): (variables: TVariables) => Promise<TResult> {
  let pending: Promise<TResult> | null = null;
  return (variables) => {
    pending ??= run(variables).finally(() => {
      pending = null;
    });
    return pending;
  };
}

export function singleFlight<TVariables>(
  run: (variables: TVariables) => Promise<unknown>,
): (variables: TVariables) => void {
  const shared = sharedFlight(run);
  return (variables) => {
    shared(variables).catch(() => undefined);
  };
}

export function useSharedFlight<TVariables, TResult>(
  run: (variables: TVariables) => Promise<TResult>,
): (variables: TVariables) => Promise<TResult> {
  return useMemo(() => sharedFlight(run), [run]);
}

export function useSingleFlight<TVariables>(mutation: {
  mutateAsync: (variables: TVariables) => Promise<unknown>;
}): (variables: TVariables) => void {
  const { mutateAsync } = mutation;
  return useMemo(() => singleFlight(mutateAsync), [mutateAsync]);
}
