import type { ReactNode } from "react";
import Link from "next/link";
import {
  FOOTER_LINK,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NoOpenActions({ generated }: { generated: boolean }) {
  return (
    <p className="px-2 text-body text-muted-foreground">
      {generated ? "Nothing needs you right now." : "No actions generated yet."}
    </p>
  );
}

export function DoNextPanel({
  counts,
  href,
  className,
  children,
}: {
  counts: string | null;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Do next</h2>
        </CardTitle>
        {counts ? (
          <CardAction className={PANEL_COUNT}>{counts}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 px-2">{children}</CardContent>
      <CardFooter className="justify-between">
        <span>Rules over your stored history</span>
        <Link href={href} className={FOOTER_LINK}>
          Open the Action Center
        </Link>
      </CardFooter>
    </Card>
  );
}
