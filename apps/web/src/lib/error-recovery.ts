import { ApiError, readApiErrorDigest } from "@/lib/api";

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
  504: {
    title: "The API did not answer in time",
    body: "asobeast runs on your own machine. Check that the api container is up and that the database and Redis are reachable, then try again.",
    action: { kind: "retry" },
  },
};

function rateLimited(retryAfterSeconds: number | null): Recovery {
  const wait =
    retryAfterSeconds === null
      ? "Wait a moment and try again."
      : `Wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"} and try again.`;
  return {
    title: "Your plan's request budget is spent",
    body: `This workspace has used the API requests its plan allows. ${wait}`,
    action: { kind: "retry" },
  };
}

function byStatus(
  statusCode: number,
  retryAfterSeconds: number | null,
): Recovery | null {
  if (statusCode === 429) return rateLimited(retryAfterSeconds);
  return BY_STATUS[statusCode] ?? null;
}

function digestOf(error: unknown): string | undefined {
  const digest: unknown = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" ? digest : undefined;
}

export function recoveryFor(error: unknown): Recovery {
  if (error instanceof ApiError) {
    const { statusCode, message, retryAfterSeconds } = error.envelope;
    const known = byStatus(statusCode, retryAfterSeconds ?? null);
    if (known) return known;
    if (statusCode >= 500) {
      return {
        title: "The API failed to answer",
        body: message,
        action: { kind: "retry" },
      };
    }
    return { ...GENERIC, body: message };
  }

  const digest = readApiErrorDigest(digestOf(error));
  if (!digest) return GENERIC;
  return byStatus(digest.statusCode, digest.retryAfterSeconds) ?? GENERIC;
}
