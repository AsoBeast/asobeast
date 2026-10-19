import Link from "next/link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SUGGESTED_COLUMNS,
  type LocalizationGrid,
  type SuggestedMarketHint,
} from "@/lib/app-localizations";
import { formatCountry, formatNumber } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import { OriginBadge } from "./OriginBadge";
import { ReadRoleBadge } from "./ReadRoleBadge";

function NotRead() {
  return (
    <>
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <span className="sr-only">Not read</span>
    </>
  );
}

const SUGGESTED_COLUMN = "border-l border-dashed border-border";

export function LocalizationMatrix({
  grid,
  hint,
}: {
  grid: LocalizationGrid;
  hint: SuggestedMarketHint | null;
}) {
  const columns = [...grid.markets, ...grid.suggested];
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="min-w-0 rounded-lg border border-border">
        <Table scrollLabel="Localization matrix" scrollFocus="overflow">
          <TableCaption className="sr-only">
            {grid.suggested.length > 0
              ? `Which of your markets read each localization, and up to ${formatNumber(SUGGESTED_COLUMNS)} suggested markets`
              : "Which of your markets read each localization"}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Read in your markets</TableHead>
              {grid.markets.map((country) => (
                <TableHead
                  key={country}
                  scope="col"
                  title={formatCountry(country)}
                >
                  {country.toUpperCase()}
                  <span className="sr-only"> {formatCountry(country)}</span>
                </TableHead>
              ))}
              {grid.suggested.map((country) => (
                <TableHead
                  key={country}
                  scope="col"
                  title={`${formatCountry(country)}, suggested`}
                  className={SUGGESTED_COLUMN}
                >
                  {country.toUpperCase()}{" "}
                  <span className="font-normal normal-case">suggested</span>
                  <span className="sr-only"> {formatCountry(country)}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {grid.rows.map((row) => (
              <TableRow key={row.localization}>
                <TableHead
                  scope="row"
                  className="text-body normal-case text-foreground"
                >
                  <span className="mr-2 font-medium">
                    {localizationName(row.localization)}
                  </span>
                  <OriginBadge origin={row.origin} />
                </TableHead>
                {row.cells.map((role, index) => (
                  <TableCell
                    key={columns[index]}
                    className={
                      index >= grid.markets.length
                        ? SUGGESTED_COLUMN
                        : undefined
                    }
                  >
                    {role === null ? (
                      <NotRead />
                    ) : (
                      <ReadRoleBadge role={role} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hint ? (
        <p className="text-caption text-muted-foreground">
          {hint.text}{" "}
          <Link
            href={hint.href}
            className="font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
          >
            {hint.link}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
