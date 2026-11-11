import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry } from "@/lib/format";

export function KeywordsEmptyState({
  country,
  onFindKeywords,
}: {
  country: string;
  onFindKeywords?: (leaving: HTMLElement) => void;
}) {
  return (
    <EmptyState
      title={`No keywords tracked in ${formatCountry(country)} yet`}
      body="Add the phrases you want this app to rank for and AsoBeast starts capturing positions on the next daily run."
      action={
        onFindKeywords ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => onFindKeywords(event.currentTarget)}
          >
            Find keywords to track
          </Button>
        ) : null
      }
    />
  );
}
