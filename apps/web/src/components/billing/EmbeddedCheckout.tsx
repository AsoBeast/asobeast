"use client";

import { useEffect, useRef, useState } from "react";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import type { CheckoutTheme } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, startCheckout } from "@/lib/api";
import { sessionKeyOf } from "@/lib/embedded-checkout";
import { loadStripeOnce } from "@/lib/stripe-loader";

type MountState = "loading" | "ready" | "failed";

const UNREACHABLE = "Checkout could not be opened. Try again.";

function failureOf(error: unknown): string {
  return error instanceof ApiError ? error.envelope.message : UNREACHABLE;
}

async function clientSecretOf(
  priceId: string,
  theme: CheckoutTheme,
): Promise<string> {
  const session = await startCheckout(priceId, "embedded", theme);
  if (!session.clientSecret) throw new Error(UNREACHABLE);
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
  const [state, setState] = useState<MountState>("loading");
  const [failure, setFailure] = useState(UNREACHABLE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let checkout: StripeEmbeddedCheckout | null = null;
    loadStripeOnce(publishableKey)
      .then((stripe) => {
        if (!stripe || !active) throw new Error(UNREACHABLE);
        return stripe.createEmbeddedCheckoutPage({
          fetchClientSecret: () =>
            active
              ? clientSecretOf(priceId, theme)
              : Promise.reject(new Error(UNREACHABLE)),
        });
      })
      .then((instance) => {
        if (!active || !container.current) {
          instance.destroy();
          return;
        }
        checkout = instance;
        instance.mount(container.current);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(failureOf(error));
        setState("failed");
      });
    return () => {
      active = false;
      checkout?.destroy();
    };
  }, [publishableKey, priceId, theme, attempt]);

  return (
    <div className="flex flex-col gap-3">
      {state === "loading" ? <Skeleton className="h-[28rem] w-full" /> : null}
      {state === "failed" ? (
        <div className="flex flex-col items-start gap-2 text-body">
          <p role="alert">{failure}</p>
          <Button
            variant="outline"
            onClick={() => {
              setState("loading");
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
        aria-label={label}
        aria-busy={state === "loading"}
        role="region"
      />
    </div>
  );
}
