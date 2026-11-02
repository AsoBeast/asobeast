import { Badge } from "@/components/ui/badge";
import { GradedNumber } from "@/components/ui/graded";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatCountry,
  formatDate,
  formatNumber,
  formatRating,
} from "@/lib/format";
import { grade } from "@/lib/grade";
import type { MarketRatingRow as Row } from "@/lib/ratings-by-market";

const NO_RATING = "No rating yet";
const NOT_CAPTURED = "Not captured yet";

function Dash({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Average({ row, name }: { row: Row; name: string }) {
  if (row.state === "uncaptured") return <Dash label={NOT_CAPTURED} />;
  if (row.ratingAvg === null) return <Dash label={NO_RATING} />;
  return (
    <GradedNumber
      value={formatRating(row.ratingAvg)}
      grade={grade("rating", row.ratingAvg)}
      label={`Rating in ${name}`}
    />
  );
}

function RatingCount({ row }: { row: Row }) {
  if (row.state === "uncaptured") return <Dash label={NOT_CAPTURED} />;
  if (row.ratingCount === null) return <Dash label={NO_RATING} />;
  return (
    <span className="numeric font-mono">{formatNumber(row.ratingCount)}</span>
  );
}

export function MarketRatingRow({
  row,
  selected,
}: {
  row: Row;
  selected: boolean;
}) {
  const name = formatCountry(row.country);
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      aria-current={selected ? "true" : undefined}
    >
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          <span className="numeric font-mono">{row.country.toUpperCase()}</span>
          <span>{name}</span>
          {row.home ? <Badge variant="secondary">Home</Badge> : null}
          {selected ? <Badge variant="info">Selected</Badge> : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Average row={row} name={name} />
      </TableCell>
      <TableCell className="text-right">
        <RatingCount row={row} />
      </TableCell>
      <TableCell className="text-right">
        {row.capturedAt === null ? (
          <span className="text-muted-foreground">{NOT_CAPTURED}</span>
        ) : (
          formatDate(row.capturedAt)
        )}
      </TableCell>
    </TableRow>
  );
}
