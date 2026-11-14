import type { ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  headed = true,
  children,
}: {
  id: string;
  title: string;
  headed?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="flex scroll-mt-20 flex-col gap-3"
    >
      {headed ? <h2 className="text-heading">{title}</h2> : null}
      {children}
    </section>
  );
}
