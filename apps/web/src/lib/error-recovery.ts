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

const GENERIC: Recovery = {
  title: "Something went wrong",
  body: "The request could not be completed. Trying again usually clears a transient failure.",
  action: { kind: "retry" },
  expected: false,
};

const BY_STATUS: Record<number, Omit<Recovery, "expected">> = {
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
    body: "asobeast runs on your own machine. Check that the api container is up and that the database and Redis are reachable, then try again.",
    action: { kind: "retry" },
  },
};

function reopens(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) return "Try again in a moment.";
  const at = new Date(Date.now() + retryAfterSeconds * 1000);
  return `Try again ${formatRelativeTime(at.toISOString())}.`;
}

function refused({
  planRefusal,
  retryAfterSeconds,
}: ApiErrorDigest): Omit<Recovery, "expected"> {
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

function byStatus(digest: ApiErrorDigest): Recovery | null {
  const known =
    digest.statusCode === 429 ? refused(digest) : BY_STATUS[digest.statusCode];
  return known ? { ...known, expected: true } : null;
}

function digestOf(error: unknown): string | undefined {
  const digest: unknown = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" ? digest : undefined;
}

export function recoveryFor(error: unknown): Recovery {
  if (error instanceof ApiError) {
    const { statusCode, message } = error.envelope;
    const known = byStatus(apiErrorDigestOf(error.envelope));
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
  return (digest && byStatus(digest)) ?? GENERIC;
}
