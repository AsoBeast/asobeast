import type { ActionEvidence } from "@asobeast/shared";
import { GradedNumber } from "@/components/ui/graded";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { grade } from "@/lib/grade";
import {
  evidenceSections,
  type EvidenceFact,
  type EvidenceList,
} from "./evidence-sections";

function FactValue({ fact }: { fact: EvidenceFact }) {
  if (!fact.grade) return <>{fact.value}</>;
  return (
    <GradedNumber
      value={fact.value}
      grade={grade(fact.grade.metric, fact.grade.value)}
      label={fact.label}
    />
  );
}

function EvidenceLists({ lists }: { lists: EvidenceList[] }) {
  return lists.map((list) => (
    <div key={list.label} className="mt-3 flex flex-col gap-1.5">
      <p className="text-label text-muted-foreground">{list.label}</p>
      <ul className="flex list-none flex-wrap gap-1.5 p-0">
        {list.items.map((entry) => (
          <li key={`${entry.text}~${entry.detail ?? ""}`}>
            <Badge variant="outline" className="h-auto whitespace-normal">
              {entry.text}
              {entry.detail ? (
                <span className="numeric font-mono text-muted-foreground">
                  {entry.detail}
                </span>
              ) : null}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  ));
}

export function ActionEvidencePanel({
  evidence,
  degraded,
  lastSeenAt,
}: {
  evidence: ActionEvidence | null;
  degraded: boolean;
  lastSeenAt: string;
}) {
  if (degraded || !evidence) {
    return (
      <p className="text-sm text-muted-foreground">
        Evidence unavailable for this stored action — it will be rebuilt on the
        next run.
      </p>
    );
  }

  const { facts, lists } = evidenceSections(evidence);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Why this
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-body sm:grid-cols-2">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-border/60 pb-1"
          >
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="numeric font-mono text-right font-medium">
              <FactValue fact={fact} />
            </dd>
          </div>
        ))}
      </dl>
      <EvidenceLists lists={lists} />
      <p className="mt-3 text-caption text-muted-foreground">
        Last confirmed {formatDate(lastSeenAt)}
      </p>
    </details>
  );
}
