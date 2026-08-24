import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@asobeast/shared";

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|invite|verify|upgrade|api|admin|docs|_next|brand|icons|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
