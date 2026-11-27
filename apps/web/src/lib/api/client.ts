import { createTranslator } from "next-intl";
import {
  BACKEND_PROXY_PATH,
  UPGRADE_PATH,
  type ApiErrorEnvelope,
} from "@asobeast/shared";
import zhErrors from "../../../messages/zh-CN/errors.json";
import { isPublicRoute, loginUrl } from "@/lib/auth-routes";
import { isLocale, LOCALE_COOKIE_NAME } from "@/lib/locale";
import { writeApiErrorDigest } from "./error-digest";
import { redirectRefusedRender } from "./server-session";

export { loginUrl };

const INTERNAL_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

function apiBase(): string {
  return typeof window === "undefined" ? INTERNAL_BASE : BACKEND_PROXY_PATH;
}

async function serverForwardHeaders(): Promise<Record<string, string>> {
  const { FORWARDED_FOR_HEADER, trustedClientAddress } =
    await import("./client-address");
  try {
    const { headers } = await import("next/headers");
    const incoming = await headers();
    const forwarded: Record<string, string> = {};
    const cookie = incoming.get("cookie");
    if (cookie) forwarded.cookie = cookie;
    const authorization = incoming.get("authorization");
    if (authorization) forwarded.authorization = authorization;
    const clientAddress = trustedClientAddress({ headers: incoming });
    if (clientAddress) forwarded[FORWARDED_FOR_HEADER] = clientAddress;
    return forwarded;
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  readonly digest: string;

  constructor(public readonly envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = "ApiError";
    this.digest = writeApiErrorDigest(envelope);
  }
}

const chineseErrors = createTranslator({
  locale: "zh-CN",
  namespace: "errors",
  messages: { errors: zhErrors },
});

function browserLocale(): "en" | "zh-CN" {
  if (typeof document === "undefined") return "en";
  const rendered = document.documentElement?.lang;
  if (typeof rendered === "string" && isLocale(rendered)) return rendered;
  const pair = document.cookie
    .split(";")
    .map((entry) => entry.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE_NAME);
  const value = pair?.[1];
  return value !== undefined && isLocale(value) ? value : "en";
}

const localizeEnvelope = (
  envelope: ApiErrorEnvelope,
  fallback: string,
): string => {
  const locale = browserLocale();
  if (locale === "en") return envelope.message;
  const t = chineseErrors;
  const retry = t("retryMoment");
  switch (envelope.statusCode) {
    case 401:
      return t("unauthorizedBody");
    case 402:
      return t("paymentRequiredBody");
    case 403:
      return t("forbiddenBody");
    case 404:
      return t("notFoundBody");
    case 408:
    case 504:
      return t("timeoutBody");
    case 429:
      return envelope.quota
        ? t("planBudgetBody", { retry })
        : t("tooManyBody", { retry });
    default:
      return envelope.statusCode >= 500 ? t("serverBody") : fallback;
  }
};

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError
    ? localizeEnvelope(error.envelope, fallback)
    : fallback;
}

const answered = (error: unknown, statusCode: number): boolean =>
  error instanceof ApiError && error.envelope.statusCode === statusCode;

export const isNotFound = (error: unknown): boolean => answered(error, 404);

export const isConflict = (error: unknown): boolean => answered(error, 409);

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

function handleAuthRedirect(path: string, status: number): void {
  if (typeof window === "undefined" || path.startsWith("/auth")) return;
  if (isPublicRoute(window.location.pathname)) return;
  if (status === 401) {
    window.location.assign(
      loginUrl(window.location.pathname, window.location.search),
    );
  } else if (status === 402 && window.location.pathname !== UPGRADE_PATH) {
    window.location.assign(UPGRADE_PATH);
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
    if (res.status === 401) await redirectRefusedRender();
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
  country?: string;
  includePaused?: boolean;
}

export function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function marketParams(
  country?: string,
  localization?: string,
): URLSearchParams {
  return new URLSearchParams({
    ...(country === undefined ? {} : { country }),
    ...(localization === undefined ? {} : { localization }),
  });
}
