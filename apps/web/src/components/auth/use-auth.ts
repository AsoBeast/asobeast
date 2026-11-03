"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthStatus } from "@asobeast/shared";
import { authStateOf, type DerivedAuthState } from "@/lib/auth-state";
import { authMeOptions, authStatusOptions } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";

export interface AuthState extends DerivedAuthState {
  status: AuthStatus | undefined;
  userError: Error | null;
  retryUser: () => void;
  isLoading: boolean;
  isFetching: boolean;
}

const SERVER_AUTH_STATE: AuthState = {
  ...authStateOf(undefined, undefined),
  status: undefined,
  userError: null,
  retryUser: () => {},
  isLoading: true,
  isFetching: true,
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

  return {
    ...authStateOf(status, user),
    status,
    userError: authenticated ? userError : null,
    retryUser: () => void refetchUser(),
    isLoading: statusLoading || (authenticated && userLoading),
    isFetching: statusFetching,
  };
}
