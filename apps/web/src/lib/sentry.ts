import type { Contexts, ErrorEvent, EventHint, init } from "@sentry/nextjs";
import { isExplainedRefusal } from "@/lib/error-recovery";

type SentryOptions = Parameters<typeof init>[0];

const PRODUCTION = "production";
const CLIENT_DISCONNECT = "The destination stream closed early.";
const IDENTIFIER = /^(c[a-z0-9]{20,}|[0-9a-f-]{16,}|\d+)$/i;

const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
} satisfies SentryOptions["dataCollection"];

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

function maskedContexts(contexts: Contexts): Contexts {
  const nextjs = contexts.nextjs;
  const path: unknown = nextjs?.request_path;
  if (typeof path !== "string") return contexts;
  return { ...contexts, nextjs: { ...nextjs, request_path: maskRoute(path) } };
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
    ...(event.contexts ? { contexts: maskedContexts(event.contexts) } : {}),
  };
}

function unactionable(error: unknown): boolean {
  return (
    isExplainedRefusal(error) ||
    (error instanceof Error && error.message === CLIENT_DISCONNECT)
  );
}

export function filterEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  return unactionable(hint.originalException) ? null : scrubEvent(event);
}

export function reportingOptions(dsn: string): SentryOptions {
  return {
    dsn,
    environment: PRODUCTION,
    dataCollection: DATA_COLLECTION,
    maxBreadcrumbs: 0,
    beforeSend: filterEvent,
  };
}
