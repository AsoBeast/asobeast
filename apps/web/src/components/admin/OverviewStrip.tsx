"use client";

import {
  ACTIVATION_WINDOW_DAYS,
  TRIAL_ENDING_SOON_DAYS,
  type AdminActivation,
  type AdminConversion,
  type AdminOverview,
} from "@asobeast/shared";
import { TrendChip } from "@/components/ui/delta-chip";
import { InfoTip } from "@/components/ui/info-tip";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
import { formatShare, rateChange, trialRate } from "@/lib/admin-conversion";
import { countOf } from "@/lib/admin-stages";
import { formatNumber, pluralize } from "@/lib/format";

const ACTIVATION_GUIDE =
  "https://docs.asobeast.com/security/admin-surfaces#activation";

const signedUp = (conversion: AdminConversion) =>
  countOf(conversion.funnel, "signed-up");

function SignupsTile({ conversion }: { conversion: AdminConversion }) {
  return (
    <StatTile
      label="Sign ups"
      value={formatNumber(signedUp(conversion))}
      note={`workspaces in the last ${pluralize(conversion.days, "day")}`}
    />
  );
}

function ActivationTile({ activation }: { activation?: AdminActivation }) {
  return (
    <StatTile
      label="Activation"
      value={
        activation
          ? `${formatNumber(activation.rankedWithinADay)} of ${formatNumber(activation.importedLast30Days)}`
          : "—"
      }
      note={
        activation
          ? `ranked within a day of import · ${formatNumber(activation.completedSetup)} completed setup`
          : undefined
      }
      info={
        <InfoTip
          label="What activation means"
          title="Activation"
          summary={`Of the apps imported in the last ${ACTIVATION_WINDOW_DAYS} days, how many had a position for one of their keywords within 24 hours of the import, which is the time to value the guided setup is built for.`}
        >
          <a
            href={ACTIVATION_GUIDE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground link-underline"
          >
            Read how activation is counted
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
  const canceling = overview.workspaces.canceling ?? 0;
  const trials = conversion.trials ?? { inProgress: 0, endingSoon: 0 };
  const rates = conversion.trialToPaid;
  const rate = rates ? trialRate(rates.current) : null;
  const change = rates ? rateChange(rates.current, rates.previous) : null;

  return (
    <>
      <StatTile
        label="Paying"
        value={formatNumber(countOf(overview.workspaces.byStage, "paying"))}
        note={
          canceling > 0
            ? `${formatNumber(canceling)} canceling at period end`
            : `of ${pluralize(overview.workspaces.total, "workspace")}`
        }
      />
      <StatTile
        label="On trial"
        value={formatNumber(trials.inProgress)}
        note={`${formatNumber(trials.endingSoon)} end within ${TRIAL_ENDING_SOON_DAYS} days`}
      />
      <StatTile
        label="Trial to paid"
        value={rate === null ? "—" : formatShare(rate)}
        delta={
          change === null ? undefined : (
            <TrendChip label="pts" value={change} form="pill" />
          )
        }
        note={
          rates
            ? `${formatNumber(rates.current.paid)} of ${pluralize(rates.current.ended, "trial")} ended in ${pluralize(conversion.days, "day")}`
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
  const { workspaces, users } = overview;
  return (
    <>
      <StatTile
        label="Workspaces"
        value={formatNumber(workspaces.total)}
        note={`${formatNumber(workspaces.pendingDeletion)} pending deletion`}
      />
      <StatTile
        label="Accounts"
        value={formatNumber(users.total)}
        note={`${formatNumber(users.emailVerified)} confirmed · ${formatNumber(users.joinedLast7Days)} joined this week`}
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
  return (
    <MetricStrip columns={4} label="The instance at a glance">
      {overview.billing ? (
        <BillingTiles overview={overview} conversion={conversion} />
      ) : (
        <SelfHostedTiles overview={overview} conversion={conversion} />
      )}
    </MetricStrip>
  );
}
