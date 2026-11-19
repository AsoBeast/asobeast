import type { SupportWorkspaceDetail } from "@asobeast/shared";
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
import {
  onDemandRows,
  usageRows,
  type LabelledValue,
} from "@/lib/admin-support";

function LimitTable({
  caption,
  captionClassName,
  valueHeader,
  rows,
}: {
  caption: string;
  captionClassName: string;
  valueHeader: string;
  rows: LabelledValue[];
}) {
  return (
    <Table density="compact">
      <TableCaption className={captionClassName}>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Limit</TableHead>
          <TableHead numeric>{valueHeader}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="whitespace-normal">{row.label}</TableCell>
            <TableCell numeric className="whitespace-normal">
              {row.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorkspaceLimits({
  workspace,
}: {
  workspace: SupportWorkspaceDetail;
}) {
  const onDemand = onDemandRows(workspace.limits.onDemand);
  return (
    <SheetSection title="Limits and usage">
      <LimitTable
        caption="Limits and usage"
        captionClassName="sr-only"
        valueHeader="Used and allowed"
        rows={usageRows(workspace.limits, workspace)}
      />
      {onDemand.length > 0 ? (
        <LimitTable
          caption="On demand allowances"
          captionClassName="mt-2 mb-2 caption-top text-left text-label text-muted-foreground"
          valueHeader="Allowed"
          rows={onDemand}
        />
      ) : null}
    </SheetSection>
  );
}
