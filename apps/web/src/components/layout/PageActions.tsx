"use client";

import { useParams } from "next/navigation";
import { RefreshAction } from "@/components/app-detail/RefreshAction";
import { RunDailyAction } from "@/components/app-detail/RunDailyAction";
import { RunProgress } from "@/components/app-detail/RunProgress";
import { appDetailOptions } from "@/lib/queries";
import { useCachedQueryData } from "@/lib/use-cached-query-data";

function AppPageActions({ appId }: { appId: string }) {
  const detail = useCachedQueryData(appDetailOptions(appId).queryKey);
  if (detail === undefined) return null;

  return (
    <div className="flex items-center gap-2">
      <RunProgress key={appId} appId={appId} />
      <RefreshAction appId={appId} />
      <RunDailyAction appId={appId} />
    </div>
  );
}

export function PageActions() {
  const params = useParams<{ id?: string }>();
  const appId = params?.id;
  return appId ? <AppPageActions appId={appId} /> : null;
}
