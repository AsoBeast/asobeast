"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const PLACEHOLDER_RATIO = 1320 / 2868;

export function ScreenshotThumb({
  src,
  alt,
  height = 224,
  className,
}: {
  src: string;
  alt: string;
  height?: number;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [measured, setMeasured] = useState<{
    src: string;
    width: number;
  } | null>(null);
  const placeholderWidth = Math.round(height * PLACEHOLDER_RATIO);
  const width = measured?.src === src ? measured.width : placeholderWidth;

  const measure = ({ naturalWidth, naturalHeight }: HTMLImageElement) => {
    if (naturalHeight === 0) return;
    const next = Math.round((height * naturalWidth) / naturalHeight);
    setMeasured((current) =>
      current?.src === src && current.width === next
        ? current
        : { src, width: next },
    );
  };

  if (failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={`${alt}, image unavailable`}
        style={{ width: placeholderWidth, height }}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border bg-muted text-caption text-muted-foreground",
          className,
        )}
      >
        Unavailable
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      style={{ height, width: "auto" }}
      className={cn(
        "max-w-none shrink-0 rounded-lg border object-contain",
        className,
      )}
      onLoad={(event) => measure(event.currentTarget)}
      onError={() => setFailedSrc(src)}
    />
  );
}
