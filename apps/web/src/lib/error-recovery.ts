import {
  ApiError,
  apiErrorDigestOf,
  readApiErrorDigest,
  type ApiErrorDigest,
} from "@/lib/api";
import { formatRelativeTime, formatRelativeTimeInLocale } from "@/lib/format";
import type { TranslationContext } from "@/i18n/translator";

export type RecoveryAction =
  { kind: "retry" } | { kind: "link"; href: string; label: string };

export interface Recovery {
  title: string;
  body: string;
  detail?: string;
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

const LOST_REQUEST: Recovery = {
  title: "AsoBeast could not be reached",
  body: "The connection dropped before the request finished. Check your connection, then try again.",
  action: { kind: "retry" },
  expected: true,
};

const LOST_REQUEST_MESSAGE =
  /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.)( \(.+\))?$/;

export function isLostRequest(error: unknown): boolean {
  return error instanceof TypeError && LOST_REQUEST_MESSAGE.test(error.message);
}

const BY_STATUS: Record<number, Explanation> = {
  401: {
    title: "Your session expired",
    body: "Sign in again to keep working — nothing was lost.",
    action: { kind: "link", href: "/login", label: "Sign in" },
  },
  402: {
    title: "Collection is paused",
    body: "Choose a plan, or start your free trial, to keep tracking keywords and running the daily pipeline.",
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

const STATUS_KEYS: Record<number, string> = {
  401: "unauthorized",
  402: "paymentRequired",
  403: "forbidden",
  404: "notFound",
  504: "timeout",
};

const ACTION_KEYS: Record<string, string> = {
  "Sign in": "signIn",
  "See plans": "seePlans",
  "Back to apps": "backToApps",
  "Open settings": "openSettings",
};

function reopens(
  retryAfterSeconds: number | null,
  context?: TranslationContext,
): string {
  if (retryAfterSeconds === null) {
    return context
      ? context.translator("retryMoment")
      : "Try again in a moment.";
  }
  const now = Date.now();
  const at = new Date(now + retryAfterSeconds * 1000);
  const relative = context
    ? formatRelativeTimeInLocale(at.toISOString(), now, context.locale)
    : formatRelativeTime(at.toISOString(), now);
  return context
    ? context.translator("retryIn", { time: relative })
    : `Try again ${relative}.`;
}

function refused(
  { planRefusal, retryAfterSeconds }: ApiErrorDigest,
  context?: TranslationContext,
): Explanation {
  const retry = reopens(retryAfterSeconds, context);
  if (context) {
    return {
      title: context.translator(
        planRefusal ? "planBudgetTitle" : "tooManyTitle",
      ),
      body: context.translator(planRefusal ? "planBudgetBody" : "tooManyBody", {
        retry,
      }),
      action: { kind: "retry" },
    };
  }
  return {
    title: planRefusal
      ? "Your plan's request budget is spent"
      : "Too many requests",
    body: planRefusal
      ? `This workspace has used the API requests its plan allows. ${retry}`
      : `The API refused this request because too many arrived in a short time. ${retry}`,
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

function translateExplanation(
  known: Explanation,
  digest: ApiErrorDigest,
  scope: RecoveryScope | undefined,
  context: TranslationContext,
): Explanation {
  const key =
    scope === "admin" && digest.statusCode === 404
      ? "adminNotFound"
      : STATUS_KEYS[digest.statusCode];
  if (!key) return known;
  return {
    title: context.translator(`${key}Title`),
    body: context.translator(`${key}Body`),
    action:
      known.action.kind === "link"
        ? {
            kind: "link",
            href: known.action.href,
            label: context.translator(
              ACTION_KEYS[known.action.label] ?? known.action.label,
            ),
          }
        : known.action,
  };
}

function byStatus(
  digest: ApiErrorDigest,
  scope: RecoveryScope | undefined,
  context?: TranslationContext,
): Recovery | null {
  if (digest.statusCode === 429) {
    return { ...refused(digest, context), expected: true };
  }
  const known = explanationFor(digest, scope);
  if (!known) return null;
  return {
    ...(context ? translateExplanation(known, digest, scope, context) : known),
    expected: true,
  };
}

function digestOf(error: unknown): string | undefined {
  const digest: unknown = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" ? digest : undefined;
}

export function isExplainedRefusal(error: unknown): boolean {
  const digest = readApiErrorDigest(digestOf(error));
  return (
    digest !== null &&
    digest.statusCode < 500 &&
    byStatus(digest, undefined) !== null
  );
}

export function recoveryFor(
  error: unknown,
  scope?: RecoveryScope,
  context?: TranslationContext,
): Recovery {
  if (error instanceof ApiError) {
    const { statusCode, message } = error.envelope;
    const known = byStatus(apiErrorDigestOf(error.envelope), scope, context);
    if (known) return known;
    if (statusCode >= 500) {
      return context
        ? {
            title: context.translator("serverTitle"),
            body: context.translator("serverBody"),
            detail: message,
            action: { kind: "retry" },
            expected: true,
          }
        : {
            title: "The API failed to answer",
            body: message,
            action: { kind: "retry" },
            expected: true,
          };
    }
    return context
      ? {
          ...GENERIC,
          title: context.translator("genericTitle"),
          body: context.translator("genericBody"),
          detail: message,
          expected: true,
        }
      : {
          ...GENERIC,
          body: message,
          expected: true,
        };
  }

  if (isLostRequest(error)) {
    return context
      ? {
          ...LOST_REQUEST,
          title: context.translator("networkTitle"),
          body: context.translator("networkBody"),
        }
      : LOST_REQUEST;
  }

  const digest = readApiErrorDigest(digestOf(error));
  return (
    (digest && byStatus(digest, scope, context)) ??
    (context
      ? {
          ...GENERIC,
          title: context.translator("genericTitle"),
          body: context.translator("genericBody"),
        }
      : GENERIC)
  );
}
