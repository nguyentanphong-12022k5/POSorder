"use client";

import React, { useState } from "react";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

export default function NetworkStatusChip() {
  const { status, isOnline, isOffline, isSyncing, pendingCount, syncNow } = useOfflineSync();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition shadow-xs cursor-pointer border ${
          isSyncing
            ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-400/20"
            : isOffline
            ? "bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/20 animate-pulse"
            : "bg-emerald-50 text-emerald-700 border-emerald-300"
        }`}
        title="Trạng thái kết nối POS"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span className="flex items-center gap-1">
              <span>🟡 Đang đồng bộ</span>
              {pendingCount > 0 && (
                <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full text-[10px]">
                  {pendingCount}
                </span>
              )}
            </span>
          </>
        ) : isOffline ? (
          <>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <WifiOff className="w-3.5 h-3.5 text-rose-600" />
            <span>🔴 Offline</span>
            {pendingCount > 0 && (
              <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                {pendingCount}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span>🟢 Online</span>
            {pendingCount > 0 && (
              <span className="bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded-full text-[10px]">
                {pendingCount} chờ gửi
              </span>
            )}
          </>
        )}
      </button>

      {/* Tooltip Popup chi tiết khi click */}
      {showTooltip && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTooltip(false)}
          />
          <div className="absolute right-0 mt-2 w-72 p-3 bg-white rounded-xl shadow-xl border border-slate-200 z-50 text-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-800">Trạng thái kết nối máy chủ</span>
              <span
                className={`font-extrabold ${
                  isSyncing ? "text-amber-600" : isOffline ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {isSyncing ? "ĐANG ĐỒNG BỘ" : isOffline ? "NGOẠI TUYẾN" : "TRỰC TUYẾN"}
              </span>
            </div>

            <p className="text-slate-600 text-[11px] leading-relaxed">
              {isOffline
                ? "Thiết bị đang mất mạng. Toàn bộ đơn hàng tạo mới sẽ được lưu vào bộ nhớ cục bộ (IndexedDB) và tự động đồng bộ khi có mạng trở lại."
                : isSyncing
                ? `Hệ thống đang gửi ${pendingCount} đơn hàng ngoại tuyến lên máy chủ...`
                : "Kết nối mạng ổn định. Dữ liệu đơn hàng và thực đơn được đồng bộ trực tiếp với máy chủ."}
            </p>

            {pendingCount > 0 && (
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between">
                <span>{pendingCount} đơn chờ đồng bộ</span>
                {isOnline && (
                  <button
                    type="button"
                    onClick={() => {
                      syncNow();
                      setShowTooltip(false);
                    }}
                    className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] transition"
                  >
                    Đồng bộ ngay
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
