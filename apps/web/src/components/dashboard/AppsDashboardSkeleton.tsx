import { getTranslations } from "next-intl/server";
import type { AppView } from "@/lib/search-params";
import { iconRadius } from "@/components/app-icon-radius";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  APPS_PANEL,
  APPS_SECTION,
  APP_GRID,
  PANEL_FOOTER,
} from "./layout-classes";

const CARD_ICON_SIZE = 48;

function AppCardSkeleton() {
  return (
    <Card className="h-full gap-0 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <Skeleton
            className="size-12"
            style={{ borderRadius: iconRadius(CARD_ICON_SIZE) }}
          />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[22px] w-24 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-col gap-1">
          <Skeleton className="my-2 h-1.5 w-full rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
    </Card>
  );
}

export async function AppsDashboardSkeleton({
  view = "table",
}: {
  view?: AppView;
}) {
  const t = await getTranslations("dashboard");
  const tabular = view === "table";
  const frame = tabular ? APPS_PANEL : APPS_SECTION;
  return (
    <div className={frame.section}>
      <div className={frame.header}>
        <h2 className="text-heading">{t("apps.heading")}</h2>
        <Skeleton className="h-8 w-44" />
      </div>
      {tabular ? (
        <>
          <div className="flex flex-col">
            <div className="flex h-9 items-center px-4">
              <Skeleton className="h-4 w-24" />
            </div>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex h-[47px] items-center gap-3 border-t border-border-subtle px-4"
              >
                <Skeleton className="size-6 rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <div className={PANEL_FOOTER}>
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </>
      ) : (
        <ul className={APP_GRID}>
          {Array.from({ length: 4 }).map((_, index) => (
            <li key={index}>
              <AppCardSkeleton />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
