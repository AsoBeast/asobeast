"use client";

import { useCallback, useDeferredValue, useId, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { wordDensity } from "@asobeast/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { pluralize } from "@/lib/format";
import {
  DENSITY_VIEWS,
  densityViewParser,
  type DensityView,
} from "@/lib/search-params";
import { useHydrated } from "@/lib/use-hydrated";
import type { DensityContext, DescriptionSearch } from "./density-inputs";
import { DensityTable } from "./DensityTable";
import { HighlightedText } from "./HighlightedText";

const VIEWS: Record<
  DensityView,
  { tab: string; noun: string; caption: string; empty: string }
> = {
  words: {
    tab: "Words",
    noun: "Word",
    caption: "Most repeated words in the description",
    empty: "No word repeats yet.",
  },
  pairs: {
    tab: "Two words",
    noun: "Phrase",
    caption: "Most repeated two word phrases",
    empty: "No phrase repeats yet.",
  },
  triples: {
    tab: "Three words",
    noun: "Phrase",
    caption: "Most repeated three word phrases",
    empty: "No phrase repeats yet.",
  },
};

function SearchedLine({ searched }: { searched: DescriptionSearch }) {
  if (searched.tracked === 0) return null;
  return (
    <p className="text-dense text-muted-foreground">
      <span>Google Play searches the description.</span>{" "}
      <span>{`It holds ${searched.held} of your ${pluralize(searched.tracked, "tracked keyword")}.`}</span>
    </p>
  );
}

function DensityBody({
  text,
  ignored,
  context,
}: {
  text: string;
  ignored: readonly string[];
  context: DensityContext;
}) {
  const [requested, setView] = useQueryState("density", densityViewParser);
  const [marked, setMarked] = useState<string | null>(null);
  const density = useMemo(
    () => wordDensity(text, { language: context.language, ignored }),
    [text, context.language, ignored],
  );
  const phrases = density.pairs !== null;
  const view = phrases ? requested : "words";
  const rows =
    (view === "words" ? density.single : density[view]) ?? density.single;
  const shown = rows.some((row) => row.text === marked) ? marked : null;
  const onMark = useCallback(
    (row: string) => setMarked((current) => (current === row ? null : row)),
    [],
  );
  const marks = useMemo(
    () => ({ tracked: context.tracked, marked: shown, onMark }),
    [context.tracked, shown, onMark],
  );
  const labels = VIEWS[view];

  return (
    <>
      <p className="text-dense text-muted-foreground">
        <span>{pluralize(density.words, "word")}</span>
      </p>
      {context.searched ? <SearchedLine searched={context.searched} /> : null}
      {phrases ? (
        <Tabs
          value={view}
          onValueChange={(next) =>
            void setView(
              DENSITY_VIEWS.find((option) => option === next) ?? "words",
            )
          }
        >
          <TabsList aria-label="Repeated words shown">
            {DENSITY_VIEWS.map((option) => (
              <TabsOption key={option} value={option}>
                {VIEWS[option].tab}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <DensityTable
        rows={rows}
        caption={labels.caption}
        empty={labels.empty}
        noun={labels.noun}
        marks={marks}
      />
      {shown ? <HighlightedText text={text} row={shown} /> : null}
    </>
  );
}

export function DescriptionDensity({
  text,
  title,
  context,
  level = "h4",
}: {
  text: string;
  title: string | null;
  context: DensityContext;
  level?: "h3" | "h4";
}) {
  const headingId = useId();
  const hydrated = useHydrated();
  const deferred = useDeferredValue(text);
  const ignored = useMemo(
    () =>
      [context.appName, title].filter((value): value is string =>
        Boolean(value),
      ),
    [context.appName, title],
  );
  const Heading = level;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 border-t border-border-subtle pt-3"
    >
      <Heading id={headingId} className="text-heading font-semibold">
        Word density
      </Heading>
      {hydrated ? (
        <DensityBody text={deferred} ignored={ignored} context={context} />
      ) : (
        <div aria-hidden className="flex flex-col gap-3">
          <Skeleton shape="text" className="w-24 text-dense" />
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </section>
  );
}
