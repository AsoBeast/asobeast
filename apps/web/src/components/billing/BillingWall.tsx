"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import type {
  AccountPlan,
  BillingCatalog,
  BillingInterval,
  PaidPlanName,
} from "@asobeast/shared";
import { ResendConfirmationButton } from "@/components/auth/ResendConfirmationButton";
import {
  confirmationLine,
  paywallHeading,
  paywallStatusLine,
  planAction,
} from "@/lib/plan-choice";
import { planParam } from "@/lib/search-params";
import { CheckoutColumn } from "./CheckoutColumn";
import { PlanPicker } from "./PlanPicker";

const DEFAULT_PLAN: PaidPlanName = "indie";

export function BillingWall({
  plan,
  catalog,
  email,
  awaitingConfirmation,
}: {
  plan: AccountPlan | undefined;
  catalog: BillingCatalog | undefined;
  email: string | undefined;
  awaitingConfirmation: boolean;
}) {
  const [selected, setSelected] = useQueryState(
    "plan",
    planParam.withDefault(DEFAULT_PLAN).withOptions({ clearOnDefault: false }),
  );
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [now] = useState(() => new Date());
  const offered = Boolean(plan?.trialOffer);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-display tracking-tight text-balance">
          {paywallHeading(plan)}
        </h1>
        <p className="text-body text-muted-foreground">
          {paywallStatusLine(plan, awaitingConfirmation, now)}
        </p>
        {awaitingConfirmation && offered && email ? (
          <p className="text-body text-muted-foreground">
            {confirmationLine(email)}
          </p>
        ) : null}
        {awaitingConfirmation ? (
          <div className="mt-2 flex justify-center">
            <ResendConfirmationButton />
          </div>
        ) : null}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <PlanPicker
          interval={interval}
          onInterval={setInterval}
          selected={selected}
          onSelect={(name) => void setSelected(name)}
          actionOf={(name) => planAction(plan, name)}
        />
        <CheckoutColumn
          plan={plan}
          catalog={catalog}
          name={selected}
          interval={interval}
          action={planAction(plan, selected)}
          now={now}
        />
      </div>
    </div>
  );
}
