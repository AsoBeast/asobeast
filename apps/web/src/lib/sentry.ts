import type { ErrorEvent, init } from "@sentry/nextjs";

type SentryOptions = Parameters<typeof init>[0];

const PRODUCTION = "production";
const IDENTIFIER = /^(c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)$/i;

const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
};

export function reportingDsn(
  dsn: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  const configured = dsn?.trim();
  return configured && nodeEnv === PRODUCTION ? configured : null;
}

export function maskRoute(url: string): string {
  const [path] = url.split("?");
  return path
    .split("/")
    .map((segment) => (IDENTIFIER.test(segment) ? ":id" : segment))
    .join("/");
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { method, url } = event.request ?? {};
  return {
    ...event,
    ...(event.request
      ? {
          request: {
            ...(method ? { method } : {}),
            ...(url ? { url: maskRoute(url) } : {}),
          },
        }
      : {}),
    ...(event.transaction ? { transaction: maskRoute(event.transaction) } : {}),
  };
}

export function reportingOptions(dsn: string): SentryOptions {
  return {
    dsn,
    environment: PRODUCTION,
    dataCollection: DATA_COLLECTION,
    maxBreadcrumbs: 0,
    beforeSend: scrubEvent,
  };
}
