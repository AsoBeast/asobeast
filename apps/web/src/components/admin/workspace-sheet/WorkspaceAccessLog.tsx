import type { SupportAccessEntry, SupportOutcome } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import { supportActionLabel, supportOutcomeLabel } from "@/lib/admin-support";
import { formatDateTime } from "@/lib/format";
import { SectionNote } from "./SectionNote";

const OUTCOME_TONE: Record<SupportOutcome, string> = {
  attempted: "text-muted-foreground",
  succeeded: "text-foreground",
  failed: "text-destructive",
};

function AccessEntry({ entry }: { entry: SupportAccessEntry }) {
  return (
    <li className="flex flex-col gap-1 py-2 text-dense">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">{supportActionLabel(entry.action)}</span>
        <span className={OUTCOME_TONE[entry.outcome]}>
          {supportOutcomeLabel(entry.outcome)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-2 text-caption text-muted-foreground">
        <span translate="no" className="wrap-anywhere">
          {entry.actorEmail}
        </span>
        <span>{formatDateTime(entry.at)}</span>
      </div>
      {entry.reason ? (
        <blockquote
          dir="auto"
          className="border-l-2 border-border pl-3 wrap-anywhere"
        >
          {entry.reason}
        </blockquote>
      ) : null}
      {entry.detail ? (
        <p className="text-caption wrap-anywhere text-muted-foreground">
          {entry.detail}
        </p>
      ) : null}
    </li>
  );
}

export function WorkspaceAccessLog({
  entries,
}: {
  entries: SupportAccessEntry[];
}) {
  return (
    <SheetSection title="Access log">
      <ul
        aria-label="Access log"
        className="flex flex-col divide-y divide-border-subtle"
      >
        {entries.map((entry, index) => (
          <AccessEntry
            key={`${entry.at}-${entry.action}-${index}`}
            entry={entry}
          />
        ))}
      </ul>
      <SectionNote>
        The last 20 reads and actions on this workspace, opening these details
        included.
      </SectionNote>
    </SheetSection>
  );
}
