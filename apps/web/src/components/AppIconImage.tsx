"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { iconRadius } from "./app-icon-radius";

export function AppIconImage({
  src,
  size,
  fallback,
}: {
  src: string;
  size: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return fallback;

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: iconRadius(size) }}
      className="shrink-0 object-cover"
      onError={() => setFailed(true)}
    />
  );
}
