import type { AuthUser } from "@asobeast/shared";

export type SignUpStepState = "done" | "current" | "upcoming";

export type SignUpStepKey =
  "createAccount" | "accountCreated" | "emailConfirmed" | "choosePlan";

export interface SignUpStep {
  labelKey: SignUpStepKey;
  state: SignUpStepState;
}

function emailStep(
  confirming: boolean,
  emailVerified: boolean,
): readonly SignUpStep[] {
  if (confirming) return [{ labelKey: "emailConfirmed", state: "current" }];
  if (emailVerified) return [{ labelKey: "emailConfirmed", state: "done" }];
  return [];
}

export function signUpSteps(
  user: Pick<AuthUser, "entryStep" | "emailVerified"> | undefined,
): readonly SignUpStep[] {
  if (!user?.entryStep) return [];
  const confirming = user.entryStep === "confirm-email";
  return [
    { labelKey: "accountCreated", state: "done" },
    ...emailStep(confirming, user.emailVerified),
    { labelKey: "choosePlan", state: confirming ? "upcoming" : "current" },
  ];
}

function upcomingEmailStep(confirmsEmail: boolean): readonly SignUpStep[] {
  return confirmsEmail
    ? [{ labelKey: "emailConfirmed", state: "upcoming" }]
    : [];
}

export function registerSteps(confirmsEmail: boolean): readonly SignUpStep[] {
  return [
    { labelKey: "createAccount", state: "current" },
    ...upcomingEmailStep(confirmsEmail),
    { labelKey: "choosePlan", state: "upcoming" },
  ];
}
