import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { viewerIsOperator } from "@/lib/viewer";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  if (!(await viewerIsOperator())) notFound();

  return (
    <div className="page-wide flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display tracking-tight text-balance">Admin</h1>
        <p className="text-body text-muted-foreground">
          The whole instance, across every workspace. Only the platform operator
          can open this page.
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
