import { useId } from "react";
import Link from "next/link";
import type {
  AppAuditResult,
  ReadinessItem,
  ReadinessLink,
  ReadinessStatus,
} from "@asobeast/shared";
import { isoDateOrNull } from "@asobeast/shared";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDayMonth, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<ReadinessStatus, typeof CircleCheck> = {
  pass: CircleCheck,
  warn: TriangleAlert,
  fail: CircleX,
  unmeasurable: CircleDashed,
};

const STATUS_TONE: Record<ReadinessStatus, string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
  unmeasurable: "text-muted-foreground",
};

const STATUS_WORD: Record<ReadinessStatus, string> = {
  pass: "Pass",
  warn: "Needs work",
  fail: "Fail",
  unmeasurable: "Not measured",
};

function ReadinessLinkView({ link }: { link: ReadinessLink }) {
  if (link.href.startsWith("https://")) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-foreground link-underline"
      >
        <span>{link.label}</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className="w-fit text-foreground link-underline">
      <span>{link.label}</span>
    </Link>
  );
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const Icon = STATUS_ICON[item.status];
  return (
    <li className="flex items-start gap-2 px-2 py-2 text-dense">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", STATUS_TONE[item.status])}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-x-3">
          <span className="min-w-0 font-medium wrap-anywhere">
            <span>{item.label}</span>
          </span>
          <span className="shrink-0 text-caption text-muted-foreground">
            <span>{STATUS_WORD[item.status]}</span>
          </span>
        </p>
        {item.detail === null ? null : (
          <p className="text-caption text-muted-foreground">
            <span>{item.detail}</span>
          </p>
        )}
        {item.link === null ? null : <ReadinessLinkView link={item.link} />}
      </div>
    </li>
  );
}

function editorialLine(readiness: NonNullable<AppAuditResult["readiness"]>) {
  const editorial = readiness.editorial;
  if (editorial === null) {
    return "The store page has not been read yet.";
  }
  const stories =
    editorial.stories === 0
      ? "In no featured stories"
      : `In ${pluralize(editorial.stories, "featured story")}`;
  const day = isoDateOrNull(readiness.extractAsOf);
  return [
    editorial.editorsChoiceBadge
      ? `${stories} · Editors' Choice badge`
      : stories,
    day === null ? null : `Page read ${formatDayMonth(day)}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function AuditReadiness({ audit }: { audit: AppAuditResult }) {
  const headingId = useId();
  const readiness = audit.readiness;
  if (audit.store !== "APP_STORE" || readiness === undefined) {
    return null;
  }
  const passes = readiness.items.filter(
    (item) => item.status === "pass",
  ).length;

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Featuring readiness</h2>
          </CardTitle>
          <CardAction className={cn(PANEL_COUNT, "numeric")}>
            {`${passes} of ${readiness.items.length} pass`}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col px-2">
          <ul className="flex list-none flex-col p-0">
            {readiness.items.map((item) => (
              <ReadinessRow key={item.id} item={item} />
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <span>{editorialLine(readiness)}</span>
        </CardFooter>
      </Card>
    </section>
  );
}
