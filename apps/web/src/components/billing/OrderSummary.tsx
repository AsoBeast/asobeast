import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { OrderSummaryModel } from "@/lib/order-summary";

export function OrderSummary({ summary }: { summary: OrderSummaryModel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h3>Order summary</h3>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <dt className="flex flex-col">
              <span className="font-medium">{summary.planName}</span>
              <span className="text-caption text-muted-foreground">
                {summary.intervalLabel}
              </span>
            </dt>
            <dd className="tabular-nums">{summary.unitAmount}</dd>
          </div>
          <Separator />
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-medium">Due today</dt>
            <dd className="text-title tabular-nums">{summary.dueToday}</dd>
          </div>
        </dl>
        {summary.thenLine ? (
          <p className="text-caption text-muted-foreground">
            {summary.thenLine}
          </p>
        ) : null}
        <p className="text-body font-medium">{summary.cancelLine}</p>
      </CardContent>
    </Card>
  );
}
