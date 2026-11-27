"use client";

import { useEffect, useRef } from "react";
import {
  isSpiderTerm,
  SPIDER_TERM_MAX_LENGTH,
  SPIDER_TERM_MIN_LENGTH,
} from "@asobeast/shared";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { IdeasHeader, IdeasStartPrompt } from "./IdeasParts";
import { IdeasResults } from "./IdeasResults";
import { registerIdeasHeading } from "./ideas-opener";
import { useIdeasStart } from "./use-ideas-start";
import { useIdeasStatus } from "./use-ideas-status";

type IdeasView = "refused" | "reading" | "start" | "results";

function ideasView(seed: string, started: boolean, read: boolean): IdeasView {
  if (!isSpiderTerm(seed)) return "refused";
  if (started) return "results";
  return read ? "start" : "reading";
}

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
  const view = ideasView(seed, started || status.failed, status.read);

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
      {view === "refused" ? (
        <p className="text-body text-muted-foreground">
          {`Ideas need a keyword of ${SPIDER_TERM_MIN_LENGTH} to ${SPIDER_TERM_MAX_LENGTH} characters.`}
        </p>
      ) : null}
      {view === "reading" ? (
        <p className="text-body text-muted-foreground">
          Checking for an earlier search on this keyword…
        </p>
      ) : null}
      {view === "results" ? (
        <IdeasResults id={id} country={country} seed={seed} status={status} />
      ) : null}
      {view === "start" ? (
        <IdeasStartPrompt
          pending={start.pending}
          onStart={(button) => {
            handOffFocus(heading.current, button);
            start.startOnce(undefined);
          }}
        />
      ) : null}
    </div>
  );
}
