import { AppIconImage, iconRadius } from "./AppIconImage";

function AppIconPlaceholder({ size }: { size: number }) {
  return (
    <div
      aria-hidden
      data-slot="app-icon-placeholder"
      style={{ width: size, height: size, borderRadius: iconRadius(size) }}
      className="flex shrink-0 items-center justify-center border border-border-subtle bg-secondary"
    >
      <span className="size-2/5 rounded-[30%] bg-border" />
    </div>
  );
}

export function AppIcon({
  src,
  size = 48,
}: {
  src: string | null;
  size?: number;
}) {
  const placeholder = <AppIconPlaceholder size={size} />;

  if (!src) return placeholder;

  return (
    <AppIconImage key={src} src={src} size={size} fallback={placeholder} />
  );
}
