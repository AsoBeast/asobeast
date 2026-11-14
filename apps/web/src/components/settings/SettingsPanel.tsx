import type { ReactNode, Ref } from "react";
import {
  PANEL_ACTION,
  PANEL_BLEED,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3 p-(--card-spacing)", className)}>
      {children}
    </div>
  );
}

export function SettingsPanel({
  title,
  as: Heading = "h3",
  action,
  footer,
  headerRef,
  children,
}: {
  title: ReactNode;
  as?: "h2" | "h3";
  action?: ReactNode;
  footer?: ReactNode;
  headerRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader ref={headerRef} className={PANEL_HEADER}>
        <CardTitle asChild>
          <Heading>{title}</Heading>
        </CardTitle>
        {action ? (
          <CardAction className={PANEL_ACTION}>{action}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={PANEL_BLEED}>{children}</CardContent>
      {footer ? (
        <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
