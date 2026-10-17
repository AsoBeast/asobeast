import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@asobeast/shared";
import { loginUrl, REQUESTED_PATH_HEADER } from "@/lib/auth-routes";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
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
  ],
};
