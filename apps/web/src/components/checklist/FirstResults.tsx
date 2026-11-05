"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { firstRunOptions } from "@/lib/queries";
import { CHECKLIST_LINK } from "./checklist-link";
import { firstResultsRow } from "./first-results";

export function FirstResults({
  appId,
  onNavigate,
}: {
  appId: string | null;
  onNavigate: () => void;
}) {
  const { data } = useQuery({
    ...firstRunOptions(appId ?? ""),
    enabled: appId !== null,
  });
  const row = firstResultsRow(data, appId);
  if (row === null) return null;
  if (row.kind === "checking") {
    return (
      <p className="flex items-center gap-2 text-body">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span>Checking where your app already ranks</span>
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-body">
      <span>Your first positions are in</span>
      <Link
        href={`/apps/${row.appId}/rankings`}
        onClick={onNavigate}
        className={CHECKLIST_LINK}
      >
        See where it ranks
      </Link>
    </p>
  );
}
