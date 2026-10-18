export const COLLAPSED_COOKIE_NAME = "asobeast_collapsed";
export const COLLAPSED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const COLLAPSED_VALUE_MAX_CHARS = 1024;

const SEPARATOR = ",";

export function parseCollapsed(
  value: string | undefined,
  known: readonly string[],
): ReadonlySet<string> {
  if (value === undefined || value.length > COLLAPSED_VALUE_MAX_CHARS) {
    return new Set();
  }
  return new Set(
    value
      .split(SEPARATOR)
      .map((id) => id.trim())
      .filter((id) => known.includes(id)),
  );
}

export function serializeCollapsed(
  collapsed: ReadonlySet<string>,
  known: readonly string[],
): string {
  return known.filter((id) => collapsed.has(id)).join(SEPARATOR);
}

export function withSection(
  collapsed: ReadonlySet<string>,
  section: string,
  open: boolean,
): ReadonlySet<string> {
  const next = new Set(collapsed);
  if (open) next.delete(section);
  else next.add(section);
  return next;
}

export function collapsedCookie(value: string): string {
  const maxAge = value === "" ? 0 : COLLAPSED_COOKIE_MAX_AGE;
  return `${COLLAPSED_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function readCollapsedCookie(cookieString: string): string | undefined {
  for (const pair of cookieString.split(";")) {
    const separator = pair.indexOf("=");
    if (
      separator > 0 &&
      pair.slice(0, separator).trim() === COLLAPSED_COOKIE_NAME
    ) {
      try {
        return decodeURIComponent(pair.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
