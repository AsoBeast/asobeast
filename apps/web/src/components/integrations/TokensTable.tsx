import type { ApiTokenItem } from "@asobeast/shared";
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
import { formatDate, formatNumber } from "@/lib/format";
import { RevokeTokenButton } from "./RevokeTokenButton";
import { SCOPE_LABELS } from "./token-scopes";

const WIDE_ONLY = "hidden sm:table-cell";

function phoneLine(token: ApiTokenItem): string {
  const expiry =
    token.expiresAt === null
      ? "Never expires"
      : `${token.expired ? "Expired" : "Expires"} ${formatDate(token.expiresAt)}`;
  const used = token.lastUsedAt
    ? `last used ${formatDate(token.lastUsedAt)}`
    : "never used";
  return `${expiry} · ${used} · created ${formatDate(token.createdAt)}`;
}

function Expiry({ token }: { token: ApiTokenItem }) {
  if (token.expiresAt === null) {
    return <span className="text-muted-foreground">Never</span>;
  }
  return token.expired ? (
    <Badge variant="destructive">Expired</Badge>
  ) : (
    <span>{formatDate(token.expiresAt)}</span>
  );
}

function LastUsed({ token }: { token: ApiTokenItem }) {
  return token.lastUsedAt ? (
    <span>{formatDate(token.lastUsedAt)}</span>
  ) : (
    <span className="text-muted-foreground">Never</span>
  );
}

function TokenRow({
  token,
  busiest,
}: {
  token: ApiTokenItem;
  busiest: number;
}) {
  const share = busiest === 0 ? 0 : (token.usageCount / busiest) * 100;

  return (
    <TableRow>
      <TableCell className="max-w-48 whitespace-normal">
        <span className="block truncate font-medium">{token.name}</span>
        <span
          translate="no"
          className="block font-mono text-caption text-faint-foreground"
        >
          {`${token.prefix}…`}
        </span>
        <span className="block text-caption text-faint-foreground sm:hidden">
          {phoneLine(token)}
        </span>
      </TableCell>
      <TableCell>
        <span>{SCOPE_LABELS[token.scope]}</span>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <Expiry token={token} />
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <LastUsed token={token} />
        <span className="block text-caption text-faint-foreground">
          {`created ${formatDate(token.createdAt)}`}
        </span>
      </TableCell>
      <TableCell className="numeric text-right">
        <span className="relative inline-block min-w-16 px-2 py-1">
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 rounded-sm bg-chart-tint"
            style={{ inlineSize: `${share}%` }}
          />
          <span className="relative">{formatNumber(token.usageCount)}</span>
        </span>
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <RevokeTokenButton id={token.id} name={token.name} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function TokensTable({ tokens }: { tokens: ApiTokenItem[] }) {
  const busiest = Math.max(0, ...tokens.map((token) => token.usageCount));

  return (
    <Table>
      <TableCaption className="sr-only">
        Personal API tokens for automation.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Scope</TableHead>
          <TableHead className={WIDE_ONLY}>Expires</TableHead>
          <TableHead className={WIDE_ONLY}>Last used</TableHead>
          <TableHead className="numeric text-right">Requests</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TokenRow key={token.id} token={token} busiest={busiest} />
        ))}
      </TableBody>
    </Table>
  );
}
