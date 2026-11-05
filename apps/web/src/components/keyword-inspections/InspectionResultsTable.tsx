import type { KeywordInspectionResult } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact, formatRating } from "@/lib/format";
import { TITLE_MATCH_LABELS } from "./inspection-format";

const MATCH_VARIANTS = {
  exact: "info",
  allWords: "secondary",
  someWords: "outline",
  none: "ghost",
} as const;

export function InspectionResultsTable({
  keyword,
  results,
}: {
  keyword: string;
  results: KeywordInspectionResult[];
}) {
  return (
    <Table scrollLabel="Search results" scrollFocus="overflow">
      <TableCaption>
        The top {results.length} results for “{keyword}”, in store order
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">#</TableHead>
          <TableHead>App</TableHead>
          <TableHead className="text-right">Rating</TableHead>
          <TableHead className="text-right">Ratings</TableHead>
          <TableHead>Title match</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result) => (
          <TableRow key={`${result.position}-${result.storeAppId}`}>
            <TableCell className="numeric text-right font-mono">
              {result.position}
            </TableCell>
            <TableCell>
              <div className="flex min-w-0 items-center gap-3">
                <AppIcon src={result.iconUrl} name={result.title} size={32} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{result.title}</span>
                  {result.developer ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {result.developer}
                    </span>
                  ) : null}
                </div>
              </div>
            </TableCell>
            <TableCell className="numeric text-right font-mono">
              {result.ratingAvg === null ? "—" : formatRating(result.ratingAvg)}
            </TableCell>
            <TableCell className="numeric text-right font-mono">
              {result.ratingCount === null
                ? "—"
                : formatCompact(result.ratingCount)}
            </TableCell>
            <TableCell>
              <Badge variant={MATCH_VARIANTS[result.titleMatch]}>
                {TITLE_MATCH_LABELS[result.titleMatch]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
