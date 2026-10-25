"use client";

import React from "react";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { RefreshCw, WifiOff, CheckCircle2, ArrowUpRight } from "lucide-react";

export default function OfflineSyncBanner() {
  const { isOffline, isSyncing, pendingCount, syncNow } = useOfflineSync();

  // Không hiển thị nếu đang online và không có đơn chờ
  if (!isOffline && !isSyncing && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`w-full py-2 px-4 text-xs font-semibold shadow-xs transition duration-300 print:hidden ${
        isSyncing
          ? "bg-amber-500 text-white"
          : isOffline
          ? "bg-rose-600 text-white"
          : "bg-amber-600 text-white"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>
                <strong>Đang đồng bộ {pendingCount} đơn hàng...</strong> Dữ liệu tạo lúc mất mạng
                đang được gửi lên máy chủ. Vui lòng giữ kết nối!
              </span>
            </>
          ) : isOffline ? (
            <>
              <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
              <span>
                <strong>Chế độ Ngoại tuyến (Mất mạng):</strong> Hệ thống vẫn cho phép nhận món, thanh
                toán và in hóa đơn tạm thời.{" "}
                {pendingCount > 0 ? (
                  <span>
                    Đã lưu <strong>{pendingCount} đơn</strong> an toàn vào thiết bị (IndexedDB).
                  </span>
                ) : (
                  <span>Đơn tạo mới sẽ được lưu cục bộ.</span>
                )}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Phát hiện <strong>{pendingCount} đơn hàng ngoại tuyến</strong> chưa đồng bộ.
              </span>
            </>
          )}
        </div>

        {/* Nút thao tác nhanh khi online */}
        {!isOffline && !isSyncing && pendingCount > 0 && (
          <button
            type="button"
            onClick={() => syncNow()}
            className="px-3 py-1 rounded-lg bg-white text-amber-800 hover:bg-amber-50 font-bold transition flex items-center gap-1 shrink-0 shadow-xs"
          >
            <span>Đồng bộ ngay</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
