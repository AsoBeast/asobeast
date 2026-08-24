"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_SECTIONS, appRouteFrom, sectionHref } from "@/lib/app-sections";
import { appDetailOptions } from "@/lib/queries";

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
  const { data } = useQuery(appDetailOptions(id));

  const name = data?.name ?? "Untitled app";

  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="min-w-0">
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
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{sectionLabel(segment)}</BreadcrumbPage>
          </BreadcrumbItem>
        </>
      ) : null}
    </>
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const app = appRouteFrom(pathname);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
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
      </BreadcrumbList>
    </Breadcrumb>
  );
}
