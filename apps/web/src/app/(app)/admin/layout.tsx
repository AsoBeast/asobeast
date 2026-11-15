import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AdminAccessNotice } from "@/components/admin/AdminAccessNotice";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { getQueryClient } from "@/lib/get-query-client";
import { adminOverviewOptions } from "@/lib/queries";
import { viewerAdminAccess } from "@/lib/viewer";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const access = await viewerAdminAccess();
  if (access === "denied") notFound();
  if (access !== "granted") {
    return (
      <div className="page-wide flex flex-col gap-6">
        <PageHeader title="Admin" />
        <AdminAccessNotice access={access} />
      </div>
    );
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(adminOverviewOptions);

  return (
    <div className="page-wide flex flex-col gap-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminHeader />
      </HydrationBoundary>
      <AdminNav />
      {children}
    </div>
  );
}
