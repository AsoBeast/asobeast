"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@asobeast/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="mx-auto my-auto flex w-full max-w-lg flex-col gap-6">
      <SignUpSteps steps={signUpSteps(user)} />
      <Card>
        <CardHeader>
          <CardTitle asChild className="text-display">
            <h1>{CONFIRM_EMAIL_TITLE}</h1>
          </CardTitle>
          <CardDescription>
            <span>{before}</span>
            <strong className="font-medium wrap-anywhere text-foreground">
              {address}
            </strong>
            <span>{after}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <ResendConfirmationButton />
          <p className="text-caption text-muted-foreground">
            {CONFIRM_EMAIL_CAPTION}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-x-1 text-body text-muted-foreground">
          <span>{WRONG_ADDRESS}</span>
          <SignOutButton variant="link" size="sm" className="h-auto px-0" />
          <span>{REGISTER_AGAIN}</span>
        </CardFooter>
      </Card>
    </div>
  );
}
