"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ASK_THE_OWNER,
  COLLECTION_PAUSED,
  suspensionNotice,
  trialBannerLine,
} from "@/lib/plan-choice";
import { accountPlanOptions } from "@/lib/queries";
import { useAuth } from "./use-auth";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS),
  );
}

function UpgradeLink({ children }: { children: ReactNode }) {
  return (
    <Link href="/upgrade" className="font-medium underline">
      {children}
    </Link>
  );
}

function PausedBanner({ isMember }: { isMember: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-muted px-4 py-2 text-body sm:px-6 print:hidden">
      <span>
        {COLLECTION_PAUSED}
        {isMember ? ` ${ASK_THE_OWNER}` : null}
      </span>
      {isMember ? null : <UpgradeLink>Choose a plan</UpgradeLink>}
    </div>
  );
}

function TrialBanner({
  endsAt,
  isMember,
  card,
}: {
  endsAt: string;
  isMember: boolean;
  card: boolean;
}) {
  const { data: plan } = useQuery({ ...accountPlanOptions, enabled: card });

  return (
    <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-body text-warning sm:px-6 print:hidden">
      <span>
        {trialBannerLine(daysLeft(endsAt), card ? plan : undefined)}
        {isMember ? ` ${ASK_THE_OWNER}` : null}
      </span>
      {isMember ? null : card ? (
        <Link href="/settings" className="font-medium underline">
          Manage billing
        </Link>
      ) : (
        <UpgradeLink>Upgrade</UpgradeLink>
      )}
    </div>
  );
}

function SuspendedBanner({ reason }: { reason: string | null }) {
  return (
    <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-body text-destructive sm:px-6 print:hidden">
      {suspensionNotice(reason)}
    </div>
  );
}

function PlanNotice() {
  const { user, trialOnly, trialing, isMember } = useAuth();

  if (user && !user.entitled) return <PausedBanner isMember={isMember} />;
  if (trialOnly && user?.trialEndsAt) {
    return (
      <TrialBanner
        endsAt={user.trialEndsAt}
        isMember={isMember}
        card={trialing}
      />
    );
  }
  return null;
}

export function AccountNotice() {
  const { user } = useAuth();

  return (
    <>
      {user?.suspendedAt ? (
        <SuspendedBanner reason={user.suspendedReason ?? null} />
      ) : null}
      <PlanNotice />
    </>
  );
}
