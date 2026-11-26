"use client";

import {
  ACTIVATION_WINDOW_DAYS,
  TRIAL_ENDING_SOON_DAYS,
  type AdminActivation,
  type AdminConversion,
  type AdminOverview,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { TrendChip } from "@/components/ui/delta-chip";
import { InfoTip } from "@/components/ui/info-tip";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
import { formatShare, rateChange, trialRate } from "@/lib/admin-conversion";
import { countOf } from "@/lib/admin-stages";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

const ACTIVATION_GUIDE =
  "https://docs.asobeast.com/security/admin-surfaces#activation";

const signedUp = (conversion: AdminConversion) =>
  countOf(conversion.funnel, "signed-up");

function SignupsTile({ conversion }: { conversion: AdminConversion }) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <StatTile
      label={t("overview.signups")}
      value={formatNumberInLocale(signedUp(conversion), locale)}
      note={t("overview.signupsNote", { days: conversion.days })}
    />
  );
}

function ActivationTile({ activation }: { activation?: AdminActivation }) {
  const t = useTranslations("admin");
  return (
    <StatTile
      label={t("overview.activation")}
      value={
        activation
          ? t("overview.activationValue", {
              ranked: activation.rankedWithinADay,
              imported: activation.importedLast30Days,
            })
          : "—"
      }
      note={
        activation
          ? t("overview.activationNote", {
              completed: activation.completedSetup,
            })
          : undefined
      }
      info={
        <InfoTip
          label={t("overview.activationInfoLabel")}
          title={t("overview.activation")}
          summary={t("overview.activationSummary", {
            days: ACTIVATION_WINDOW_DAYS,
          })}
        >
          <a
            href={ACTIVATION_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground link-underline"
          >
            {t("overview.activationGuide")}
          </a>
        </InfoTip>
      }
    />
  );
}

function BillingTiles({
  overview,
  conversion,
}: {
  overview: AdminOverview;
  conversion: AdminConversion;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const canceling = overview.workspaces.canceling ?? 0;
  const trials = conversion.trials ?? { inProgress: 0, endingSoon: 0 };
  const rates = conversion.trialToPaid;
  const rate = rates ? trialRate(rates.current) : null;
  const change = rates ? rateChange(rates.current, rates.previous) : null;

  return (
    <>
      <StatTile
        label={t("overview.paying")}
        value={formatNumberInLocale(
          countOf(overview.workspaces.byStage, "paying"),
          locale,
        )}
        note={
          canceling > 0
            ? t("overview.payingCanceling", { count: canceling })
            : t("overview.payingOf", { total: overview.workspaces.total })
        }
      />
      <StatTile
        label={t("overview.onTrial")}
        value={formatNumberInLocale(trials.inProgress, locale)}
        note={t("overview.trialsEnding", {
          count: trials.endingSoon,
          days: TRIAL_ENDING_SOON_DAYS,
        })}
      />
      <StatTile
        label={t("overview.trialToPaid")}
        value={rate === null ? "—" : formatShare(rate, locale)}
        delta={
          change === null ? undefined : (
            <TrendChip
              label={t("overview.points")}
              value={change}
              form="pill"
            />
          )
        }
        note={
          rates
            ? t("overview.trialRateNote", {
                paid: rates.current.paid,
                ended: rates.current.ended,
                days: conversion.days,
              })
            : undefined
        }
      />
      <SignupsTile conversion={conversion} />
    </>
  );
}

function SelfHostedTiles({
  overview,
  conversion,
}: {
  overview: AdminOverview;
  conversion: AdminConversion;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const { workspaces, users } = overview;
  return (
    <>
      <StatTile
        label={t("overview.workspaces")}
        value={formatNumberInLocale(workspaces.total, locale)}
        note={t("overview.pendingDeletion", {
          count: workspaces.pendingDeletion,
        })}
      />
      <StatTile
        label={t("overview.accounts")}
        value={formatNumberInLocale(users.total, locale)}
        note={t("overview.accountsNote", {
          confirmed: users.emailVerified,
          joined: users.joinedLast7Days,
        })}
      />
      <SignupsTile conversion={conversion} />
      <ActivationTile activation={overview.activation} />
    </>
  );
}

export function OverviewStrip({
  overview,
  conversion,
}: {
  overview: AdminOverview;
  conversion: AdminConversion;
}) {
  const t = useTranslations("admin");
  return (
    <MetricStrip columns={4} label={t("overview.group")}>
      {overview.billing ? (
        <BillingTiles overview={overview} conversion={conversion} />
      ) : (
        <SelfHostedTiles overview={overview} conversion={conversion} />
      )}
    </MetricStrip>
  );
}
