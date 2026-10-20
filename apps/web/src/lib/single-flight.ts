import { useMemo } from "react";

export function keyedFlight<TVariables, TResult>(
  run: (variables: TVariables) => Promise<TResult>,
  keyOf: (variables: TVariables) => string,
): (variables: TVariables) => Promise<TResult> {
  const pending = new Map<string, Promise<TResult>>();
  return (variables) => {
    const key = keyOf(variables);
    const current = pending.get(key);
    if (current) return current;
    const next = run(variables).finally(() => {
      pending.delete(key);
    });
    pending.set(key, next);
    return next;
  };
}

const ONE_KEY = () => "";

export function sharedFlight<TVariables, TResult>(
  run: (variables: TVariables) => Promise<TResult>,
): (variables: TVariables) => Promise<TResult> {
  return keyedFlight(run, ONE_KEY);
}

export function keyedSingleFlight<TVariables>(
  run: (variables: TVariables) => Promise<unknown>,
  keyOf: (variables: TVariables) => string,
): (variables: TVariables) => void {
  const keyed = keyedFlight(run, keyOf);
  return (variables) => {
    keyed(variables).catch(() => undefined);
  };
}

export function singleFlight<TVariables>(
  run: (variables: TVariables) => Promise<unknown>,
): (variables: TVariables) => void {
  return keyedSingleFlight(run, ONE_KEY);
}

export function useKeyedFlight<TVariables, TResult>(
  run: (variables: TVariables) => Promise<TResult>,
  keyOf: (variables: TVariables) => string,
): (variables: TVariables) => Promise<TResult> {
  return useMemo(() => keyedFlight(run, keyOf), [run, keyOf]);
}

export function useKeyedSingleFlight<TVariables>(
  mutation: {
    mutateAsync: (variables: TVariables) => Promise<unknown>;
  },
  keyOf: (variables: TVariables) => string,
): (variables: TVariables) => void {
  const { mutateAsync } = mutation;
  return useMemo(
    () => keyedSingleFlight(mutateAsync, keyOf),
    [mutateAsync, keyOf],
  );
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
