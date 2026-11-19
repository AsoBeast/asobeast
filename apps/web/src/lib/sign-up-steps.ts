import type { AuthUser } from "@asobeast/shared";

export type SignUpStepState = "done" | "current" | "upcoming";

export const SIGN_UP_STEP_STATE_TEXT: Record<SignUpStepState, string | null> = {
  done: " (completed)",
  current: null,
  upcoming: " (not started)",
};

export interface SignUpStep {
  label: string;
  state: SignUpStepState;
}

const CREATE_ACCOUNT = "Create account";
const ACCOUNT_CREATED = "Account created";
const EMAIL_CONFIRMED = "Email confirmed";
const CHOOSE_A_PLAN = "Choose a plan";

function emailStep(
  confirming: boolean,
  emailVerified: boolean,
): readonly SignUpStep[] {
  if (confirming) return [{ label: EMAIL_CONFIRMED, state: "current" }];
  if (emailVerified) return [{ label: EMAIL_CONFIRMED, state: "done" }];
  return [];
}

export function signUpSteps(
  user: Pick<AuthUser, "entryStep" | "emailVerified"> | undefined,
): readonly SignUpStep[] {
  if (!user?.entryStep) return [];
  const confirming = user.entryStep === "confirm-email";
  return [
    { label: ACCOUNT_CREATED, state: "done" },
    ...emailStep(confirming, user.emailVerified),
    { label: CHOOSE_A_PLAN, state: confirming ? "upcoming" : "current" },
  ];
}

export function registerSteps(confirmsEmail: boolean): readonly SignUpStep[] {
  return [
    { label: CREATE_ACCOUNT, state: "current" },
    ...(confirmsEmail
      ? [{ label: EMAIL_CONFIRMED, state: "upcoming" as const }]
      : []),
    { label: CHOOSE_A_PLAN, state: "upcoming" },
  ];
}
