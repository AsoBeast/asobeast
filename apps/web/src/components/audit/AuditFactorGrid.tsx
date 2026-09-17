import type { AppAuditResult, AuditGroupId } from "@asobeast/shared";
import { GROUP_LABEL } from "./audit-copy";
import { FactorCard } from "./FactorCard";

const GROUPS = [
  "discoverability",
  "conversion",
] as const satisfies readonly AuditGroupId[];

export function AuditFactorGrid({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const measurable = audit.factors.filter(
    (factor) => factor.availability !== "not-measurable",
  );

  return (
    <>
      {GROUPS.map((group) => {
        const factors = measurable.filter((factor) => factor.group === group);
        if (factors.length === 0) return null;
        return (
          <section
            key={group}
            aria-label={GROUP_LABEL[group]}
            className="flex flex-col gap-3"
          >
            <h2 className="text-lg font-medium">{GROUP_LABEL[group]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {factors.map((factor) => (
                <FactorCard
                  key={factor.id}
                  appId={appId}
                  factor={factor}
                  store={audit.store}
                  totalWeight={audit.totalWeight}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
