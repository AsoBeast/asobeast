import type { SupportFailedJob } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import { queueLabel } from "@/lib/admin-support";
import { formatDateTime, pluralize } from "@/lib/format";
import { SectionEmpty, SectionNote } from "./SectionNote";

function failedWhen(job: SupportFailedJob): string {
  return job.failedAt ? formatDateTime(job.failedAt) : "Time not recorded";
}

function emptyNote(unavailable: boolean): string {
  return unavailable
    ? "The job queue did not answer, so failed jobs are not shown."
    : "No failed store jobs.";
}

export function WorkspaceFailedJobs({
  jobs,
  unavailable,
}: {
  jobs: SupportFailedJob[];
  unavailable: boolean;
}) {
  return (
    <SheetSection title="Failed store jobs">
      {jobs.length === 0 ? (
        <SectionEmpty>{emptyNote(unavailable)}</SectionEmpty>
      ) : (
        <ul
          aria-label="Failed store jobs"
          className="flex flex-col divide-y divide-border-subtle"
        >
          {jobs.map((job) => (
            <li
              key={`${job.queue}-${job.id}`}
              className="flex flex-col gap-1 py-2 text-dense"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span translate="no" className="font-mono text-caption">
                  {job.name}
                </span>
                <span className="text-muted-foreground">
                  {`${queueLabel(job.queue)} · ${pluralize(job.attempts, "attempt")} · ${failedWhen(job)}`}
                </span>
              </div>
              <p className="text-caption wrap-anywhere text-muted-foreground">
                {job.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
      <SectionNote>
        The newest 20 failed App Store and Google Play jobs that name this
        workspace.
      </SectionNote>
    </SheetSection>
  );
}
