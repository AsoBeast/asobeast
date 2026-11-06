"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { appViewParser } from "@/lib/search-params";

export function AppsRow({
  apps,
  changes,
}: {
  apps: ReactNode;
  changes: ReactNode;
}) {
  const [view] = useQueryState("view", appViewParser);
  const wide = view === "table";
  return (
    <div className="grid gap-6 @6xl/dashboard:grid-cols-12 [&>*]:min-w-0">
      <div
        className={
          wide ? "@6xl/dashboard:col-span-12" : "@6xl/dashboard:col-span-8"
        }
      >
        {apps}
      </div>
      <div
        className={
          wide ? "@6xl/dashboard:col-span-12" : "@6xl/dashboard:col-span-4"
        }
      >
        {changes}
      </div>
    </div>
  );
}
