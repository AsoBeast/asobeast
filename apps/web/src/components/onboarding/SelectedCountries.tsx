import { useId, useRef, type MouseEvent } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { formatCountry } from "@/lib/format";
import { survivingNeighbour, useFocusAfterCommit } from "@/lib/focus-handoff";

export interface MarketKeywordCount {
  market: string;
  active: number | null;
  error: boolean;
}

function countText({ active, error }: MarketKeywordCount): string {
  if (error) return "Keywords unavailable";
  if (active === null) return "Loading keywords…";
  return `${active} active ${active === 1 ? "keyword" : "keywords"}`;
}

const REMOVE_CONTROL = "button[data-remove-country]";
const ROW_LINK = "a[href]";

function rowControl(list: HTMLElement | null, market: string | undefined) {
  if (!list || market === undefined) return null;
  const row = list.querySelector(`li[data-market="${CSS.escape(market)}"]`);
  return (
    row?.querySelector<HTMLElement>(REMOVE_CONTROL) ??
    row?.querySelector<HTMLElement>(ROW_LINK) ??
    null
  );
}

export function SelectedCountries({
  appId,
  homeMarket,
  counts,
  onRemove,
}: {
  appId: string;
  homeMarket: string;
  counts: MarketKeywordCount[];
  onRemove: (market: string) => void;
}) {
  const headingId = useId();
  const list = useRef<HTMLUListElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const homeFirst = [
    ...counts.filter((count) => count.market === homeMarket),
    ...counts.filter((count) => count.market !== homeMarket),
  ];
  const remove = (market: string) => (event: MouseEvent<HTMLElement>) => {
    const survivor = survivingNeighbour(
      homeFirst,
      (count) => count.market === market,
    );
    focusAfterCommit(
      rowControl(list.current, survivor?.market),
      event.currentTarget,
    );
    onRemove(market);
  };
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h4 id={headingId} className="text-dense font-medium">
        Selected countries
      </h4>
      <ul
        ref={list}
        aria-labelledby={headingId}
        className="flex flex-col divide-y divide-border-subtle"
      >
        {homeFirst.map((count) => {
          const name = formatCountry(count.market);
          const removable = count.market !== homeMarket && counts.length > 1;
          return (
            <li
              key={count.market}
              data-market={count.market}
              className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-dense"
            >
              <span className="flex min-w-0 flex-1 basis-40 items-baseline gap-2">
                <span className="font-medium wrap-anywhere">
                  {`${name} (${count.market.toUpperCase()})`}
                </span>
                {count.market === homeMarket ? (
                  <span className="text-caption text-faint-foreground">
                    Home
                  </span>
                ) : null}
              </span>
              <span className="order-last flex basis-full flex-wrap items-center gap-x-3 gap-y-1 sm:order-none sm:basis-auto">
                <span className="numeric text-caption text-muted-foreground">
                  {countText(count)}
                </span>
                <Link
                  href={`/apps/${appId}/keywords?country=${count.market}`}
                  className={FOOTER_LINK}
                >
                  {`Review ${count.market.toUpperCase()} keywords`}
                </Link>
              </span>
              {removable ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${name}`}
                  data-remove-country=""
                  onClick={remove(count.market)}
                >
                  <X />
                </Button>
              ) : (
                <span aria-hidden="true" className="size-7" />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
