"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

export function AppIconImage({
  src,
  size,
  fallback,
}: {
  src: string;
  size: number;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return fallback;

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
