"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ASK_THE_OWNER, COLLECTION_PAUSED } from "@/lib/plan-choice";
import { ConfirmEmailBanner } from "./ConfirmEmailBanner";
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
  remaining,
  isMember,
}: {
  remaining: number;
  isMember: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-body text-warning sm:px-6 print:hidden">
      <span>
        Trial ends in {remaining} day{remaining === 1 ? "" : "s"}.
        {isMember ? ` ${ASK_THE_OWNER}` : null}
      </span>
      {isMember ? null : <UpgradeLink>Upgrade</UpgradeLink>}
    </div>
  );
}

export function AccountNotice() {
  const { user, trialOnly, awaitingConfirmation, isMember } = useAuth();

  if (user && awaitingConfirmation) {
    return <ConfirmEmailBanner email={user.email} />;
  }
  if (user && !user.entitled) return <PausedBanner isMember={isMember} />;
  if (trialOnly && user?.trialEndsAt) {
    return (
      <TrialBanner remaining={daysLeft(user.trialEndsAt)} isMember={isMember} />
    );
  }
  return null;
}
