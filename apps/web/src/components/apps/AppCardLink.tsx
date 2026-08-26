"use client";

import { useState } from "react";
import Link from "next/link";

export function AppCardLink({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className: string;
}) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      href={`/apps/${id}`}
      prefetch={intent ? null : false}
      onMouseEnter={() => setIntent(true)}
      onFocus={() => setIntent(true)}
      className={className}
    >
      <span className="sr-only">{name}</span>
    </Link>
  );
}
