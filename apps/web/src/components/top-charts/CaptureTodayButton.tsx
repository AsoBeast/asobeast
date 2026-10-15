"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useQueryStates } from "nuqs";
import { toast } from "sonner";
import type { ChartKey } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { captureChart } from "@/lib/api";
import { seedChartCapture } from "@/lib/queries";
import { chartParsers } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";
import { captureErrorText } from "./chart-actions";

export function CaptureTodayButton({ chart }: { chart: ChartKey }) {
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
    <Button disabled={mutation.isPending} onClick={() => captureOnce()}>
      {mutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <Download aria-hidden />
      )}
      Capture today
    </Button>
  );
}
