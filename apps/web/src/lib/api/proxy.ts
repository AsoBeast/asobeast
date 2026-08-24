import type { NextRequest } from "next/server";
import type { ApiErrorEnvelope } from "@asobeast/shared";
import { trustedClientAddress } from "./client-address";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const UPSTREAM_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS ?? 30_000);

const FORWARDED_HEADERS = [
  "cookie",
  "authorization",
  "accept",
  "x-correlation-id",
  "stripe-signature",
] as const;

const FORWARDED_HEADER_PREFIX = "mcp-";

const RETURNED_HEADERS = [
  "cache-control",
  "content-disposition",
  "location",
  "x-robots-tag",
  "x-accel-buffering",
] as const;

function requestHeaders(request: NextRequest): Headers {
  const headers = new Headers({
    "content-type": request.headers.get("content-type") ?? "application/json",
  });
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  request.headers.forEach((value, name) => {
    if (name.startsWith(FORWARDED_HEADER_PREFIX)) headers.set(name, value);
  });
  const clientAddress = trustedClientAddress(request);
  if (clientAddress) headers.set("x-forwarded-for", clientAddress);
  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json",
  });
  for (const name of RETURNED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const setCookie of upstream.headers.getSetCookie()) {
    headers.append("set-cookie", setCookie);
  }
  return headers;
}

function unreachable(request: NextRequest, error: unknown): Response {
  const timedOut = error instanceof Error && error.name === "TimeoutError";
  const envelope: ApiErrorEnvelope = {
    statusCode: timedOut ? 504 : 502,
    error: timedOut ? "Gateway Timeout" : "Bad Gateway",
    message: timedOut
      ? "The API did not respond in time."
      : "The API is unreachable.",
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  };
  return Response.json(envelope, { status: envelope.statusCode });
}

export function apiRoute(
  ...segments: string[]
): (request: NextRequest) => Promise<Response> {
  return (request) => proxyToApi(request, segments);
}

export async function proxyToApi(
  request: NextRequest,
  segments: string[],
): Promise<Response> {
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  try {
    const upstream = await fetch(
      `${API_BASE}/${segments.join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: requestHeaders(request),
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream),
    });
  } catch (error) {
    return unreachable(request, error);
  }
}
