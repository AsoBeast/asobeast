import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardRange } from "./DashboardRange";

export async function DashboardHeader({
  lede,
  children,
}: {
  lede?: ReactNode;
  children?: ReactNode;
}) {
  const t = await getTranslations();
  return (
    <PageHeader
      title={t("navigation.dashboard")}
      controls={
        <>
          <Suspense fallback={<Skeleton className="h-9 w-36" />}>
            <DashboardRange />
          </Suspense>
          <ImportAppDialog>
            <Button>{t("common.importApp")}</Button>
          </ImportAppDialog>
        </>
      }
    >
      {lede}
      {children}
    </PageHeader>
  );
}
