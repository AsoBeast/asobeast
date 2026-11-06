"use client";

import type { ReactNode } from "react";
import { useQueryStates } from "nuqs";
import { appListParsers } from "@/lib/search-params";

export function AppsRow({
  apps,
  changes,
}: {
  apps: ReactNode;
  changes: ReactNode;
}) {
  const [{ view }] = useQueryStates(appListParsers);
  const span =
    view === "table"
      ? ["@6xl/dashboard:col-span-12", "@6xl/dashboard:col-span-12"]
      : ["@6xl/dashboard:col-span-8", "@6xl/dashboard:col-span-4"];
  return (
    <div className="grid gap-6 @6xl/dashboard:grid-cols-12 [&>*]:min-w-0">
      <div className={span[0]}>{apps}</div>
      <div className={span[1]}>{changes}</div>
    </div>
  );
}
