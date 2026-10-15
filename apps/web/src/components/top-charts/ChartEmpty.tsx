import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

export function ChartEmpty({
  captured,
  date,
  action,
}: {
  captured: boolean;
  date: string | null;
  action?: ReactNode;
}) {
  return captured ? (
    <EmptyState
      icon={Trophy}
      title={`No capture of this chart on ${formatDate(date)}`}
      body="Pick a captured day, or capture today."
      action={action}
    />
  ) : (
    <EmptyState
      icon={Trophy}
      title="This chart has not been captured yet"
      body="Capture it now, or follow it so the daily run keeps it."
      action={action}
    />
  );
}
