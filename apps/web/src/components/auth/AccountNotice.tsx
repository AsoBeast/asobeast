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

const TRIAL_ENDING_DAYS = 3;

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
      <p className="max-w-[110ch]">
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

const UPGRADE = "/upgrade";

function PausedBanner({ isMember }: { isMember: boolean }) {
  return (
    <AccountBar
      icon={CirclePause}
      tone="warning"
      sentence={
        isMember ? `${COLLECTION_PAUSED} ${ASK_THE_OWNER}` : COLLECTION_PAUSED
      }
      action={isMember ? undefined : { href: UPGRADE, label: "Choose a plan" }}
    />
  );
}

function trialAction(isMember: boolean, card: boolean) {
  if (isMember) return undefined;
  return card
    ? { href: "/settings", label: "Manage billing" }
    : { href: UPGRADE, label: "Upgrade" };
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
