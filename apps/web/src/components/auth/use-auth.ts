"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { paidPlanOf, type AuthStatus, type AuthUser } from "@asobeast/shared";
import { authMeOptions, authStatusOptions } from "@/lib/queries";

export interface AuthState {
  status: AuthStatus | undefined;
  authenticated: boolean;
  user: AuthUser | undefined;
  userError: Error | null;
  retryUser: () => void;
  isLoading: boolean;
  isFetching: boolean;
  trialOnly: boolean;
  awaitingConfirmation: boolean;
  isMember: boolean;
  isOwner: boolean;
  isOperator: boolean;
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
  authenticated: false,
  user: undefined,
  userError: null,
  retryUser: () => {},
  isLoading: true,
  isFetching: true,
  trialOnly: false,
  awaitingConfirmation: false,
  isMember: false,
  isOwner: false,
  isOperator: false,
};

export function useAuth(): AuthState {
  const hydrated = useHydrated();
  const {
    data: status,
    isLoading: statusLoading,
    isFetching: statusFetching,
  } = useQuery(authStatusOptions);
  const authenticated = Boolean(status?.authenticated);
  const {
    data: user,
    error: userError,
    isLoading: userLoading,
    refetch: refetchUser,
  } = useQuery({
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
    authenticated,
    user: signedIn,
    userError: authenticated ? userError : null,
    retryUser: () => void refetchUser(),
    isLoading: statusLoading || (authenticated && userLoading),
    isFetching: statusFetching,
    trialOnly,
    awaitingConfirmation: signedIn?.trialAwaitsConfirmation === true,
    isMember: signedIn !== undefined && signedIn.role !== "owner",
    isOwner: signedIn?.role === "owner",
    isOperator: signedIn?.platformOperator === true,
  };
}
