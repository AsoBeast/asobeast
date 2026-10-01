"use client";

import Link from "next/link";
import { useAuth } from "./use-auth";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS),
  );
}

function PausedBanner() {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-muted px-4 py-2 text-body sm:px-6 print:hidden">
      <span>
        Collection is paused. Everything asobeast has already gathered stays
        readable and exportable.
      </span>
      <Link href="/upgrade" className="font-medium underline">
        Choose a plan
      </Link>
    </div>
  );
}

function TrialBanner({ remaining }: { remaining: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-body text-warning sm:px-6 print:hidden">
      <span>
        Trial ends in {remaining} day{remaining === 1 ? "" : "s"}.
      </span>
      <Link href="/upgrade" className="font-medium underline">
        Upgrade
      </Link>
    </div>
  );
}

export function AccountNotice() {
  const { user, trialOnly } = useAuth();

  if (user && !user.entitled) return <PausedBanner />;
  if (trialOnly && user?.trialEndsAt) {
    return <TrialBanner remaining={daysLeft(user.trialEndsAt)} />;
  }
  return null;
}
