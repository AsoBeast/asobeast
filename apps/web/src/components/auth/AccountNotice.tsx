"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CirclePause, Clock, OctagonX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MessageTranslator } from "@/i18n/translator";
import {
  NOTICE_LINK,
  NoticeLine,
  type NoticeTone,
} from "@/components/layout/notice-line";
import { suspensionNotice, trialBannerLine } from "@/lib/plan-choice";
import { accountPlanOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
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

function AccountBar({
  icon,
  tone,
  sentence,
}: {
  icon: LucideIcon;
  tone: NoticeTone;
  sentence: ReactNode;
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
      </p>
    </NoticeLine>
  );
}

function PausedBanner({ isMember }: { isMember: boolean }) {
  const t = useTranslations("billing");
  const account = useTranslations("account");
  const sentence = isMember
    ? t("member.paused")
    : account.rich("notices.pausedAction", {
        sentence: t("status.collectionPaused"),
        action: account("notices.choosePlan"),
        link: (chunks) => (
          <Link href={UPGRADE} className={NOTICE_LINK}>
            <span>{chunks}</span>
          </Link>
        ),
      });

  return <AccountBar icon={CirclePause} tone="warning" sentence={sentence} />;
}

function trialAction(
  isMember: boolean,
  card: boolean,
  t: MessageTranslator,
): { href: string; label: string } | undefined {
  if (isMember) return undefined;
  return card
    ? { href: "/settings", label: t("notices.manageBilling") }
    : { href: UPGRADE, label: t("notices.upgrade") };
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
  const t = useTranslations("billing");
  const account = useTranslations("account");
  const locale = useAppLocale();
  const context = { translator: t, locale };
  const { data: plan } = useQuery({ ...accountPlanOptions, enabled: card });
  const days = daysLeft(endsAt);
  const line = trialBannerLine(days, card ? plan : undefined, context);
  const action = trialAction(isMember, card, account);
  const sentence = isMember
    ? t("member.trial", { sentence: line })
    : account.rich("notices.trialAction", {
        sentence: line,
        action: action?.label ?? "",
        link: (chunks) => (
          <Link href={action?.href ?? UPGRADE} className={NOTICE_LINK}>
            <span>{chunks}</span>
          </Link>
        ),
      });

  return (
    <AccountBar
      icon={Clock}
      tone={days <= TRIAL_ENDING_DAYS ? "warning" : "neutral"}
      sentence={sentence}
    />
  );
}

function SuspendedBanner({ reason }: { reason: string | null }) {
  const t = useTranslations("billing");
  const locale = useAppLocale();

  return (
    <AccountBar
      icon={OctagonX}
      tone="critical"
      sentence={suspensionNotice(reason, { translator: t, locale })}
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
