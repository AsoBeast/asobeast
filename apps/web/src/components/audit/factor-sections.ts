import type { AuditFactorResult, AuditGroupId } from "@asobeast/shared";
import { GROUP_LABEL } from "./audit-copy";

export interface FactorSection {
  id: AuditGroupId | "factors";
  label: string;
  factors: AuditFactorResult[];
}

const GROUPS = [
  "discoverability",
  "conversion",
] as const satisfies readonly AuditGroupId[];

export function factorSections(factors: AuditFactorResult[]): FactorSection[] {
  const measurable = factors.filter(
    (factor) => factor.availability !== "not-measurable",
  );
  const ungrouped = measurable.filter((factor) => factor.group === undefined);
  return [
    ...GROUPS.map((id) => ({
      id,
      label: GROUP_LABEL[id],
      factors: measurable.filter((factor) => factor.group === id),
    })),
    { id: "factors" as const, label: "Factors", factors: ungrouped },
  ].filter((section) => section.factors.length > 0);
}
