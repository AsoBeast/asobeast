import type { ApiErrorEnvelope } from "@asobeast/shared";
import type { McpConfig } from "./config.js";

const REQUEST_TIMEOUT_MS = 30_000;
const JSON_CONTENT_TYPE = "application/json";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; message: string };

export type QueryValue = string | number | boolean | undefined | null;

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, QueryValue>,
): string {
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorEnvelope).message === "string"
  );
}

function redirectMessage(
  base: string,
  requested: string,
  location: string | null,
): string {
  const target =
    location && URL.canParse(location, requested)
      ? new URL(location, requested)
      : null;
  if (target?.pathname === "/login") {
    return `ASOBEAST_API_URL is the web app, not its API. Set it to ${base}/api/backend.`;
  }
  return `ASOBEAST_API_URL redirected to ${target?.href ?? "another address"}. Set it to the final address; the API token is never sent across a redirect.`;
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

export interface ApiClient {
  get<T>(
    path: string,
    params?: Record<string, QueryValue>,
  ): Promise<ApiResult<T>>;
}

export function createClient(config: McpConfig): ApiClient {
  return {
    async get<T>(
      path: string,
      params?: Record<string, QueryValue>,
    ): Promise<ApiResult<T>> {
      const url = buildUrl(config.apiUrl, path, params);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            authorization: `Bearer ${config.token}`,
            accept: JSON_CONTENT_TYPE,
          },
          redirect: "manual",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        return {
          ok: false,
          status: 0,
          message: `Could not reach the asobeast API at ${config.apiUrl}. Check ASOBEAST_API_URL and that the instance is running.`,
        };
      }

      if (isRedirect(res.status)) {
        return {
          ok: false,
          status: res.status,
          message: redirectMessage(
            config.apiUrl,
            url,
            res.headers.get("location"),
          ),
        };
      }

      if (!res.ok) {
        let message = `Request failed with status ${res.status}.`;
        try {
          const body: unknown = await res.json();
          if (isErrorEnvelope(body)) message = body.message;
        } catch {
          message = `Request failed with status ${res.status}.`;
        }
        return { ok: false, status: res.status, message };
      }

      if (res.status === 204) return { ok: true, data: undefined as T };
      const contentType = res.headers.get("content-type") ?? "no content type";
      if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
        return {
          ok: false,
          status: res.status,
          message: `ASOBEAST_API_URL answered with ${contentType} instead of the asobeast API. If it is your web address, append /api/backend.`,
        };
      }
      try {
        return { ok: true, data: (await res.json()) as T };
      } catch {
        return {
          ok: false,
          status: res.status,
          message: `The asobeast API returned a ${res.status} response that was not valid JSON.`,
        };
      }
    },
  };
}
