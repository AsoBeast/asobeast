"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ratedPoints } from "@/components/overview/rating-trend";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetDays, presetToRange, type RatingsRange } from "@/lib/ranges";
import { newRatingsParts, tooFewNewRatings } from "./new-ratings-copy";
import { newRatingsAverage } from "./new-ratings-average";
import { ratingsGrowth } from "./ratings-volume";

const NEW_RATINGS_GUIDE =
  "https://docs.asobeast.com/guides/reviews#new-ratings-average";

function NewRatingsHelp() {
  return (
    <InfoTip
      label="About the new ratings average"
      title="New ratings average"
      summary="The average of only the ratings added over the range, worked out from the average and the number of ratings the store reported each day. The line on the chart averages the 7 days up to each day."
    >
      <a
        href={NEW_RATINGS_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read how the new ratings average is worked out
      </a>
    </InfoTip>
  );
}

function Rating({ value, label }: { value: number; label: string }) {
  return (
    <GradedNumber
      value={formatRating(value)}
      grade={grade("rating", value)}
      label={label}
    />
  );
}

export function NewRatingsSentence({
  id,
  range,
}: {
  id: string;
  range: RatingsRange;
}) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const overall = ratedPoints(data.points).at(-1)?.ratingAvg;
  if (overall === undefined || ratingsGrowth(data.points) === null) {
    return null;
  }
  const days = presetDays(range);
  const found = newRatingsAverage(data.points);

  if (!found) {
    return (
      <p key="too-few" className="text-body">
        <span>{`${tooFewNewRatings(days)} `}</span>
        <NewRatingsHelp />
      </p>
    );
  }

  const [lead, value, middle] = newRatingsParts(found.average, overall, days);
  return (
    <p key="average" className="text-body">
      <span>{`${lead} `}</span>
      <Rating value={value} label="New ratings average" />
      <span>{` ${middle} `}</span>
      <Rating value={overall} label="Overall average" />
      <span>{". "}</span>
      <NewRatingsHelp />
    </p>
  );
}
