"use client";

import { Copy, ImageDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { SubjectButton } from "@/components/SubjectButton";
import { useChartImage, type ChartImageJob } from "./use-chart-image";

export function ChartImageButtons({
  subject,
  makeJob,
}: {
  subject: string;
  makeJob: () => ChartImageJob | null;
}) {
  const image = useChartImage();
  const t = useTranslations("charts");
  const busy = image.pending || undefined;
  const start = (act: (job: ChartImageJob) => void) => () => {
    const job = makeJob();
    if (job) act(job);
  };

  return (
    <>
      <SubjectButton
        icon={<Copy aria-hidden />}
        label={t("copyImage")}
        subject={subject}
        className="print:hidden"
        aria-disabled={busy}
        onClick={start(image.copy)}
      />
      <SubjectButton
        icon={<ImageDown aria-hidden />}
        label={t("downloadPng")}
        subject={subject}
        className="print:hidden"
        aria-disabled={busy}
        onClick={start(image.download)}
      />
    </>
  );
}
