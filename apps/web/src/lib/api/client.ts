import type { ApiErrorEnvelope } from "@asobeast/shared";
import { isPublicRoute } from "@/lib/auth-routes";

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

function apiBase(): string {
  return typeof window === "undefined" ? INTERNAL_BASE : "/api/backend";
}

async function serverForwardHeaders(): Promise<Record<string, string>> {
  try {
    const { headers } = await import("next/headers");
    const incoming = await headers();
    const forwarded: Record<string, string> = {};
    const cookie = incoming.get("cookie");
    if (cookie) forwarded.cookie = cookie;
    const authorization = incoming.get("authorization");
    if (authorization) forwarded.authorization = authorization;
    return forwarded;
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  constructor(public readonly envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
  }
}

function isEnvelope(body: unknown): body is ApiErrorEnvelope {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return false;
  }
  const candidate: Partial<Record<keyof ApiErrorEnvelope, unknown>> = body;
  return (
    typeof candidate.statusCode === "number" &&
    typeof candidate.error === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.timestamp === "string"
  );
}

async function errorEnvelope(
  res: Response,
  path: string,
): Promise<ApiErrorEnvelope> {
  const fallback: ApiErrorEnvelope = {
    statusCode: res.status,
    error: res.statusText || "Request Failed",
    message: `The API responded with ${res.status}.`,
    path,
    timestamp: new Date().toISOString(),
  };
  try {
    const body: unknown = await res.json();
    return isEnvelope(body) ? body : fallback;
  } catch {
    return fallback;
  }
}

export function loginUrl(pathname: string, search: string): string {
  const requested = `${pathname}${search}`;
  const url = new URL("/login", "http://placeholder");
  if (requested !== "/") url.searchParams.set("next", requested);
  return `${url.pathname}${url.search}`;
}

function handleAuthRedirect(path: string, status: number): void {
  if (typeof window === "undefined" || path.startsWith("/auth")) return;
  if (isPublicRoute(window.location.pathname)) return;
  if (status === 401) {
    window.location.assign(
      loginUrl(window.location.pathname, window.location.search),
    );
  } else if (status === 402) {
    window.location.assign("/upgrade");
  }
}

function mergeHeaders(
  forwarded: Record<string, string>,
  provided: HeadersInit | undefined,
): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  for (const [name, value] of Object.entries(forwarded)) {
    headers.set(name, value);
  }
  new Headers(provided).forEach((value, name) => headers.set(name, value));
  return headers;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const forwarded =
    typeof window === "undefined" ? await serverForwardHeaders() : {};
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: mergeHeaders(forwarded, init?.headers),
    cache: "no-store",
  });
  if (!res.ok) {
    handleAuthRedirect(path, res.status);
    throw new ApiError(await errorEnvelope(res, path));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RangeParams {
  from?: string;
  to?: string;
}

export interface RankingParams extends RangeParams {
  keywordIds?: string[];
}

export function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
