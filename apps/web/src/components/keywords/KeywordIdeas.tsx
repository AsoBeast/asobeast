"use client";

import { useEffect, useRef } from "react";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { IdeasHeader, IdeasStartPrompt } from "./IdeasParts";
import { IdeasResults } from "./IdeasResults";
import { registerIdeasHeading } from "./ideas-opener";
import { useIdeasStart } from "./use-ideas-start";
import { useIdeasStatus } from "./use-ideas-status";

export function KeywordIdeas({
  id,
  country,
  seed,
  onClose,
}: {
  id: string;
  country: string;
  seed: string;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const start = useIdeasStart(id, seed, country);
  const status = useIdeasStatus(id, seed, country, start.succeeded);
  const handOffFocus = useFocusAfterCommit();
  const started =
    start.succeeded ||
    status.probesDone > 0 ||
    status.complete ||
    status.found.length > 0;

  useEffect(
    () =>
      heading.current ? registerIdeasHeading(heading.current, seed) : undefined,
    [seed],
  );

  return (
    <div className="flex flex-col gap-4">
      <IdeasHeader
        heading={heading}
        seed={seed}
        country={country}
        onClose={onClose}
      />
      {started || status.failed ? (
        <IdeasResults id={id} country={country} seed={seed} status={status} />
      ) : (
        <IdeasStartPrompt
          pending={start.pending}
          onStart={(button) => {
            handOffFocus(heading.current, button);
            start.startOnce(undefined);
          }}
        />
      )}
    </div>
  );
}
