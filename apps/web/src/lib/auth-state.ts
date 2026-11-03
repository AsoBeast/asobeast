import {
  paidPlanOf,
  type AuthStatus,
  type AuthUser,
  type EntryStep,
} from "@asobeast/shared";

export interface DerivedAuthState {
  authenticated: boolean;
  user: AuthUser | undefined;
  trialOnly: boolean;
  trialing: boolean;
  entryStep: EntryStep | undefined;
  isMember: boolean;
  isOwner: boolean;
  isOperator: boolean;
}

export function authStateOf(
  status: AuthStatus | undefined,
  user: AuthUser | undefined,
): DerivedAuthState {
  const authenticated = Boolean(status?.authenticated);
  const signedIn = authenticated ? user : undefined;
  const trialing = signedIn?.trialing === true;
  const legacyTrial = Boolean(
    signedIn?.entitled &&
    paidPlanOf(signedIn.plan) === null &&
    signedIn.trialEndsAt !== null,
  );
  return {
    authenticated,
    user: signedIn,
    trialOnly: legacyTrial || trialing,
    trialing,
    entryStep: signedIn?.entryStep,
    isMember: signedIn !== undefined && signedIn.role !== "owner",
    isOwner: signedIn?.role === "owner",
    isOperator: signedIn?.platformOperator === true,
  };
}
