import type { ReactNode } from "react";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminPanel({
  title,
  action,
  footer,
  contentClassName,
  children,
}: {
  title: string;
  action?: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        {action ? (
          <CardAction className={PANEL_ACTION}>{action}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={cn("px-2", contentClassName)}>
        {children}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
