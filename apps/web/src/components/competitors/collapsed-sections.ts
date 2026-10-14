const PREFIX = "asobeast:competitors:collapsed:";

type Storage = () => Pick<
  globalThis.Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function readCollapsed(storage: Storage, section: string): boolean {
  try {
    return storage().getItem(PREFIX + section) === "1";
  } catch {
    return false;
  }
}

export function writeCollapsed(
  storage: Storage,
  section: string,
  collapsed: boolean,
): void {
  try {
    if (collapsed) storage().setItem(PREFIX + section, "1");
    else storage().removeItem(PREFIX + section);
  } catch {
    return;
  }
}
