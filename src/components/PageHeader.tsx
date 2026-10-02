import Link from "next/link";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref?: string;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-slate-100/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      {backHref && (
        <Link href={backHref} className="-ml-2 p-2 text-slate-600" aria-label="뒤로">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-lg font-bold">{title}</h1>
      {right}
    </header>
  );
}
