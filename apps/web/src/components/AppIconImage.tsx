"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

export function AppIconImage({
  src,
  name,
  size,
  fallback,
}: {
  src: string;
  name: string | null;
  size: number;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return fallback;

  return (
    <Image
      src={src}
      alt={name ?? "app icon"}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
