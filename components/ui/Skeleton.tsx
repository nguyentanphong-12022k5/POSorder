import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
      {...props}
    />
  );
}

/**
 * Skeleton cho hàng danh mục Pills
 */
export function CategoryPillSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="status" aria-label="Đang tải danh mục">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="min-h-[44px] w-28 rounded-xl shrink-0" />
      ))}
    </div>
  );
}

/**
 * Skeleton cho lưới sản phẩm đồ uống
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-hidden pr-1"
      role="status"
      aria-label="Đang tải danh sách đồ uống"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/70 p-3 flex flex-col justify-between min-h-[160px] space-y-3"
        >
          {/* Ảnh thumbnail giả lập */}
          <Skeleton className="aspect-4/3 w-full rounded-xl" />

          {/* Tiêu đề & giá */}
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-3 w-1/2 rounded-md" />
          </div>

          {/* Giá và nút cộng */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton cho thẻ đơn hàng Bếp / Danh sách đơn
 */
export function OrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="status" aria-label="Đang tải danh sách đơn">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs"
        >
          {/* Header đơn */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Chi tiết món */}
          <div className="space-y-2.5 py-2 border-y border-slate-100">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-8 rounded" />
            </div>
          </div>

          {/* Action button */}
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
