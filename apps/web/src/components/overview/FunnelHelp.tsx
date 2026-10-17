import { InfoTip } from "@/components/ui/info-tip";

export const STORE_FUNNEL_GUIDE =
  "https://docs.asobeast.com/guides/store-funnel";

export function FunnelHelp() {
  return (
    <InfoTip
      label="About the store funnel"
      title="Store funnel"
      summary="Impressions, product page views and Get taps come from Apple's App Store Discovery and Engagement report through the App Store Connect key connected in settings. Conversion is Get taps divided by unique impressions."
    >
      <p className="text-muted-foreground">
        Apple drops rows under five users and adds small noise, and a day is
        final three days later. Totals add unique counts across markets and
        sources, so they read slightly high.
      </p>
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
