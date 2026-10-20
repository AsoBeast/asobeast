import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, notFoundRoute } from "./proxy";

const API_SURFACE = "/api/backend/";
const HIDDEN_SURFACES = ["/docs/", "/admin/queues/", "/.well-known/"] as const;
const UNKNOWN_PAGE_PATH = "/malformed-path";

export function isProxiedSurface(pathname: string): boolean {
  return (
    pathname.startsWith(API_SURFACE) ||
    HIDDEN_SURFACES.some((surface) => pathname.startsWith(surface))
  );
}

export function undecodableSegment(pathname: string): string | null {
  for (const segment of pathname.split("/")) {
    try {
      decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }
  return null;
}

export function refuseMalformedPath(
  request: NextRequest,
  segment: string,
): Response {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(API_SURFACE)) {
    return errorResponse(
      request,
      400,
      "Bad Request",
      `Failed to decode param '${segment}'`,
    );
  }
  if (isProxiedSurface(pathname)) return notFoundRoute(request);
  return NextResponse.rewrite(new URL(UNKNOWN_PAGE_PATH, request.url));
}
