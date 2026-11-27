"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { Store } from "@asobeast/shared";
import { ratedPoints } from "@/components/overview/rating-trend";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import { ratingsHistoryOptions } from "@/lib/queries";
import { presetDays, presetToRange, type RatingsRange } from "@/lib/ranges";
import {
  NEW_RATINGS_GUIDE,
  newRatingsParts,
  tooFewNewRatings,
} from "./new-ratings-copy";
import { hasStarCountReads, newRatingsAverageFor } from "./new-ratings-average";
import { ratingsGrowth } from "./ratings-volume";

const SOURCES: Record<Store, string> = {
  APP_STORE:
    "worked out from the average and the number of ratings the store reported each day",
  GOOGLE_PLAY:
    "worked out from the number of ratings at each star that Google Play reports each day",
};

function NewRatingsHelp({ store }: { store: Store }) {
  return (
    <InfoTip
      label="About the new ratings average"
      title="New ratings average"
      summary={`The average of only the ratings added over the range, ${SOURCES[store]}. The line on the chart averages the 7 days up to each day.`}
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
  store,
  range,
}: {
  id: string;
  store: Store;
  range: RatingsRange;
}) {
  const { data } = useSuspenseQuery(
    ratingsHistoryOptions(id, presetToRange(range)),
  );
  const overall = ratedPoints(data.points).at(-1)?.ratingAvg;
  if (
    overall === undefined ||
    ratingsGrowth(data.points) === null ||
    (store === "GOOGLE_PLAY" && !hasStarCountReads(data.points))
  ) {
    return null;
  }
  const days = presetDays(range);
  const found = newRatingsAverageFor(store, data.points);

  if (!found) {
    return (
      <p key="too-few" className="text-body">
        <span>{`${tooFewNewRatings(days)} `}</span>
        <NewRatingsHelp store={store} />
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
      <NewRatingsHelp store={store} />
    </p>
  );
}
