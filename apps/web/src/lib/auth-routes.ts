export const PUBLIC_ROUTES = ["/login", "/register", "/upgrade"] as const;

export function isPublicRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(pathname);
}
