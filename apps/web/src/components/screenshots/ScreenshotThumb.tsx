"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ASPECT = 696 / 392;

export function ScreenshotThumb({
  src,
  alt,
  width = 96,
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * ASPECT);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${alt}, image unavailable`}
        style={{ width, height }}
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
      style={{ width, height }}
      className={cn("shrink-0 rounded-lg border object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
