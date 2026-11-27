"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { INTEGRATIONS_PATH, PLAY_SIGN_IN_PATH } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_ROOT, adminSectionFrom } from "@/lib/admin-sections";
import { appRouteFrom, sectionHref } from "@/lib/app-sections";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";
import { WHATS_NEW_PATH } from "./WhatsNewMenuItem";

const WORKSPACE_LABELS: Record<string, string> = {
  "/": "dashboard",
  "/actions": "actionCenter",
  "/alerts": "alerts",
  "/charts": "topCharts",
  "/inspect": "keywordInspector",
  [INTEGRATIONS_PATH]: "integrations",
  [PLAY_SIGN_IN_PATH]: "integrations",
  "/settings": "settings",
  [WHATS_NEW_PATH]: "whatsNew",
};

function AppCrumbs({ id, segment }: { id: string; segment: string }) {
  const t = useTranslations("navigation");
  const shell = useTranslations("shell");
  const data = useCachedQueryData(appDetailOptions(id).queryKey);

  const name = data?.name ?? shell("untitledApp");

  return (
    <>
      <BreadcrumbSeparator className="hidden sm:block" />
      <BreadcrumbItem
        className={segment ? "hidden min-w-0 sm:inline-flex" : "min-w-0"}
      >
        {!data ? (
          <Skeleton className="h-4 w-24" />
        ) : segment ? (
          <BreadcrumbLink asChild>
            <Link href={sectionHref(id, "")} className="truncate">
              {name}
            </Link>
          </BreadcrumbLink>
        ) : (
          <BreadcrumbPage className="truncate">{name}</BreadcrumbPage>
        )}
      </BreadcrumbItem>
      {segment ? (
        <>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">
              {t(`appSections.${segment || "overview"}`)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  );
}

function AdminCrumbs({ segment }: { segment: string }) {
  const t = useTranslations("navigation");
  return (
    <>
      <BreadcrumbItem className="hidden sm:inline-flex">
        <BreadcrumbLink asChild>
          <Link href={ADMIN_ROOT}>{t("admin")}</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="hidden sm:block" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="truncate">
          {t(`adminSections.${segment || "overview"}`)}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const app = appRouteFrom(pathname);
  const { isOperator } = useAuth();
  const admin = adminSectionFrom(pathname);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {admin ? (
          isOperator ? (
            <AdminCrumbs segment={admin.segment} />
          ) : null
        ) : (
          <>
            <BreadcrumbItem
              className={app ? "hidden sm:inline-flex" : undefined}
            >
              {app ? (
                <BreadcrumbLink asChild>
                  <Link href="/">{t("apps")}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>
                  {t(WORKSPACE_LABELS[pathname] ?? "dashboard")}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {app ? <AppCrumbs id={app.id} segment={app.segment} /> : null}
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
