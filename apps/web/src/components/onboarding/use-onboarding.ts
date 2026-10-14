"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/use-auth";
import {
  claimBrowserOnboarding,
  getOnboardingSnapshot,
  getServerOnboardingSnapshot,
  parseOnboardingState,
  saveOnboardingState,
  subscribeOnboarding,
  type OnboardingState,
} from "@/lib/onboarding";

export type OnboardingTransition = (
  current: OnboardingState,
) => OnboardingState;

export function useOnboarding() {
  const account = useAuth().user?.id;
  useEffect(() => {
    if (account) claimBrowserOnboarding(account);
  }, [account]);
  const snapshot = useSyncExternalStore(
    subscribeOnboarding,
    () => getOnboardingSnapshot(account),
    getServerOnboardingSnapshot,
  );
  const state = useMemo(() => parseOnboardingState(snapshot), [snapshot]);
  const persist = (transition: OnboardingTransition) => {
    if (!account) return;
    saveOnboardingState(
      account,
      transition(parseOnboardingState(getOnboardingSnapshot(account))),
    );
  };
  return { account, state, persist };
}
