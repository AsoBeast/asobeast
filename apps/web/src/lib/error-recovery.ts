import {
  ApiError,
  apiErrorDigestOf,
  readApiErrorDigest,
  type ApiErrorDigest,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

export type RecoveryAction =
  { kind: "retry" } | { kind: "link"; href: string; label: string };

export interface Recovery {
  title: string;
  body: string;
  action: RecoveryAction;
  expected: boolean;
}

export type RecoveryScope = "admin";

type Explanation = Omit<Recovery, "expected">;

const GENERIC: Recovery = {
  title: "Something went wrong",
  body: "The request could not be completed. Trying again usually clears a transient failure.",
  action: { kind: "retry" },
  expected: false,
};

const BY_STATUS: Record<number, Explanation> = {
  401: {
    title: "Your session expired",
    body: "Sign in again to keep working — nothing was lost.",
    action: { kind: "link", href: "/login", label: "Sign in" },
  },
  402: {
    title: "Your trial has ended",
    body: "Choose a plan to keep tracking keywords and running the daily pipeline.",
    action: { kind: "link", href: "/upgrade", label: "See plans" },
  },
  403: {
    title: "You cannot see this",
    body: "This account does not have access to the requested resource.",
    action: { kind: "link", href: "/", label: "Back to apps" },
  },
  404: {
    title: "Not found",
    body: "This app or record no longer exists. It may have been deleted.",
    action: { kind: "link", href: "/", label: "Back to apps" },
  },
  504: {
    title: "The API did not answer in time",
    body: "AsoBeast runs on your own machine. Check that the api container is up and that the database and Redis are reachable, then try again.",
    action: { kind: "retry" },
  },
};

const BY_SCOPED_STATUS: Record<RecoveryScope, Record<number, Explanation>> = {
  admin: {
    404: {
      title: "The admin area is closed",
      body: "The admin endpoints answer not found unless your own workspace has a plan in force and is not suspended. Check the plan on the settings page, then reload.",
      action: { kind: "link", href: "/settings", label: "Open settings" },
    },
  },
};

function reopens(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) return "Try again in a moment.";
  const now = Date.now();
  const at = new Date(now + retryAfterSeconds * 1000);
  return `Try again ${formatRelativeTime(at.toISOString(), now)}.`;
}

function refused({
  planRefusal,
  retryAfterSeconds,
}: ApiErrorDigest): Explanation {
  return {
    title: planRefusal
      ? "Your plan's request budget is spent"
      : "Too many requests",
    body: planRefusal
      ? `This workspace has used the API requests its plan allows. ${reopens(retryAfterSeconds)}`
      : `The API refused this request because too many arrived in a short time. ${reopens(retryAfterSeconds)}`,
    action: { kind: "retry" },
  };
}

function explanationFor(
  digest: ApiErrorDigest,
  scope: RecoveryScope | undefined,
): Explanation | undefined {
  if (digest.statusCode === 429) return refused(digest);
  const scoped = scope && BY_SCOPED_STATUS[scope][digest.statusCode];
  return scoped || BY_STATUS[digest.statusCode];
}

function byStatus(
  digest: ApiErrorDigest,
  scope: RecoveryScope | undefined,
): Recovery | null {
  const known = explanationFor(digest, scope);
  return known ? { ...known, expected: true } : null;
}

function digestOf(error: unknown): string | undefined {
  const digest: unknown = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" ? digest : undefined;
}

export function recoveryFor(error: unknown, scope?: RecoveryScope): Recovery {
  if (error instanceof ApiError) {
    const { statusCode, message } = error.envelope;
    const known = byStatus(apiErrorDigestOf(error.envelope), scope);
    if (known) return known;
    if (statusCode >= 500) {
      return {
        title: "The API failed to answer",
        body: message,
        action: { kind: "retry" },
        expected: true,
      };
    }
    return { ...GENERIC, body: message, expected: true };
  }

  const digest = readApiErrorDigest(digestOf(error));
  return (digest && byStatus(digest, scope)) ?? GENERIC;
}
