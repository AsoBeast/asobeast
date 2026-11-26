import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";
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
  POSITION_SHARES,
  UNSCORED_POPULARITY,
  VISIBILITY_GUIDE,
} from "./visibility-help";

export function VisibilityHelp({ note }: { note?: string }) {
  const t = useTranslations("metrics.visibility");
  return (
    <InfoTip label={t("label")} title={t("title")} summary={t("summary")}>
      <p className="text-muted-foreground">{t("intro")}</p>
      <Table className="text-caption">
        <TableCaption className="sr-only">{t("tableCaption")}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("position")}</TableHead>
            <TableHead scope="col" className="text-right">
              {t("counts")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {POSITION_SHARES.map(({ position, share }) => (
            <TableRow key={position}>
              <TableCell className="numeric">{position}</TableCell>
              <TableCell className="text-right numeric">{share}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground">
        {t("unscored", { value: UNSCORED_POPULARITY })}
      </p>
      {note ? <p className="text-muted-foreground">{note}</p> : null}
      <a
        href={VISIBILITY_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("readCalculation")}
      </a>
    </InfoTip>
  );
}
