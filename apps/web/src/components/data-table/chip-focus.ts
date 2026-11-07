interface Container<T> {
  contains(node: T): boolean;
}

export function lastControlBefore<T>(
  controls: readonly T[],
  list: Container<T>,
  isShown: (control: T) => boolean,
): T | null {
  const inList = controls.findIndex((control) => list.contains(control));
  const before = inList === -1 ? controls : controls.slice(0, inList);
  return before.findLast(isShown) ?? null;
}
