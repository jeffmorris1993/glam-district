"use client";

import type { ReactNode } from "react";

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-6 py-6 sm:px-7 ${className}`}>{children}</div>;
}

export function SubHead({
  title,
  note,
  right,
}: {
  title: string;
  note?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="display text-[19px] leading-tight text-[var(--ink)]">{title}</h3>
        {note && <p className="mt-1 text-[11.5px] leading-snug text-[#9C8B76]">{note}</p>}
      </div>
      {right && <div className="shrink-0 pt-0.5">{right}</div>}
    </div>
  );
}
