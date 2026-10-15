export function literalOf<T extends string>(
  values: readonly T[],
  value: string,
): T | undefined {
  return values.find((candidate) => candidate === value);
}
