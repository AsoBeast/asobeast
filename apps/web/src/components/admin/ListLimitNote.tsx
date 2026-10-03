import { formatNumber } from "@/lib/format";

export function ListLimitNote({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: string;
}) {
  if (total <= shown) return null;

  return (
    <p className="text-sm text-muted-foreground">
      {`Showing the newest ${formatNumber(shown)} of ${formatNumber(total)} ${noun}s.`}{" "}
      Narrow by workspace to see the rest.
    </p>
  );
}
