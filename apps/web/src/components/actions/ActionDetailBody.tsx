import Link from "next/link";
import { useTranslations } from "next-intl";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ActionDetail, ActionItem } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/api";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { ActionEvidencePanel } from "./ActionEvidencePanel";
import { ActionExplain } from "./ActionExplain";
import { ActionImpactMeter } from "./ActionImpactMeter";
import { ActionHistory } from "./ActionHistory";
import { ActionNote } from "./ActionNote";
import { ActionOutcome } from "./ActionOutcome";
import { ActionSteps } from "./ActionSteps";
import { ActionTrendChart } from "./ActionTrendChart";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-heading">{title}</h3>
      {children}
    </section>
  );
}

function SampleReviews({ item }: { item: ActionItem }) {
  const t = useTranslations("actions");
  if (item.evidence?.rule !== "reviews.investigate_theme") return null;
  return (
    <Link
      href={`/apps/${item.scope.appId}/reviews`}
      className="self-start text-dense font-medium underline-offset-4 hover:underline"
    >
      {t("detail.sampleReviews")}
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
  const t = useTranslations("actions");
  const locale = useAppLocale();
  if (isNotFound(detail.error)) return null;
  if (detail.error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>{t("detail.loadFailed")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            {detail.error.message}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void detail.refetch()}
            >
              {t("tryAgain")}
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
      <Section title={t("detail.why")}>
        <ActionEvidencePanel evidence={shown.evidence} />
        <SampleReviews item={shown} />
      </Section>
      <Section title={t("detail.how")}>
        <ActionSteps item={shown} />
      </Section>
      {detail.data?.trend ? (
        <Section title={t("detail.trend")}>
          <ActionTrendChart trend={detail.data.trend} item={shown} />
        </Section>
      ) : null}
      {detail.data?.outcome ? (
        <Section title={t("detail.outcome")}>
          <ActionOutcome
            outcome={detail.data.outcome}
            depth={detail.data.trend?.depth ?? null}
          />
        </Section>
      ) : null}
      {detail.data ? (
        <Section title={t("detail.history")}>
          <ActionHistory events={detail.data.events} />
        </Section>
      ) : null}
      <Section title={t("detail.note")}>
        <ActionNote key={shown.id} item={shown} />
      </Section>
      <ActionExplain item={shown} />
      <p className="text-caption text-muted-foreground">
        {t("detail.confirmed", {
          date: formatDateInLocale(shown.lastSeenAt, locale),
          version: shown.formulaVersion,
        })}
      </p>
    </div>
  );
}
