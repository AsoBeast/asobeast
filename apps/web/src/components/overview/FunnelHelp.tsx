import type { Store } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";

export const STORE_FUNNEL_GUIDE =
  "https://docs.asobeast.com/guides/store-funnel";

const HELP: Record<Store, { summary: string; detail: string }> = {
  APP_STORE: {
    summary:
      "Impressions, product page views and Get taps come from Apple's App Store Discovery and Engagement report through the App Store Connect key connected in settings. Conversion is Get taps divided by unique impressions.",
    detail:
      "Apple drops rows under five users and adds small noise, and a day is final three days later. Totals add unique counts across markets and sources, so they read slightly high.",
  },
  GOOGLE_PLAY: {
    summary:
      "Store listing visitors and acquisitions come from the monthly store performance files Play Console writes to its Cloud Storage bucket, read through the service account connected in settings. Conversion is acquisitions divided by visitors.",
    detail:
      "A market reads the country file and All markets the traffic source file, so the two split sources differently. Google posts a day three to seven days later and changed how it counts visitors and acquisitions on July 10, 2026, so compare periods on the same side of that date.",
  },
};

export function FunnelHelp({ store }: { store: Store }) {
  const help = HELP[store];
  return (
    <InfoTip
      label="About the store funnel"
      title="Store funnel"
      summary={help.summary}
    >
      <p className="text-muted-foreground">{help.detail}</p>
      <a
        href={STORE_FUNNEL_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
      >
        Read how the numbers are read
      </a>
    </InfoTip>
  );
}
