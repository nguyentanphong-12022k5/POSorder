"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatVND } from "@/lib/money";
import { supabaseBrowser } from "@/lib/supabase";
import { useToast } from "@/components/ui/ToastProvider";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Utensils,
  Volume2,
  VolumeX,
  BellRing,
  AlertCircle,
  RefreshCw,
  Flame,
  CheckCheck,
} from "lucide-react";

/**
 * Phát âm thanh chuông báo nhà bếp (Kitchen Chime) qua Web Audio API
 * Tần số chuông kép (587.33Hz -> 880Hz) rõ ràng, âm lượng vừa phải, không phụ thuộc file mp3
 */
function playKitchenNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Nốt thứ 1: D5 (587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Nốt thứ 2: A5 (880Hz) - Keng!
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.7);
  } catch (e) {
    console.warn("Không thể phát chuông AudioContext:", e);
  }
}

/**
 * Tính số phút trôi qua từ lúc tạo đơn
 */
function getMinutesAgo(dateStr: string | Date): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export default function KitchenPage() {
  const { showSuccess, showError } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const previousOrderCodesRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const fetchOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/kitchen?filter=${filter}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        const newOrders = json.data;

        // Kiểm tra nếu có đơn hàng mới xuất hiện
        if (!isFirstLoadRef.current) {
          const currentCodes = new Set<string>(newOrders.map((o: any) => String(o.code)));
          const hasBrandNewOrder = newOrders.some(
            (o: any) =>
              !previousOrderCodesRef.current.has(String(o.code)) &&
              (o.status === "PENDING" || o.status === "PAID")
          );

          if (hasBrandNewOrder) {
            const newest = newOrders.find((o: any) => !previousOrderCodesRef.current.has(String(o.code)));
            if (soundEnabled) {
              playKitchenNotificationSound();
            }
            showSuccess(
              `🔔 Bếp nhận đơn mới: #${newest?.code || ""} (${
                newest?.orderType === "DINE_IN" ? `Bàn ${newest.tableNumber}` : "Mang về"
              })!`
            );
          }
          previousOrderCodesRef.current = currentCodes;
        } else {
          previousOrderCodesRef.current = new Set<string>(newOrders.map((o: any) => String(o.code)));
          isFirstLoadRef.current = false;
        }

        setOrders(newOrders);
      }
    } catch (e: any) {
      console.error("Lỗi tải đơn bếp:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // 1. Supabase Realtime Subscription: Lắng nghe đơn hàng mới trên bảng Order
    const channel = supabaseBrowser
      .channel("kitchen-order-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Order" },
        (payload) => {
          if (soundEnabled) {
            playKitchenNotificationSound();
          }
          showSuccess(`🔔 Có đơn hàng mới tạo: #${payload.new?.code || "Mới"}!`);
          fetchOrders(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Order" },
        () => {
          fetchOrders(true);
        }
      )
      .subscribe();

    // 2. Polling Fallback 3 giây: Đảm bảo tự động nhận đơn trên mọi môi trường mạng / offline-sync
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 3000);

    return () => {
      clearInterval(interval);
      supabaseBrowser.removeChannel(channel);
    };
  }, [filter, soundEnabled]);

  /**
   * Cập nhật trạng thái đơn hàng (PENDING -> MAKING -> DONE)
   */
  const handleUpdateStatus = async (orderId: string, newStatus: "PENDING" | "MAKING" | "DONE") => {
    try {
      const res = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      const json = await res.json();

      if (json.success) {
        showSuccess(
          newStatus === "DONE"
            ? "Đã hoàn thành pha chế đơn hàng!"
            : newStatus === "MAKING"
            ? "Đã chuyển sang Đang pha chế!"
            : "Đã chuyển về Chờ làm món!"
        );
        fetchOrders(true);
      } else {
        showError(json.message || "Không thể cập nhật trạng thái");
      }
    } catch (e: any) {
      showError("Lỗi kết nối khi cập nhật đơn hàng");
    }
  };

  // Phân nhóm đơn theo trạng thái
  const pendingOrders = orders.filter((o) => o.status === "PENDING" || o.status === "PAID");
  const makingOrders = orders.filter((o) => o.status === "MAKING");
  const doneOrders = orders.filter((o) => o.status === "DONE");

  return (
    <div className="space-y-4 pb-12 pos-touch-screen">
      {/* 1. Header Màn hình Bếp / KDS */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
              Màn Hình Bếp & Pha Chế (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold animate-pulse">
                Realtime Sync ⚡
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Tự động đồng bộ nhiều máy tablet POS, chuông báo đơn mới và điều phối làm món.
            </p>
          </div>
        </div>

        {/* Bộ nút điều khiển cảm ứng >= 44px */}
        <div className="flex items-center gap-2">
          {/* Nút bật/tắt chuông */}
          <button
            type="button"
            aria-label="Bật tắt chuông"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`min-h-[44px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition select-none touch-manipulation active:scale-95 ${
              soundEnabled
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-slate-100 border-slate-200 text-slate-500"
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? "Chuông: BẬT" : "Chuông: TẮT"}</span>
          </button>

          {/* Nút thử chuông */}
          <button
            type="button"
            onClick={playKitchenNotificationSound}
            className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 flex items-center gap-1.5 transition select-none touch-manipulation active:scale-95"
          >
            <BellRing className="w-3.5 h-3.5 text-slate-600" />
            <span>Thử chuông</span>
          </button>

          {/* Nút tải lại */}
          <button
            type="button"
            onClick={() => fetchOrders(false)}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-200 transition select-none touch-manipulation active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. Tabs bộ lọc đơn hàng */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter("ACTIVE")}
          className={`min-h-[44px] px-5 rounded-2xl text-xs font-bold transition flex items-center gap-2 select-none touch-manipulation active:scale-95 ${
            filter === "ACTIVE"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 active:bg-slate-100"
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>Đang cần làm ({pendingOrders.length + makingOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("COMPLETED")}
          className={`min-h-[44px] px-5 rounded-2xl text-xs font-bold transition flex items-center gap-2 select-none touch-manipulation active:scale-95 ${
            filter === "COMPLETED"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 active:bg-slate-100"
          }`}
        >
          <CheckCheck className="w-4 h-4 text-emerald-500" />
          <span>Đã hoàn tất ({doneOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`min-h-[44px] px-5 rounded-2xl text-xs font-bold transition flex items-center gap-2 select-none touch-manipulation active:scale-95 ${
            filter === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 active:bg-slate-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>Tất cả ({orders.length})</span>
        </button>
      </div>

      {/* 3. Grid Danh sách Thẻ Đơn Hàng Dạng Card hoặc Skeleton hoặc Empty State */}
      {isLoading ? (
        <OrderListSkeleton count={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Hiện không có đơn nào đang chờ pha chế!"
          description="Khi thu ngân tạo đơn mới tại quầy POS, màn hình bếp sẽ tự động phát chuông báo và hiển thị thẻ đơn ngay lập tức."
          actionLabel="Tải lại đơn"
          onAction={() => fetchOrders()}
          className="my-auto py-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => {
            const minutesAgo = getMinutesAgo(order.createdAt);
            const isLate = minutesAgo >= 10;
            const isMaking = order.status === "MAKING";
            const isDone = order.status === "DONE";
            const isPending = !isMaking && !isDone;

            return (
              <div
                key={order.id}
                className={`rounded-3xl border shadow-xs overflow-hidden flex flex-col justify-between transition ${
                  isDone
                    ? "bg-slate-50 border-slate-200 opacity-70"
                    : isMaking
                    ? "bg-blue-50/40 border-blue-300 ring-2 ring-blue-500/20"
                    : isLate
                    ? "bg-red-50/40 border-red-300 ring-2 ring-red-500/20"
                    : "bg-white border-slate-200/90"
                }`}
              >
                {/* Header Card */}
                <div
                  className={`p-4 border-b flex items-center justify-between ${
                    isDone
                      ? "bg-slate-100/70 border-slate-200 text-slate-600"
                      : isMaking
                      ? "bg-blue-100/70 border-blue-200 text-blue-900"
                      : isLate
                      ? "bg-red-100/70 border-red-200 text-red-900"
                      : "bg-amber-50/70 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg">{order.code}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        order.orderType === "DINE_IN"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {order.orderType === "DINE_IN" ? `Bàn ${order.tableNumber || "01"}` : "Mang về"}
                    </span>
                  </div>

                  {/* Đồng hồ tính giờ */}
                  <div
                    className={`flex items-center gap-1 text-xs font-bold ${
                      isLate ? "text-red-700 animate-pulse" : "text-slate-500"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{minutesAgo}p trước</span>
                  </div>
                </div>

                {/* Body: Danh sách món nước */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[360px]">
                  {order.items?.map((item: any) => {
                    let toppings: any[] = [];
                    try {
                      toppings =
                        typeof item.toppings === "string" ? JSON.parse(item.toppings) : item.toppings || [];
                    } catch (e) {}

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-slate-800 leading-snug">
                            {item.quantity} x {item.name || item.productName}
                          </span>
                          {item.variantName && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 shrink-0">
                              {item.variantName}
                            </span>
                          )}
                        </div>

                        {/* Danh sách topping */}
                        {toppings.length > 0 && (
                          <div className="text-xs text-amber-800/90 font-medium pl-1">
                            {toppings.map((t: any) => `+ ${t.name}`).join(", ")}
                          </div>
                        )}

                        {/* Ghi chú đặc biệt */}
                        {item.note && (
                          <div className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                            ⚠️ Ghi chú: {item.note}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {order.note && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                      Ghi chú đơn: {order.note}
                    </div>
                  )}
                </div>

                {/* Footer Hành động Touch-Friendly >= 44px */}
                <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-2">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, "MAKING")}
                        className="flex-1 min-h-[46px] rounded-xl bg-blue-600 active:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition select-none touch-manipulation active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Làm món</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, "DONE")}
                        className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition select-none touch-manipulation active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Xong ngay</span>
                      </button>
                    </>
                  )}

                  {isMaking && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, "PENDING")}
                        className="min-h-[46px] px-3 rounded-xl bg-white active:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs flex items-center justify-center transition select-none touch-manipulation"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, "DONE")}
                        className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition select-none touch-manipulation active:scale-95"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Xong (Hoàn tất)</span>
                      </button>
                    </>
                  )}

                  {isDone && (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Đã pha chế xong
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.id, "MAKING")}
                        className="min-h-[44px] px-3 rounded-xl bg-white active:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 select-none touch-manipulation"
                      >
                        Làm lại
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
