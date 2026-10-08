export const PUBLIC_ROUTES = ["/login", "/register", "/upgrade"] as const;

const PLACEHOLDER_ORIGIN = "http://placeholder";

export function isPublicRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname);
}

export function signedInDestination(next: string | null | undefined): string {
  if (!next) return "/";
  try {
    const resolved = new URL(next, PLACEHOLDER_ORIGIN);
    if (resolved.origin !== PLACEHOLDER_ORIGIN) return "/";
    const { pathname, search, hash } = resolved;
    if (pathname.startsWith("//") || isPublicRoute(pathname)) return "/";
    return `${pathname}${search}${hash}`;
  } catch {
    return "/";
  }
}
