"use client";

import { useEffect, useState } from "react";
import {
  createCanvasMeasure,
  type FontMeasure,
} from "@/lib/store-preview/canvas-measure";

let ready: Promise<FontMeasure | null> | null = null;

const loadFontMeasure = (): Promise<FontMeasure | null> =>
  (ready ??= document.fonts.ready
    .then(() =>
      createCanvasMeasure(() =>
        document.createElement("canvas").getContext("2d"),
      ),
    )
    .catch(() => null));

export function useTextMeasure(): FontMeasure | null {
  const [measure, setMeasure] = useState<FontMeasure | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadFontMeasure().then((loaded) => {
      if (mounted) setMeasure(() => loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return measure;
}
