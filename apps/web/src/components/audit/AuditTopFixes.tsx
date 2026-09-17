import Link from "next/link";
import type { AuditRecommendations } from "@asobeast/shared";
import { Card, CardContent } from "@/components/ui/card";
import { liftLabel } from "./audit-copy";
import { topFixes } from "./top-fixes";

export function AuditTopFixes({
  recommendations,
}: {
  recommendations: AuditRecommendations;
}) {
  const fixes = topFixes(recommendations);

  return (
    <Card>
      <CardContent>
        <section
          aria-labelledby="top-fixes-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="top-fixes-heading" className="text-lg font-medium">
            Top fixes
          </h2>
          {fixes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No change is waiting on you right now.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {fixes.map((item, index) => (
                <li
                  key={`${item.factorId}-${item.checkId}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span>
                    <span className="numeric font-mono text-muted-foreground">
                      {index + 1}.{" "}
                    </span>
                    {item.label}
                  </span>
                  <span className="numeric shrink-0 font-mono font-semibold">
                    {liftLabel(item.lift)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Link
            href="#action-plan"
            className="w-fit text-sm font-medium underline-offset-4 hover:underline"
          >
            View the full plan
          </Link>
        </section>
      </CardContent>
    </Card>
  );
}
