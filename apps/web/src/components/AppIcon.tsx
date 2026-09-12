import { AppIconImage } from "./AppIconImage";
import { appIconInitial } from "./app-icon-initial";

function AppIconPlaceholder({
  name,
  size,
}: {
  name: string | null;
  size: number;
}) {
  return (
    <div
      aria-hidden
      data-slot="app-icon-placeholder"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-medium text-muted-foreground"
    >
      {appIconInitial(name)}
    </div>
  );
}

export function AppIcon({
  src,
  name,
  size = 48,
}: {
  src: string | null;
  name: string | null;
  size?: number;
}) {
  const placeholder = <AppIconPlaceholder name={name} size={size} />;

  if (!src) return placeholder;

  return <AppIconImage src={src} size={size} fallback={placeholder} />;
}
