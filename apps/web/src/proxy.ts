import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@asobeast/shared";
import {
  isProxiedSurface,
  refuseMalformedPath,
  undecodableSegment,
} from "@/lib/api/malformed-path";
import { loginUrl, REQUESTED_PATH_HEADER } from "@/lib/auth-routes";

const SERVER_ACTION_HEADER = "next-action";

function refuseServerAction(): Response {
  return new Response("Server action not found.", {
    status: 404,
    headers: {
      "content-type": "text/plain",
      "x-nextjs-action-not-found": "1",
    },
  });
}

export function proxy(request: NextRequest) {
  if (request.headers.has(SERVER_ACTION_HEADER)) return refuseServerAction();
  const { pathname, search } = request.nextUrl;
  const malformed = undecodableSegment(pathname);
  if (malformed !== null) return refuseMalformedPath(request, malformed);
  if (isProxiedSurface(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) {
    const headers = new Headers(request.headers);
    headers.set(REQUESTED_PATH_HEADER, `${pathname}${search}`);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.redirect(
    new URL(loginUrl(pathname, search), request.url),
  );
}

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|invite|verify|unsubscribe|confirm-alert|api|\\.well-known|admin/queues|metrics|docs|_next|brand|icons|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
    "/(api/backend|docs|admin/queues|\\.well-known)/(.*%(?![0-9A-Fa-f]{2}).*|.*%[89A-Fa-f][0-9A-Fa-f].*)",
    { source: "/:path*", has: [{ type: "header", key: "next-action" }] },
  ],
};
