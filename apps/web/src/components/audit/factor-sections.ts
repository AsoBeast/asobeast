import type { AuditFactorResult, AuditGroupId } from "@asobeast/shared";
import { groupLabel } from "./audit-copy";
import type { MessageTranslator } from "@/i18n/translator";

export interface FactorSection {
  id: AuditGroupId | "factors";
  label: string;
  factors: AuditFactorResult[];
}

const GROUPS = [
  "discoverability",
  "conversion",
] as const satisfies readonly AuditGroupId[];

export function factorSections(
  factors: AuditFactorResult[],
  t?: MessageTranslator,
): FactorSection[] {
  const measurable = factors.filter(
    (factor) => factor.availability !== "not-measurable",
  );
  const ungrouped = measurable.filter((factor) => factor.group === undefined);
  return [
    ...GROUPS.map((id) => ({
      id,
      label: groupLabel(id, t),
      factors: measurable.filter((factor) => factor.group === id),
    })),
    {
      id: "factors" as const,
      label: t ? t("factors") : "Factors",
      factors: ungrouped,
    },
  ].filter((section) => section.factors.length > 0);
}
