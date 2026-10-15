"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import type { ComponentProps } from "react";
import type { ChartKey } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { captureChart } from "@/lib/api";
import { seedChartCapture } from "@/lib/queries";
import { chartParsers } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";
import { captureErrorText } from "./chart-actions";

export function CaptureTodayButton({
  chart,
  variant,
  size,
}: {
  chart: ChartKey;
} & Pick<ComponentProps<typeof Button>, "variant" | "size">) {
  const queryClient = useQueryClient();
  const [, setSearch] = useQueryStates(chartParsers);
  const mutation = useMutation({
    mutationFn: () => captureChart(chart),
    onSuccess: (page) => {
      seedChartCapture(queryClient, page);
      toast.success("Captured today's chart");
      void setSearch({ date: null });
    },
    onError: (error) => toast.error(captureErrorText(error)),
  });
  const captureOnce = useSingleFlight(mutation);

  return (
    <Button
      variant={variant}
      size={size}
      disabled={mutation.isPending}
      onClick={() => captureOnce()}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <Download aria-hidden />
      )}
      Capture today
    </Button>
  );
}
