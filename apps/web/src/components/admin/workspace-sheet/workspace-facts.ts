import {
  RENEWAL_CADENCE,
  type SupportWorkspaceSummary,
} from "@asobeast/shared";
import { heldPlanLabel, stageLabel } from "@/lib/admin-stages";
import type { LabelledValue } from "@/lib/admin-support";
import { formatDate, formatDateTime } from "@/lib/format";

export function standingOf(workspace: SupportWorkspaceSummary): string {
  const stage = stageLabel(workspace.stage, workspace.plan);
  const held = workspace.stage ? heldPlanLabel(workspace.plan) : null;
  return held ? `${stage} · ${held}` : stage;
}

function subscriptionLine(
  status: string,
  workspace: SupportWorkspaceSummary,
): string {
  const words = status.replaceAll("_", " ");
  return workspace.billingInterval
    ? `${words}, renews ${RENEWAL_CADENCE[workspace.billingInterval]}`
    : words;
}

function deletionAskedBy(
  by: string,
  workspace: SupportWorkspaceSummary,
): string {
  return workspace.deletionRequestedAt
    ? `${by} on ${formatDate(workspace.deletionRequestedAt)}`
    : by;
}

const fact = (label: string, value: string | null | undefined) =>
  value ? [{ label, value }] : [];

export function workspaceFacts(
  workspace: SupportWorkspaceSummary,
): LabelledValue[] {
  const { storedPlan, plan, subscriptionStatus, planExpiresAt } = workspace;
  return [
    { label: "Stage", value: standingOf(workspace) },
    ...fact("Plan stored", storedPlan !== plan ? storedPlan : null),
    { label: "Created", value: formatDate(workspace.createdAt) },
    ...fact(
      "Trial started",
      workspace.trialStartedAt && formatDate(workspace.trialStartedAt),
    ),
    ...fact(
      "Trial end",
      workspace.trialEndsAt && formatDate(workspace.trialEndsAt),
    ),
    ...fact(
      "First paid",
      workspace.firstPaidAt && formatDate(workspace.firstPaidAt),
    ),
    ...fact(
      "Subscription",
      subscriptionStatus && subscriptionLine(subscriptionStatus, workspace),
    ),
    ...fact(
      workspace.cancelAtPeriodEnd ? "Cancels on" : "Period ends",
      planExpiresAt && formatDate(planExpiresAt),
    ),
    ...fact(
      "Suspended since",
      workspace.suspendedAt && formatDateTime(workspace.suspendedAt),
    ),
    ...fact(
      "Deletes on",
      workspace.deletionDueAt && formatDate(workspace.deletionDueAt),
    ),
    ...fact(
      "Deletion asked by",
      workspace.deletionRequestedBy &&
        deletionAskedBy(workspace.deletionRequestedBy, workspace),
    ),
  ];
}
