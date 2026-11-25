"use client";

import type { ReactNode } from "react";
import type { Store } from "@asobeast/shared";
import {
  STORE_SCREEN_WIDTHS,
  type StorePreviewDevice,
} from "@/lib/store-preview/store-layouts";
import { useFitScale } from "./use-fit-scale";

export function PhoneFrame({
  store,
  device,
  label,
  children,
}: {
  store: Store;
  device: StorePreviewDevice;
  label: string;
  children: ReactNode;
}) {
  const width = STORE_SCREEN_WIDTHS[store][device];
  const [measure, scale] = useFitScale(width);
  return (
    <div ref={measure} className="flex w-full justify-center overflow-hidden">
      <div
        role="img"
        aria-label={label}
        data-slot="store-preview-frame"
        data-device={device}
        style={{ width, zoom: scale }}
        className="shrink-0 overflow-hidden rounded-lg border bg-card text-foreground"
      >
        {children}
      </div>
    </div>
  );
}
