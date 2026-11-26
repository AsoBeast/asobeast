import type { ApiTokenItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
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
import { formatDateInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { RevokeTokenButton } from "./RevokeTokenButton";

const WIDE_ONLY = "hidden sm:table-cell";

function phoneLine(
  token: ApiTokenItem,
  t: ReturnType<typeof useTranslations>,
  locale: ReturnType<typeof useAppLocale>,
): string {
  const expiry =
    token.expiresAt === null
      ? t("neverExpires")
      : token.expired
        ? t("expired")
        : t("expires", { date: formatDateInLocale(token.expiresAt, locale) });
  const used = token.lastUsedAt
    ? t("lastUsedOn", { date: formatDateInLocale(token.lastUsedAt, locale) })
    : t("neverUsed");
  return `${expiry} · ${used} · ${t("createdOn", {
    date: formatDateInLocale(token.createdAt, locale),
  })}`;
}

function Expiry({ token }: { token: ApiTokenItem }) {
  const t = useTranslations("integrations.tokens");
  const locale = useAppLocale();
  if (token.expiresAt === null) {
    return <span className="text-muted-foreground">{t("never")}</span>;
  }
  return token.expired ? (
    <Badge variant="destructive">{t("expired")}</Badge>
  ) : (
    <span>{formatDateInLocale(token.expiresAt, locale)}</span>
  );
}

function LastUsed({ token }: { token: ApiTokenItem }) {
  const t = useTranslations("integrations.tokens");
  const locale = useAppLocale();
  return token.lastUsedAt ? (
    <span>{formatDateInLocale(token.lastUsedAt, locale)}</span>
  ) : (
    <span className="text-muted-foreground">{t("never")}</span>
  );
}

function TokenRow({
  token,
  busiest,
}: {
  token: ApiTokenItem;
  busiest: number;
}) {
  const t = useTranslations("integrations.tokens");
  const locale = useAppLocale();
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
          {phoneLine(token, t, locale)}
        </span>
      </TableCell>
      <TableCell>
        <span>{t(token.scope === "read" ? "scopeRead" : "scopeWrite")}</span>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <Expiry token={token} />
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <LastUsed token={token} />
        <span className="block text-caption text-faint-foreground">
          {t("createdOn", {
            date: formatDateInLocale(token.createdAt, locale),
          })}
        </span>
      </TableCell>
      <TableCell className="numeric text-right">
        <span className="relative inline-block min-w-16 px-2 py-1">
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 rounded-sm bg-chart-tint"
            style={{ inlineSize: `${share}%` }}
          />
          <span className="relative">
            {formatNumberInLocale(token.usageCount, locale)}
          </span>
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
  const t = useTranslations("integrations.tokens");
  const busiest = Math.max(0, ...tokens.map((token) => token.usageCount));

  return (
    <Table>
      <TableCaption className="sr-only">{t("tableCaption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          <TableHead>{t("scope")}</TableHead>
          <TableHead className={WIDE_ONLY}>{t("expiry")}</TableHead>
          <TableHead className={WIDE_ONLY}>{t("lastUsed")}</TableHead>
          <TableHead className="numeric text-right">{t("requests")}</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">{t("actions")}</span>
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
