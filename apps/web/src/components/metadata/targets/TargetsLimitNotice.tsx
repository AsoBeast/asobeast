"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { UPGRADE_PATH, type ListingTargetsSaveResult } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { notTrackedLines, notTrackedSentence } from "@/lib/listing-targets";

export function TargetsLimitNotice({
  outcome,
}: {
  outcome: ListingTargetsSaveResult | null;
}) {
  const sentence = outcome ? notTrackedSentence(outcome.notTracked) : null;
  if (!outcome || sentence === null) return null;
  const lines = notTrackedLines(outcome.notTracked);
  return (
    <Alert role="note" variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        <span>{sentence}</span>
        {lines.length > 1 ? (
          <ul className="list-disc pl-4">
            {lines.map((line) => (
              <li key={line} translate="no">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {outcome.quota?.upgradeTo ? (
          <>
            {" "}
            <Button asChild variant="link" className="h-auto w-fit p-0">
              <Link href={UPGRADE_PATH}>See plans</Link>
            </Button>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
