import { GAP_TOP } from "@asobeast/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry } from "@/lib/format";
import type { GapEmpty as GapEmptyKind, GapTab } from "@/lib/gap-lists";

const TAB_EMPTY: Record<GapTab, { title: string; body?: string }> = {
  gaps: {
    title: "No keyword gaps right now.",
    body: `A competitor ranks in the top ${GAP_TOP} for none of the keywords you are missing.`,
  },
  winnable: { title: "No winnable gaps right now." },
  threats: { title: "No threats right now." },
  lead: { title: "You do not lead on any keyword yet." },
};

function notCompared(country: string): string {
  return country === ""
    ? "Your competitors have not been checked yet."
    : `Your competitors have not been checked in ${formatCountry(country)} yet.`;
}

export function GapEmpty({
  kind,
  tab,
  country,
}: {
  kind: GapEmptyKind;
  tab: GapTab;
  country: string;
}) {
  if (kind === "noCompetitors") {
    return (
      <EmptyState
        title="Add a competitor to see gaps"
        body="One search serves every app, so this costs no extra store requests."
        action={
          <a
            href="#competitor-search"
            className="text-sm font-medium underline decoration-primary underline-offset-4"
          >
            Add a competitor
          </a>
        }
      />
    );
  }
  if (kind === "allDelisted") {
    return (
      <EmptyState
        title="Every competitor you track is delisted"
        body="There is nothing to compare against until you track one the store still lists."
      />
    );
  }
  if (kind === "notCompared") {
    return (
      <EmptyState
        title={notCompared(country)}
        body="They are compared from the next daily check."
      />
    );
  }
  return <EmptyState {...TAB_EMPTY[tab]} />;
}
