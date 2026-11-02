import { InfoTip } from "@/components/ui/info-tip";
import { PRODUCT_NAME } from "@/lib/brand";

export const RATINGS_BY_MARKET_GUIDE =
  "https://docs.asobeast.com/guides/reviews#compare-ratings-across-markets";

export function RatingsByMarketHelp() {
  return (
    <InfoTip
      label="About ratings by market"
      title="How ratings by market are read"
      summary={`The App Store keeps a separate rating for each storefront. Each row is the average and the number of ratings on the newest listing ${PRODUCT_NAME} captured in that market.`}
    >
      <p className="text-muted-foreground">
        The last row averages the markets above it, each weighted by its number
        of ratings. It covers only the markets listed here, not every
        storefront, and each market was captured on the day in its last column.
      </p>
      <a
        href={RATINGS_BY_MARKET_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
      >
        Read how ratings by market are read
      </a>
    </InfoTip>
  );
}
