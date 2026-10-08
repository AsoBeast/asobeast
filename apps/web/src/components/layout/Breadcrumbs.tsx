"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { APP_SECTIONS, appRouteFrom, sectionHref } from "@/lib/app-sections";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

const WORKSPACE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/actions": "Action Center",
  "/settings": "Settings",
};

function sectionLabel(segment: string): string {
  return (
    APP_SECTIONS.find((section) => section.segment === segment)?.label ??
    "Setup"
  );
}

function AppCrumbs({ id, segment }: { id: string; segment: string }) {
  const data = useCachedQueryData(appDetailOptions(id).queryKey);

  const name = data?.name ?? "Untitled app";

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
              {sectionLabel(segment)}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  );
}

function AdminCrumbs({ label }: { label: string }) {
  return (
    <>
      <BreadcrumbItem className="hidden sm:inline-flex">
        <BreadcrumbLink asChild>
          <Link href={ADMIN_ROOT}>Admin</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="hidden sm:block" />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
      </BreadcrumbItem>
    </>
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const app = appRouteFrom(pathname);
  const { isOperator } = useAuth();
  const admin = adminSectionFrom(pathname);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {admin ? (
          isOperator ? (
            <AdminCrumbs label={admin.label} />
          ) : null
        ) : (
          <>
            <BreadcrumbItem
              className={app ? "hidden sm:inline-flex" : undefined}
            >
              {app ? (
                <BreadcrumbLink asChild>
                  <Link href="/">Apps</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>
                  {WORKSPACE_LABELS[pathname] ?? "Dashboard"}
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
