import type { SupportWorkspaceSummary } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { stageWithPlanLabel } from "@/lib/admin-stages";
import type { LabelledValue } from "@/lib/admin-support";
import { formatDateInLocale, formatDateTimeInLocale } from "@/lib/format";

export function standingOf(
  workspace: SupportWorkspaceSummary,
  context: TranslationContext,
): string {
  return stageWithPlanLabel(
    workspace.stage,
    workspace.plan,
    context.translator,
  );
}

function subscriptionLine(
  status: string,
  workspace: SupportWorkspaceSummary,
  context: TranslationContext,
): string {
  if (!workspace.billingInterval) return status;
  const cadence = context.translator(
    `support.cadence.${workspace.billingInterval === "month" ? "month" : "year"}`,
  );
  return context.translator(
    workspace.cancelAtPeriodEnd
      ? "support.subscriptionBilled"
      : "support.subscriptionRenews",
    { status, cadence },
  );
}

function deletionAskedBy(
  by: string,
  workspace: SupportWorkspaceSummary,
  context: TranslationContext,
): string {
  return workspace.deletionRequestedAt
    ? context.translator("support.deletionAskedBy", {
        by,
        date: formatDateInLocale(workspace.deletionRequestedAt, context.locale),
      })
    : by;
}

const fact = (label: string, value: string | null | undefined) =>
  value ? [{ label, value }] : [];

export function workspaceFacts(
  workspace: SupportWorkspaceSummary,
  context: TranslationContext,
): LabelledValue[] {
  const { storedPlan, plan, subscriptionStatus, planExpiresAt } = workspace;
  const t = context.translator;
  return [
    { label: t("support.facts.stage"), value: standingOf(workspace, context) },
    ...fact(
      t("support.facts.storedPlan"),
      storedPlan !== plan ? storedPlan : null,
    ),
    {
      label: t("support.facts.created"),
      value: formatDateInLocale(workspace.createdAt, context.locale),
    },
    ...fact(
      t("support.facts.trialStarted"),
      workspace.trialStartedAt &&
        formatDateInLocale(workspace.trialStartedAt, context.locale),
    ),
    ...fact(
      t("support.facts.trialEnd"),
      workspace.trialEndsAt &&
        formatDateInLocale(workspace.trialEndsAt, context.locale),
    ),
    ...fact(
      t("support.facts.firstPaid"),
      workspace.firstPaidAt &&
        formatDateInLocale(workspace.firstPaidAt, context.locale),
    ),
    ...fact(
      t("support.facts.subscription"),
      subscriptionStatus &&
        subscriptionLine(subscriptionStatus, workspace, context),
    ),
    ...fact(
      workspace.cancelAtPeriodEnd
        ? t("support.facts.cancelsOn")
        : t("support.facts.periodEnds"),
      planExpiresAt && formatDateInLocale(planExpiresAt, context.locale),
    ),
    ...fact(
      t("support.facts.suspendedSince"),
      workspace.suspendedAt &&
        formatDateTimeInLocale(workspace.suspendedAt, context.locale),
    ),
    ...fact(
      t("support.facts.deletesOn"),
      workspace.deletionDueAt &&
        formatDateInLocale(workspace.deletionDueAt, context.locale),
    ),
    ...fact(
      t("support.facts.deletionAskedBy"),
      workspace.deletionRequestedBy &&
        deletionAskedBy(workspace.deletionRequestedBy, workspace, context),
    ),
  ];
}
