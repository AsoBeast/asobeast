"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download-blob";
import { browserPngWriter, copyOrDownload } from "@/lib/chart-image/clipboard";
import {
  renderChartPng,
  type ChartImageRequest,
} from "@/lib/chart-image/rasterize";
import { useSharedFlight } from "@/lib/single-flight";

export interface ChartImageJob extends ChartImageRequest {
  filename: string;
}

async function copyJob(job: ChartImageJob): Promise<void> {
  const outcome = await copyOrDownload(
    renderChartPng(job),
    browserPngWriter(),
    (blob) => downloadBlob(job.filename, blob),
  );
  if (outcome === "copied") toast.success("Chart copied");
  else toast.info("Clipboard unavailable, downloaded instead");
}

async function downloadJob(job: ChartImageJob): Promise<void> {
  downloadBlob(job.filename, await renderChartPng(job));
  toast.success("Chart downloaded");
}

export function useChartImage() {
  const [pending, setPending] = useState(false);
  const run = useSharedFlight(
    useCallback(async (task: () => Promise<void>) => {
      setPending(true);
      try {
        await task();
      } catch {
        toast.error("Could not draw the chart image");
      } finally {
        setPending(false);
      }
    }, []),
  );
  return {
    pending,
    copy: (job: ChartImageJob) => void run(() => copyJob(job)),
    download: (job: ChartImageJob) => void run(() => downloadJob(job)),
  };
}
