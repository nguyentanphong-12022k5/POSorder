import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  actionIcon?: LucideIcon;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  actionIcon: ActionIcon = ArrowRight,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className={`flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-slate-200/80 shadow-xs transition ${className}`}
    >
      {/* Icon minh hoạ với hiệu ứng vòng tròn nổi bật */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 ring-8 ring-amber-50/50 shadow-inner">
        <Icon className="w-8 h-8 text-amber-600" />
      </div>

      {/* Tiêu đề & mô tả (Tương phản cao >= 4.5) */}
      <h3 className="text-base font-bold text-slate-800 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {/* Nút hành động kêu gọi (Call To Action) */}
      {actionLabel && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shadow-amber-600/30 active:scale-95 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 min-h-[44px]"
            >
              <span>{actionLabel}</span>
              <ActionIcon className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm shadow-amber-600/30 active:scale-95 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 min-h-[44px]"
            >
              <span>{actionLabel}</span>
              <ActionIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
