import Link from "next/link";
import { adminHref } from "@/lib/admin-sections";
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
      <Link
        href={adminHref("workspaces")}
        className="font-medium text-foreground underline underline-offset-4"
      >
        Open a workspace
      </Link>{" "}
      to list all of its {noun}s.
    </p>
  );
}
