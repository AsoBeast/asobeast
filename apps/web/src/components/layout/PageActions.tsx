"use client";

import { useParams } from "next/navigation";
import { RefreshAction } from "@/components/app-detail/RefreshAction";
import { RunDailyAction } from "@/components/app-detail/RunDailyAction";

export function PageActions() {
  const params = useParams<{ id?: string }>();
  const appId = params?.id;
  if (!appId) return null;

  return (
    <div className="flex items-center gap-2">
      <RefreshAction appId={appId} />
      <RunDailyAction appId={appId} />
    </div>
  );
}
