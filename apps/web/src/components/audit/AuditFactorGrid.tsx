import type { AppAuditResult } from "@asobeast/shared";
import { factorSections } from "./factor-sections";
import { FactorCard } from "./FactorCard";

export function AuditFactorGrid({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  return (
    <>
      {factorSections(audit.factors).map((section) => (
        <section
          key={section.id}
          aria-labelledby={`factors-${section.id}`}
          className="flex flex-col gap-3"
        >
          <h2 id={`factors-${section.id}`} className="text-lg font-medium">
            {section.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.factors.map((factor) => (
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
      ))}
    </>
  );
}
