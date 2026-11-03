import { paidPlanOf, type AuthStatus, type AuthUser } from "@asobeast/shared";

export interface DerivedAuthState {
  authenticated: boolean;
  user: AuthUser | undefined;
  trialOnly: boolean;
  trialing: boolean;
  awaitingConfirmation: boolean;
  awaitingCheckout: boolean;
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
    awaitingConfirmation: signedIn?.trialAwaitsConfirmation === true,
    awaitingCheckout: signedIn?.trialAwaitsCheckout === true,
    isMember: signedIn !== undefined && signedIn.role !== "owner",
    isOwner: signedIn?.role === "owner",
    isOperator: signedIn?.platformOperator === true,
  };
}
