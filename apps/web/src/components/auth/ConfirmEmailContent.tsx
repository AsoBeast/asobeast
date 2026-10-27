"use client";

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
} from "@/lib/plan-choice";
import { confirmEmailViewerOptions } from "@/lib/queries";
import { ResendConfirmationButton } from "./ResendConfirmationButton";
import { SessionCheck } from "./SessionCheck";
import { SignOutButton } from "./SignOutButton";
import { useLeaveFor } from "./use-leave-for";

export function ConfirmEmailContent({
  email,
  offered,
}: {
  email: string;
  offered: boolean;
}) {
  const leaving = useLeaveFor(
    (user) =>
      user.entryStep === "confirm-email" ? null : entryDestination(user, null),
    confirmEmailViewerOptions,
  );
  const { before, address, after } = confirmEmailParts(email, offered);

  if (leaving) {
    return (
      <div className="flex justify-center py-12">
        <SessionCheck />
      </div>
    );
  }

  return (
    <Card className="mx-auto my-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle asChild>
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
  );
}
