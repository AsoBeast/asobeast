"use client";

import type { SerpEntryItem, Store } from "@asobeast/shared";
import { TrackButton } from "@/components/competitors/TrackButton";
import { StoreLinkButton } from "@/components/StoreLinkButton";
import { useFocusGroupClaim } from "@/lib/focus-handoff";
import type { SerpRole } from "./serp-csv";

const serpTrackFocusKey = (storeAppId: string) => `serp-track:${storeAppId}`;

export function SerpRowActions({
  appId,
  store,
  country,
  entry,
  role,
}: {
  appId: string;
  store: Store;
  country: string;
  entry: SerpEntryItem;
  role: SerpRole;
}) {
  const trackable = role === "other";
  const focusKey = serpTrackFocusKey(entry.storeAppId);
  const group = useFocusGroupClaim(focusKey, trackable);

  return (
    <div ref={group} className="flex items-center gap-1">
      <StoreLinkButton
        store={store}
        storeAppId={entry.storeAppId}
        country={country}
        title={entry.title}
      />
      {trackable ? (
        <TrackButton
          id={appId}
          storeAppId={entry.storeAppId}
          title={entry.title}
          label={`Track ${entry.title} at #${entry.position}`}
          focusKey={focusKey}
          className="max-sm:[&>span]:sr-only"
        />
      ) : null}
    </div>
  );
}
