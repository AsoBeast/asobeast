"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, Loader2, Plus, RotateCw, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { SelectFilter } from "@/components/data-table/SelectFilter";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addKeywords, ApiError } from "@/lib/api";
import { countryFlag, formatCountry } from "@/lib/format";
import {
  appDetailOptions,
  invalidateKeywordMutation,
  keywordCountriesOptions,
  keywordIdeasOptions,
} from "@/lib/queries";
import { ideasCountryParser } from "@/lib/search-params";
import {
  CollapseToggle,
  CollapsibleCard,
  CollapsibleContent,
} from "./CollapsibleSection";
import { UNNAMED_COMPETITOR } from "./comparison-scores";
import { groupIdeasBySeed, ideaSignal, ideaUsers } from "./keyword-idea-groups";

function IdeaList({ id, country }: { id: string; country: string }) {
  const queryClient = useQueryClient();
  const ideas = useQuery(keywordIdeasOptions(id, country));
  const [tracked, setTracked] = useState<ReadonlySet<string>>(new Set());
  const track = useMutation({
    mutationFn: (text: string) => addKeywords(id, [text], country),
    onSuccess: (_result, text) => {
      setTracked((known) => new Set([...known, text]));
      invalidateKeywordMutation(queryClient, id);
      toast.success(`Now tracking ${text} in ${formatCountry(country)}`);
    },
    onError: (error, text) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${text}`,
      );
    },
  });

  if (ideas.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (ideas.isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <span>
          {ideas.error instanceof ApiError
            ? ideas.error.envelope.message
            : "Could not load keyword ideas."}
        </span>
        <Button variant="outline" size="sm" onClick={() => ideas.refetch()}>
          <RotateCw />
          Retry
        </Button>
      </div>
    );
  }

  const groups = groupIdeasBySeed(ideas.data.seeds, ideas.data.ideas);
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        {ideas.data.seeds.length === 0
          ? "Your competitors' titles and subtitles hold no phrases to search from in this market yet."
          : "The store suggested nothing new for your competitors' phrases in this market."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section
          key={group.seed}
          aria-label={`Ideas from ${group.seed}`}
          className="flex flex-col gap-1"
        >
          <h3 className="text-xs text-muted-foreground">
            From competitors&apos; phrase{" "}
            <span className="font-medium text-foreground">{group.seed}</span>
          </h3>
          <ul className="flex flex-col divide-y">
            {group.ideas.map((idea) => {
              const already = tracked.has(idea.text);
              const pending = track.isPending && track.variables === idea.text;
              const users = ideaUsers(idea, UNNAMED_COMPETITOR);
              return (
                <li
                  key={idea.text}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{idea.text}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ideaSignal(idea)}
                      {users ? ` · ${users}` : null}
                    </span>
                  </div>
                  <Button
                    variant={already ? "ghost" : "outline"}
                    size="sm"
                    disabled={already || track.isPending}
                    aria-label={
                      already ? `${idea.text} is tracked` : `Track ${idea.text}`
                    }
                    onClick={() => track.mutate(idea.text)}
                  >
                    {pending ? (
                      <Loader2 className="animate-spin" />
                    ) : already ? (
                      <Check />
                    ) : (
                      <Plus />
                    )}
                    {already ? "Tracked" : "Track"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function KeywordIdeas({ id }: { id: string }) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const { data: countries } = useSuspenseQuery(keywordCountriesOptions(id));
  const [requested, setRequested] = useQueryState("ideas", ideasCountryParser);
  const [searched, setSearched] = useState<string | null>(null);

  const markets = [
    ...new Set([app.country, ...countries.map((entry) => entry.country)]),
  ];
  const country = markets.includes(requested) ? requested : app.country;
  const options = markets.map((market) => ({
    value: market,
    label: `${countryFlag(market)} ${formatCountry(market)}`.trim(),
  }));

  return (
    <CollapsibleCard section="ideas">
      <CardHeader>
        <CardDescription>Keyword ideas</CardDescription>
        <CardAction>
          <CollapseToggle label="keyword ideas" />
        </CardAction>
        <CardTitle>
          Searches people make around your competitors&apos; phrases
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {markets.length > 1 ? (
            <SelectFilter
              title="Ideas market"
              value={country}
              options={options}
              onChange={(next) =>
                void setRequested(next === app.country ? null : next)
              }
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={searched === country}
            onClick={() => setSearched(country)}
          >
            <Search />
            Find ideas
          </Button>
        </div>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>
          {searched === country ? (
            <IdeaList id={id} country={country} />
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Takes the phrases your competitors share in their titles and
              subtitles and asks the store which searches people really make
              around them in {formatCountry(country)}. Phrases you already track
              are left out.
            </p>
          )}
        </CardContent>
      </CollapsibleContent>
    </CollapsibleCard>
  );
}
