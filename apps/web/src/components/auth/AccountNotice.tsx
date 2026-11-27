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
import {
  pausedPlanOf,
  suspensionNotice,
  trialBannerLine,
  trialChargeDeclined,
} from "@/lib/plan-choice";
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
  sentence: ReactNode;
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
function pausedAction(
  isMember: boolean,
  declined: boolean,
  t: MessageTranslator,
) {
  if (isMember) return undefined;
  return declined
    ? { href: "/settings", label: t("plan.manageBilling") }
    : { href: UPGRADE, label: t("plan.choose") };
}

function PausedBanner({ isMember }: { isMember: boolean }) {
  const t = useTranslations("billing");
  const { data, isFetching } = useQuery({
    ...accountPlanOptions,
    enabled: !isMember,
    refetchOnMount: "always",
  });
  const plan = pausedPlanOf(data);
  const declined = trialChargeDeclined(plan);

  if (!plan && isFetching) {
    return (
      <AccountBar
        icon={CirclePause}
        tone="warning"
        sentence={t("status.collectionPaused")}
        action={{ href: UPGRADE, label: t("plan.choose") }}
      />
    );
  }
  if (!plan) {
    return (
      <AccountBar
        icon={CirclePause}
        tone="warning"
        sentence={t("status.collectionPaused")}
        action={{ href: UPGRADE, label: t("plan.choose") }}
      />
    );
  }

  const sentence = isMember
    ? t("member.paused")
    : declined
      ? t("status.trialChargeDeclined")
      : t("status.collectionPaused");

  return (
    <AccountBar
      icon={CirclePause}
      tone="warning"
      sentence={sentence}
      action={pausedAction(isMember, declined, t)}
    />
  );
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
