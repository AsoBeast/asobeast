import { ApiError } from "@/lib/api";

export type RecoveryAction =
  { kind: "retry" } | { kind: "link"; href: string; label: string };

export interface Recovery {
  title: string;
  body: string;
  action: RecoveryAction;
}

const GENERIC: Recovery = {
  title: "Something went wrong",
  body: "The request could not be completed. Trying again usually clears a transient failure.",
  action: { kind: "retry" },
};

const BY_STATUS: Record<number, Recovery> = {
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
  429: {
    title: "Too many requests",
    body: "The store rate limiter is holding requests back. Wait a moment and try again.",
    action: { kind: "retry" },
  },
  504: {
    title: "The API did not answer in time",
    body: "asobeast runs on your own machine. Check that the api container is up and that the database and Redis are reachable, then try again.",
    action: { kind: "retry" },
  },
};

export function recoveryFor(error: unknown): Recovery {
  if (!(error instanceof ApiError)) return GENERIC;

  const known = BY_STATUS[error.envelope.statusCode];
  if (known) return known;

  if (error.envelope.statusCode >= 500) {
    return {
      title: "The API failed to answer",
      body: error.envelope.message,
      action: { kind: "retry" },
    };
  }

  return { ...GENERIC, body: error.envelope.message };
}
