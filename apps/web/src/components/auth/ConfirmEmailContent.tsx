"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { AuthUser } from "@asobeast/shared";
import { entryDestination } from "@/lib/auth-routes";
import { sellingTrial } from "@/lib/plan-choice";
import {
  billingCatalogOptions,
  confirmEmailViewerOptions,
} from "@/lib/queries";
import { signUpSteps } from "@/lib/sign-up-steps";
import { AuthActions, AuthAside, AuthCard } from "./AuthCard";
import { ResendConfirmationButton } from "./ResendConfirmationButton";
import { SessionCheck } from "./SessionCheck";
import { SignOutButton } from "./SignOutButton";
import { SignUpStepsAbove } from "./SignUpSteps";
import { useLeaveFor } from "./use-leave-for";

export function ConfirmEmailContent({ user }: { user: AuthUser }) {
  const t = useTranslations("auth");
  const leaving = useLeaveFor(
    (user) =>
      user.entryStep === "confirm-email" ? null : entryDestination(user, null),
    confirmEmailViewerOptions,
  );
  const { data: catalog } = useQuery(billingCatalogOptions);
  const offered = user.trialAwaitsCheckout === true && sellingTrial(catalog);

  if (leaving) {
    return (
      <div className="flex justify-center py-12">
        <SessionCheck />
      </div>
    );
  }

  return (
    <SignUpStepsAbove steps={signUpSteps(user)}>
      <AuthCard
        title={t("confirmEmail.title")}
        width="wall"
        description={t.rich("confirmEmail.description", {
          address: (chunks) => (
            <strong className="font-medium wrap-anywhere text-foreground">
              {chunks}
            </strong>
          ),
          email: user.email,
          offered: offered ? "true" : "false",
        })}
      >
        <AuthActions>
          <ResendConfirmationButton />
          <p className="text-caption text-balance text-muted-foreground">
            {t("confirmEmail.caption")}
          </p>
        </AuthActions>
        <AuthAside>
          <div className="flex flex-wrap items-center justify-center gap-x-1 text-dense">
            {t.rich("confirmEmail.registerAgainLink", {
              link: (chunks) => (
                <SignOutButton variant="link" size="sm" className="h-auto px-0">
                  {chunks}
                </SignOutButton>
              ),
            })}
          </div>
        </AuthAside>
      </AuthCard>
    </SignUpStepsAbove>
  );
}
