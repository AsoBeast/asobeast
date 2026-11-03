import {
  UPGRADE_PATH,
  type AuthUser,
  type PaidPlanName,
} from "@asobeast/shared";

export const PUBLIC_ROUTES = ["/login", "/register"] as const;

const PLACEHOLDER_ORIGIN = "http://placeholder";

export function isPublicRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname);
}

export const REQUESTED_PATH_HEADER = "x-asobeast-requested-path";

export function loginUrl(pathname: string, search: string): string {
  const requested = `${pathname}${search}`;
  const url = new URL("/login", PLACEHOLDER_ORIGIN);
  if (requested !== "/") url.searchParams.set("next", requested);
  return `${url.pathname}${url.search}`;
}

export function signInTarget(requested: string): string | null {
  if (!requested.startsWith("/") || requested.startsWith("//")) return null;
  const { origin, pathname, search } = new URL(requested, PLACEHOLDER_ORIGIN);
  if (origin !== PLACEHOLDER_ORIGIN || isPublicRoute(pathname)) return null;
  return loginUrl(pathname, search);
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

export function entryDestination(
  user: Pick<AuthUser, "entitled">,
  plan: PaidPlanName | null,
): string {
  if (user.entitled) return "/";
  return plan ? `${UPGRADE_PATH}?plan=${plan}` : UPGRADE_PATH;
}
