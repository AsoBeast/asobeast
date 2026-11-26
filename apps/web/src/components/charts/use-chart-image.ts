"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
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

type Translator = ReturnType<typeof useTranslations>;

async function copyJob(job: ChartImageJob, t: Translator): Promise<void> {
  const outcome = await copyOrDownload(
    renderChartPng(job),
    browserPngWriter(),
    (blob) => downloadBlob(job.filename, blob),
  );
  if (outcome === "copied") toast.success(t("copied"));
  else toast.info(t("clipboardDownloaded"));
}

async function downloadJob(job: ChartImageJob, t: Translator): Promise<void> {
  downloadBlob(job.filename, await renderChartPng(job));
  toast.success(t("downloaded"));
}

export function useChartImage() {
  const t = useTranslations("charts");
  const [pending, setPending] = useState(false);
  const run = useSharedFlight(
    useCallback(
      async (task: () => Promise<void>) => {
        setPending(true);
        try {
          await task();
        } catch {
          toast.error(t("drawFailed"));
        } finally {
          setPending(false);
        }
      },
      [t],
    ),
  );
  return {
    pending,
    copy: (job: ChartImageJob) => void run(() => copyJob(job, t)),
    download: (job: ChartImageJob) => void run(() => downloadJob(job, t)),
  };
}
