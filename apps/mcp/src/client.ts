import type { ApiErrorEnvelope } from "@asobeast/shared";
import type { McpConfig } from "./config.js";

const REQUEST_TIMEOUT_MS = 30_000;

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
            accept: "application/json",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        return {
          ok: false,
          status: 0,
          message: `Could not reach the asobeast API at ${config.apiUrl}. Check ASOBEAST_API_URL and that the instance is running.`,
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
