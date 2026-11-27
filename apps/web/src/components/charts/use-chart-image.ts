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

export type RenderImage = () => Promise<Blob>;
type Translator = ReturnType<typeof useTranslations>;

async function copyImage(filename: string, render: RenderImage, t: Translator) {
  const outcome = await copyOrDownload(render(), browserPngWriter(), (blob) =>
    downloadBlob(filename, blob),
  );
  if (outcome === "copied") toast.success(t("copied"));
  else toast.info(t("clipboardDownloaded"));
}

async function downloadImage(
  filename: string,
  render: RenderImage,
  t: Translator,
) {
  downloadBlob(filename, await render());
  toast.success(t("downloaded"));
}

export function useImageJob() {
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
    copy: (filename: string, render: RenderImage) =>
      void run(() => copyImage(filename, render, t)),
    download: (filename: string, render: RenderImage) =>
      void run(() => downloadImage(filename, render, t)),
  };
}

export function useChartImage() {
  const image = useImageJob();
  return {
    pending: image.pending,
    copy: (job: ChartImageJob) =>
      image.copy(job.filename, () => renderChartPng(job)),
    download: (job: ChartImageJob) =>
      image.download(job.filename, () => renderChartPng(job)),
  };
}
