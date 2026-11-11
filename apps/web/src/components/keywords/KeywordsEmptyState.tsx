import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry } from "@/lib/format";

export function KeywordsEmptyState({ country }: { country: string }) {
  return (
    <EmptyState
      title={`No keywords tracked in ${formatCountry(country)} yet`}
      body="Add the phrases you want this app to rank for and AsoBeast starts capturing positions on the next daily run."
    />
  );
}
