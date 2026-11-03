"use client";

import { useEffect, useRef, useState } from "react";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import type { CheckoutTheme } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, startCheckout } from "@/lib/api";
import { openAfterPrevious, sessionKeyOf } from "@/lib/embedded-checkout";
import { CHECKOUT_REOPENING, CHECKOUT_UNREACHABLE } from "@/lib/plan-choice";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { loadStripeOnce } from "@/lib/stripe-loader";

type MountState = "loading" | "ready" | "failed" | "retrying";

const CHECKOUT_OPEN_TIMEOUT_MS = 35_000;

function failureOf(error: unknown): string {
  return error instanceof ApiError
    ? error.envelope.message
    : CHECKOUT_UNREACHABLE;
}

async function clientSecretOf(
  priceId: string,
  theme: CheckoutTheme,
): Promise<string> {
  const session = await startCheckout(
    priceId,
    "embedded",
    theme,
    AbortSignal.timeout(CHECKOUT_OPEN_TIMEOUT_MS),
  );
  if (!session.clientSecret) throw new Error(CHECKOUT_UNREACHABLE);
  return session.clientSecret;
}

export function EmbeddedCheckout({
  publishableKey,
  priceId,
  theme,
  label,
}: {
  publishableKey: string;
  priceId: string;
  theme: CheckoutTheme;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  const handFocus = useFocusAfterCommit();
  const [state, setState] = useState<MountState>("loading");
  const [failure, setFailure] = useState(CHECKOUT_UNREACHABLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let checkout: StripeEmbeddedCheckout | null = null;
    openAfterPrevious(async () => {
      if (!active) return;
      const stripe = await loadStripeOnce(publishableKey);
      if (!stripe) throw new Error(CHECKOUT_UNREACHABLE);
      if (!active) return;
      const clientSecret = await clientSecretOf(priceId, theme);
      if (!active) return;
      const instance = await stripe.createEmbeddedCheckoutPage({
        clientSecret,
      });
      if (!active || !container.current) {
        instance.destroy();
        return;
      }
      checkout = instance;
      instance.mount(container.current);
      if (retry.current) handFocus(container.current, retry.current);
      setState("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setFailure(failureOf(error));
      setState("failed");
    });
    return () => {
      active = false;
      checkout?.destroy();
    };
  }, [publishableKey, priceId, theme, attempt, handFocus]);

  return (
    <div className="flex flex-col gap-3">
      {state === "loading" ? (
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      ) : null}
      {state === "failed" || state === "retrying" ? (
        <div className="flex flex-col items-start gap-2 text-body">
          {state === "retrying" ? (
            <p role="status">{CHECKOUT_REOPENING}</p>
          ) : null}
          {state === "failed" ? <p role="alert">{failure}</p> : null}
          <Button
            ref={retry}
            variant="outline"
            aria-disabled={state === "retrying"}
            onClick={() => {
              if (state === "retrying") return;
              setState("retrying");
              setAttempt((count) => count + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
      <div
        ref={container}
        id={sessionKeyOf(priceId, theme)}
        className="rounded-xl"
        aria-label={label}
        aria-busy={state === "loading" || state === "retrying"}
        role="region"
        tabIndex={-1}
      />
    </div>
  );
}
