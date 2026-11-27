"use client";

import { useEffect, useMemo, useState } from "react";
import type { Store } from "@asobeast/shared";
import { useImageJob } from "@/components/charts/use-chart-image";
import { chartImageFilename } from "@/lib/chart-image/filename";
import type { CardChartKind } from "@/lib/chart-image/share-card/card-chart";
import {
  loadCardIcon,
  loadCardMark,
} from "@/lib/chart-image/share-card/card-icon";
import {
  parseCardOptions,
  SHARE_CARD_PREFERENCE,
  type ShareCardOptions,
} from "@/lib/chart-image/share-card/card-options";
import type { ShareHeadline } from "@/lib/chart-image/share-card/headline";
import {
  renderShareCard,
  type ShareCardSpec,
} from "@/lib/chart-image/share-card/render-card";
import { useStoredPreference } from "@/lib/use-stored-preference";

export interface ShareCardApp {
  id: string;
  name: string | null;
  storeAppId: string;
  iconUrl: string | null;
  store: Store;
}

export interface ShareCardSource {
  chart: "rankings-card" | "position-card" | "visibility-card";
  headline: ShareHeadline;
  kind: CardChartKind;
  app: ShareCardApp;
  keyword?: string;
}

interface CardImages {
  iconUrl: string | null;
  icon: HTMLImageElement | null;
  mark: HTMLImageElement | null;
}

function useCardImages(open: boolean, iconUrl: string | null) {
  const [loaded, setLoaded] = useState<CardImages | null>(null);
  const current = loaded?.iconUrl === iconUrl ? loaded : null;
  useEffect(() => {
    if (!open || current) return;
    let live = true;
    void Promise.all([loadCardIcon(iconUrl), loadCardMark()]).then(
      ([icon, mark]) => {
        if (live) setLoaded({ iconUrl, icon, mark });
      },
    );
    return () => {
      live = false;
    };
  }, [open, iconUrl, current]);
  return current;
}

export function useShareCard(
  source: ShareCardSource,
  open: boolean,
  loading: boolean,
) {
  const [raw, save] = useStoredPreference(SHARE_CARD_PREFERENCE);
  const options = useMemo(() => parseCardOptions(raw), [raw]);
  const images = useCardImages(open, source.app.iconUrl);
  const image = useImageJob();
  const { headline, kind, app } = source;
  const spec = useMemo<ShareCardSpec | null>(
    () =>
      images && {
        headline,
        kind,
        appName: app.name ?? app.storeAppId,
        store: app.store,
        options,
        icon: images.icon,
        mark: images.mark,
      },
    [images, headline, kind, app, options],
  );
  const filename = chartImageFilename({
    chart: source.chart,
    appName: app.name,
    appId: app.id,
    keyword: source.keyword,
    from: headline.from,
    to: headline.to,
    size: options.size,
  });
  const run = (act: typeof image.copy) => () => {
    if (spec && !loading) act(filename, () => renderShareCard(spec));
  };
  return {
    options,
    setOptions: (next: ShareCardOptions) => save(JSON.stringify(next)),
    spec,
    busy: image.pending || spec === null || loading,
    copy: run(image.copy),
    download: run(image.download),
  };
}
