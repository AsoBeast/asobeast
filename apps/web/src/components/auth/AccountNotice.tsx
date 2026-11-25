"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CirclePause, Clock, OctagonX, type LucideIcon } from "lucide-react";
import {
  NOTICE_LINK,
  NoticeLine,
  type NoticeTone,
} from "@/components/layout/notice-line";
import {
  ASK_THE_OWNER,
  pausedNotice,
  suspensionNotice,
  trialBannerLine,
  trialChargeDeclined,
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

const TRIAL_ENDING_DAYS = 3;

const UPGRADE = "/upgrade";

const MANAGE_BILLING = { href: "/settings#plan", label: "Manage billing" };

const CHOOSE_A_PLAN = { href: UPGRADE, label: "Choose a plan" };

function AccountBar({
  icon,
  tone,
  sentence,
  action,
}: {
  icon: LucideIcon;
  tone: NoticeTone;
  sentence: string;
  action?: { href: string; label: string };
}) {
  return (
    <NoticeLine
      icon={icon}
      tone={tone}
      data-slot="account-bar"
      className="border-b px-4 py-2.5 sm:px-6"
    >
      <p className="max-w-[110ch] wrap-anywhere">
        <span>{sentence}</span>
        {action ? (
          <>
            {" "}
            <Link href={action.href} className={NOTICE_LINK}>
              {action.label}
            </Link>
          </>
        ) : null}
      </p>
    </NoticeLine>
  );
}

function pausedAction(isMember: boolean, declined: boolean) {
  if (isMember) return undefined;
  return declined ? MANAGE_BILLING : CHOOSE_A_PLAN;
}

function PausedBanner({ isMember }: { isMember: boolean }) {
  const { data: plan, isLoading } = useQuery({
    ...accountPlanOptions,
    enabled: !isMember,
  });

  if (isLoading) {
    return <AccountBar icon={CirclePause} tone="warning" sentence="" />;
  }

  return (
    <AccountBar
      icon={CirclePause}
      tone="warning"
      sentence={pausedNotice(plan, isMember)}
      action={pausedAction(isMember, trialChargeDeclined(plan))}
    />
  );
}

function trialAction(isMember: boolean, card: boolean) {
  if (isMember) return undefined;
  return card ? MANAGE_BILLING : { href: UPGRADE, label: "Upgrade" };
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
  const days = daysLeft(endsAt);
  const line = trialBannerLine(days, card ? plan : undefined);

  return (
    <AccountBar
      icon={Clock}
      tone={days <= TRIAL_ENDING_DAYS ? "warning" : "neutral"}
      sentence={isMember ? `${line} ${ASK_THE_OWNER}` : line}
      action={trialAction(isMember, card)}
    />
  );
}

function SuspendedBanner({ reason }: { reason: string | null }) {
  return (
    <AccountBar
      icon={OctagonX}
      tone="critical"
      sentence={suspensionNotice(reason)}
    />
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
