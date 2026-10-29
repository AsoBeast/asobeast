import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function FilteredEmpty({
  title,
  body = "Change or clear the filters to see the rows again.",
  onClear,
}: {
  title: string;
  body?: string;
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title={title}
      body={body}
      className="border-0"
      action={
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}
