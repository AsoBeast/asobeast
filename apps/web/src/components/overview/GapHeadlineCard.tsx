"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { gapHeadline, headlineLink, headlineText } from "@/lib/gap-headline";
import {
  appDetailOptions,
  competitorAnalysisOptions,
  competitorsOptions,
} from "@/lib/queries";
import { GapHeadlineSkeleton } from "./skeletons";

function GapHeadlineBody({ id, home }: { id: string; home: string }) {
  const { country } = useKeywordScope(id);
  const read = useQuery(competitorAnalysisOptions(id));
  const { data: competitors } = useQuery(competitorsOptions(id));
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="The gap summary could not be loaded."
        read={read}
      />
    );
  }
  if (read.data === undefined) return <GapHeadlineSkeleton />;
  const market = country ?? "";
  const headline = gapHeadline(read.data.gaps, {
    competitors: competitors ?? [],
    country: market,
    home,
  });
  const link = headlineLink(id, headline, market);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="min-w-0 flex-1 text-body wrap-anywhere">
        {headlineText(headline)}
      </p>
      {link ? (
        <Link
          href={link.href}
          className="text-body font-medium underline decoration-primary underline-offset-4 hover:decoration-2 print:hidden"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}

export function GapHeadlineCard({ id }: { id: string }) {
  const { data: app } = useQuery(appDetailOptions(id));
  if (app === undefined || app.isCompetitor) return null;
  return (
    <section aria-label="Gaps against your competitors">
      <Card className="py-4">
        <CardContent className="flex min-h-9 items-center gap-2">
          <div className="min-w-0 flex-1">
            <GapHeadlineBody id={id} home={app.country} />
          </div>
          <InfoTip
            label="About the gap line"
            title="How the gap line is counted"
            summary="The line counts the same lists as the Gap analysis on the competitors page, for the market you are looking at."
          >
            <a
              href="https://docs.asobeast.com/guides/competitors#gap-analysis"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
            >
              Read how the lists are chosen
            </a>
          </InfoTip>
        </CardContent>
      </Card>
    </section>
  );
}
