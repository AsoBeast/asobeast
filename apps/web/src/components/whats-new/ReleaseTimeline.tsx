"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Release } from "@/lib/whats-new/release-notes";
import { useSeenRelease } from "@/lib/whats-new/seen-release";
import { ReleaseEntry } from "./ReleaseEntry";
import { openOnArrival, unreadOnArrival } from "./release-view";

interface Arrival {
  seen: string | null;
  linked: string;
}

const NOTHING: ReadonlySet<string> = new Set();

function useArrival(newest: string | null): Arrival | null {
  const [seen, markSeen] = useSeenRelease();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  if (arrival === null && seen !== undefined) {
    setArrival({ seen, linked: window.location.hash.slice(1) });
  }

  useEffect(() => {
    if (arrival !== null && newest !== null) markSeen(newest);
  }, [arrival, newest, markSeen]);

  useEffect(() => {
    if (arrival?.linked)
      document.getElementById(arrival.linked)?.scrollIntoView();
  }, [arrival?.linked]);

  return arrival;
}

export function ReleaseTimeline({
  releases,
}: {
  releases: readonly Release[];
}) {
  const t = useTranslations("releaseNotes");
  const newest = releases[0]?.version ?? null;
  const arrival = useArrival(newest);
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  if (releases.length === 0) {
    return <p className="text-body text-muted-foreground">{t("empty")}</p>;
  }
  const newestOnly = new Set(
    releases.slice(0, 1).map((release) => release.version),
  );
  const opened = arrival
    ? openOnArrival(releases, arrival.seen, arrival.linked)
    : newestOnly;
  const unread = arrival ? unreadOnArrival(releases, arrival.seen) : NOTHING;
  const isOpen = (version: string) =>
    toggled.get(version) ?? opened.has(version);

  return (
    <ol
      aria-label={t("releases")}
      className="flex flex-col border-t border-border"
    >
      {releases.map((release, index) => (
        <ReleaseEntry
          key={release.version}
          release={release}
          latest={index === 0}
          open={isOpen(release.version)}
          unread={unread.has(release.version)}
          onToggle={() =>
            setToggled((current) =>
              new Map(current).set(release.version, !isOpen(release.version)),
            )
          }
        />
      ))}
    </ol>
  );
}
