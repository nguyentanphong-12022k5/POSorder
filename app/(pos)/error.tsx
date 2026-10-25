"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCw, Home, ShieldAlert } from "lucide-react";

export default function PosErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log ra console có tiền tố rõ ràng
    console.error("[POS ErrorBoundary caught an unhandled render error]:", error);

    // Gửi sự cố về Sentry nếu có DSN
    try {
      Sentry.captureException(error, {
        tags: { boundary: "pos_root", digest: error.digest },
      });
    } catch (sentryErr) {
      console.warn("Không thể gửi log về Sentry:", sentryErr);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-red-200/90 shadow-xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-9 h-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-black text-slate-800">
            Có lỗi xảy ra khi hiển thị giao diện
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Hệ thống POS đã bảo vệ an toàn dữ liệu giỏ hàng và hóa đơn của quán.
            Vui lòng bấm tải lại hoặc quay về màn hình chính.
          </p>
        </div>

        {error?.digest && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-mono text-[11px] select-all">
            Mã định danh lỗi: <span className="font-bold text-slate-700">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 active:scale-98 transition"
          >
            <RotateCw className="w-4 h-4" />
            <span>Có lỗi, bấm tải lại</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            <Home className="w-4 h-4" />
            <span>Về bán hàng</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
