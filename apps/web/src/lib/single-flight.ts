import { useMemo } from "react";

type Mutate<TVariables> = (
  variables: TVariables,
  options: { onSettled: () => void },
) => void;

export function singleFlight<TVariables>(
  mutate: Mutate<TVariables>,
): (variables: TVariables) => void {
  let inFlight = false;
  return (variables) => {
    if (inFlight) return;
    inFlight = true;
    mutate(variables, {
      onSettled: () => {
        inFlight = false;
      },
    });
  };
}

export function useSingleFlight<TVariables>(mutation: {
  mutate: Mutate<TVariables>;
}): (variables: TVariables) => void {
  const { mutate } = mutation;
  return useMemo(() => singleFlight(mutate), [mutate]);
}
