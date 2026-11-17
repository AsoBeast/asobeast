"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@asobeast/shared";
import { entryDestination } from "@/lib/auth-routes";
import {
  CONFIRM_EMAIL_CAPTION,
  CONFIRM_EMAIL_TITLE,
  REGISTER_AGAIN,
  WRONG_ADDRESS,
  confirmEmailParts,
  sellingTrial,
} from "@/lib/plan-choice";
import {
  billingCatalogOptions,
  confirmEmailViewerOptions,
} from "@/lib/queries";
import { signUpSteps } from "@/lib/sign-up-steps";
import { AuthActions, AuthAside, AuthCard } from "./AuthCard";
import { ResendConfirmationButton } from "./ResendConfirmationButton";
import { SessionCheck } from "./SessionCheck";
import { SignOutButton } from "./SignOutButton";
import { SignUpSteps } from "./SignUpSteps";
import { useLeaveFor } from "./use-leave-for";

export function ConfirmEmailContent({ user }: { user: AuthUser }) {
  const leaving = useLeaveFor(
    (user) =>
      user.entryStep === "confirm-email" ? null : entryDestination(user, null),
    confirmEmailViewerOptions,
  );
  const { data: catalog } = useQuery(billingCatalogOptions);
  const { before, address, after } = confirmEmailParts(
    user.email,
    user.trialAwaitsCheckout === true && sellingTrial(catalog),
  );

  if (leaving) {
    return (
      <div className="flex justify-center py-12">
        <SessionCheck />
      </div>
    );
  }

  return (
    <div className="my-auto flex w-full flex-col items-center gap-6">
      <SignUpSteps steps={signUpSteps(user)} />
      <AuthCard
        title={CONFIRM_EMAIL_TITLE}
        width="wall"
        description={
          <>
            <span>{before}</span>
            <strong className="font-medium wrap-anywhere text-foreground">
              {address}
            </strong>
            <span>{after}</span>
          </>
        }
      >
        <AuthActions>
          <ResendConfirmationButton />
          <p className="text-caption text-balance text-muted-foreground">
            {CONFIRM_EMAIL_CAPTION}
          </p>
        </AuthActions>
        <AuthAside>
          <div className="flex flex-wrap items-center justify-center gap-x-1 text-dense">
            <span>{WRONG_ADDRESS}</span>
            <SignOutButton variant="link" size="sm" className="h-auto px-0" />
            <span>{REGISTER_AGAIN}</span>
          </div>
        </AuthAside>
      </AuthCard>
    </div>
  );
}
