"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { paidPlanOf, type AuthStatus, type AuthUser } from "@asobeast/shared";
import { authMeOptions, authStatusOptions } from "@/lib/queries";

export interface AuthState {
  status: AuthStatus | undefined;
  user: AuthUser | undefined;
  isLoading: boolean;
  isFetching: boolean;
  trialOnly: boolean;
  awaitingConfirmation: boolean;
  isMember: boolean;
  isOwner: boolean;
}

function subscribeToNothing(): () => void {
  return () => {};
}

function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

const SERVER_AUTH_STATE: AuthState = {
  status: undefined,
  user: undefined,
  isLoading: true,
  isFetching: true,
  trialOnly: false,
  awaitingConfirmation: false,
  isMember: false,
  isOwner: false,
};

export function useAuth(): AuthState {
  const hydrated = useHydrated();
  const {
    data: status,
    isLoading: statusLoading,
    isFetching: statusFetching,
  } = useQuery(authStatusOptions);
  const authenticated = Boolean(status?.authenticated);
  const { data: user, isLoading: userLoading } = useQuery({
    ...authMeOptions,
    enabled: authenticated,
  });

  if (!hydrated) return SERVER_AUTH_STATE;

  const trialOnly = Boolean(
    user?.entitled &&
    paidPlanOf(user.plan) === null &&
    user.trialEndsAt !== null,
  );

  const signedIn = authenticated ? user : undefined;

  return {
    status,
    user: signedIn,
    isLoading: statusLoading || (authenticated && userLoading),
    isFetching: statusFetching,
    trialOnly,
    awaitingConfirmation: signedIn?.trialAwaitsConfirmation === true,
    isMember: signedIn !== undefined && signedIn.role !== "owner",
    isOwner: signedIn?.role === "owner",
  };
}
