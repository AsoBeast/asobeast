import type { SupportRunDay } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { SectionEmpty, SectionNote } from "./SectionNote";

export function WorkspaceChecks({ days }: { days: SupportRunDay[] }) {
  return (
    <SheetSection title="Keyword checks, last week">
      {days.length === 0 ? (
        <SectionEmpty>No keyword checks in the last 7 days.</SectionEmpty>
      ) : (
        <Table density="compact">
          <TableCaption className="sr-only">Keyword checks</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead numeric>Checked</TableHead>
              <TableHead numeric>Not found</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => (
              <TableRow key={day.date}>
                <TableCell>{formatDayMonth(day.date)}</TableCell>
                <TableCell numeric>{formatNumber(day.captured)}</TableCell>
                <TableCell numeric>{formatNumber(day.unresolved)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <SectionNote>
        Positions checked per day, and how many found the app nowhere in the
        results. A day without checks has no row.
      </SectionNote>
    </SheetSection>
  );
}
