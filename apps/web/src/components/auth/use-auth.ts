"use client";

import { useQuery } from "@tanstack/react-query";
import { paidPlanOf, type AuthStatus, type AuthUser } from "@asobeast/shared";
import { authMeOptions, authStatusOptions } from "@/lib/queries";

export interface AuthState {
  status: AuthStatus | undefined;
  user: AuthUser | undefined;
  isLoading: boolean;
  isFetching: boolean;
  trialOnly: boolean;
}

export function useAuth(): AuthState {
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

  const trialOnly = Boolean(
    user?.entitled &&
    paidPlanOf(user.plan) === null &&
    user.trialEndsAt !== null,
  );

  return {
    status,
    user: authenticated ? user : undefined,
    isLoading: statusLoading || (authenticated && userLoading),
    isFetching: statusFetching,
    trialOnly,
  };
}
