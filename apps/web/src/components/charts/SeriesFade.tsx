import { useId } from "react";
import { FADE_STOPS } from "./theme";

export function useFadeId(): string {
  return `fade-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export function SeriesFade({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {FADE_STOPS.map((stop) => (
          <stop
            key={stop.offset}
            offset={stop.offset}
            stopColor={color}
            stopOpacity={stop.opacity}
          />
        ))}
      </linearGradient>
    </defs>
  );
}
