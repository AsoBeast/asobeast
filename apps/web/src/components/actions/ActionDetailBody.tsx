import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ActionDetail, ActionItem } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ActionEvidencePanel } from "./ActionEvidencePanel";
import { ActionExplain } from "./ActionExplain";
import { ActionImpactMeter } from "./ActionImpactMeter";
import { ActionSteps } from "./ActionSteps";

export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.envelope.statusCode === 404;

export const ACTION_NOT_FOUND =
  "This action no longer exists. It may have been pruned after 180 days.";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-subtitle">{title}</h3>
      {children}
    </section>
  );
}

function SampleReviews({ item }: { item: ActionItem }) {
  if (item.evidence?.rule !== "reviews.investigate_theme") return null;
  return (
    <Link
      href={`/apps/${item.scope.appId}/reviews`}
      className="self-start text-sm font-medium underline-offset-4 hover:underline"
    >
      Read the sample reviews
    </Link>
  );
}

export function ActionDetailBodySkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ActionDetailBody({
  detail,
  item,
}: {
  detail: UseQueryResult<ActionDetail>;
  item: ActionItem | undefined;
}) {
  if (isNotFound(detail.error)) return null;
  if (detail.error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>The action could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {detail.error.message}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void detail.refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  const shown = detail.data ?? item;
  if (!shown) return <ActionDetailBodySkeleton />;

  return (
    <div className="@container/sheet flex flex-col gap-6 p-4">
      <ActionImpactMeter impact={shown.impact} />
      <Section title="Why this">
        <ActionEvidencePanel evidence={shown.evidence} />
        <SampleReviews item={shown} />
      </Section>
      <Section title="How to fix">
        <ActionSteps item={shown} />
      </Section>
      <ActionExplain item={shown} />
      <p className="text-caption text-muted-foreground">
        Evidence last confirmed {formatDate(shown.lastSeenAt)} · formula{" "}
        {shown.formulaVersion}
      </p>
    </div>
  );
}
