import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalizationGrid } from "@/lib/app-localizations";
import { formatCountry } from "@/lib/format";
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

export function LocalizationMatrix({ grid }: { grid: LocalizationGrid }) {
  return (
    <div className="min-w-0 rounded-lg border border-border">
      <Table>
        <TableCaption className="sr-only">
          Which of your markets read each localization
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
                <TableCell key={grid.markets[index]}>
                  {role === null ? <NotRead /> : <ReadRoleBadge role={role} />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
