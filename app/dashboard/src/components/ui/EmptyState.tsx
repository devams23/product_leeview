import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}>
      <h3 className="font-display text-2xl text-text-1">{title}</h3>
      {children && <div className="max-w-md text-[14px] leading-relaxed text-text-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
