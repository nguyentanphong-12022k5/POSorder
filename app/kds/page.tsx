"use client";

import React, { useState, useEffect } from "react";
import { formatVND } from "@/lib/money";
import {
  ChefHat,
  Clock,
  CheckCircle,
  Play,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";

export default function KdsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const fetchKdsOrders = async () => {
    try {
      const res = await fetch("/api/kds");
      const json = await res.json();
      if (json.success) {
        setOrders(json.data);
      }
    } catch (e) {
      console.error("Lỗi KDS:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKdsOrders();
    const interval = setInterval(fetchKdsOrders, 3000); // Polling tự động mỗi 3 giây
    return () => clearInterval(interval);
  }, []);

  const handleUpdateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      await fetch("/api/kds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, itemStatus: newStatus }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteAll = async (orderId: string) => {
    try {
      await fetch("/api/kds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, itemStatus: "COMPLETED" }),
      });
      fetchKdsOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Lọc các đơn đang pha hoặc đã xong
  const filteredOrders = orders.filter((ord) => {
    const isAllDone = ord.items.every((it: any) => it.itemStatus === "COMPLETED");
    return filter === "ACTIVE" ? !isAllDone : isAllDone;
  });

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header KDS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-900 flex items-center justify-center font-bold">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              Màn Hình Pha Chế / Bếp (KDS)
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <p className="text-xs text-slate-400">
              Cập nhật trực tiếp thời gian thực • Tự động tải lại mỗi 3s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === "ACTIVE" ? "bg-amber-500 text-slate-950" : "text-slate-300"
              }`}
            >
              Cần pha chế ({orders.filter((o) => o.items.some((it: any) => it.itemStatus !== "COMPLETED")).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === "COMPLETED" ? "bg-amber-500 text-slate-950" : "text-slate-300"
              }`}
            >
              Đã xong ({orders.filter((o) => o.items.every((it: any) => it.itemStatus === "COMPLETED")).length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
            title="Bật/Tắt chuông báo"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Grid of Kitchen Tickets */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Đang đồng bộ đơn pha chế...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <ChefHat className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-slate-700">Hiện tại không có đơn nào đang chờ pha chế!</p>
          <p className="text-xs text-slate-400 mt-1">Khi có đơn mới từ thu ngân, màn hình sẽ tự động cập nhật ngay lập tức.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((ord) => {
            const isAllCompleted = ord.items.every((it: any) => it.itemStatus === "COMPLETED");
            const timeAgo = Math.max(
              0,
              Math.floor((new Date().getTime() - new Date(ord.createdAt).getTime()) / 60000)
            );

            return (
              <div
                key={ord.id}
                className={`bg-white rounded-2xl border shadow-xs flex flex-col justify-between overflow-hidden transition ${
                  isAllCompleted
                    ? "border-emerald-200 bg-emerald-50/20"
                    : timeAgo > 10
                    ? "border-red-300 ring-1 ring-red-400/30"
                    : "border-slate-200"
                }`}
              >
                {/* Header Ticket */}
                <div
                  className={`p-3.5 border-b flex items-center justify-between ${
                    isAllCompleted
                      ? "bg-emerald-100/60 border-emerald-200 text-emerald-900"
                      : timeAgo > 10
                      ? "bg-red-50 border-red-100 text-red-900"
                      : "bg-slate-100/80 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base">{ord.code}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                        ord.orderType === "DINE_IN"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ord.orderType === "DINE_IN" ? (
                        <>
                          <Utensils className="w-3 h-3" />
                          {ord.tableNumber || "Tại bàn"}
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3 h-3" />
                          Mang về #{ord.queueNumber || 1}
                        </>
                      )}
                    </span>
                  </div>

                  <span className="text-xs font-semibold flex items-center gap-1 text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {timeAgo === 0 ? "Vừa xong" : `${timeAgo} phút trước`}
                  </span>
                </div>

                {/* Items List */}
                <div className="p-4 space-y-3 flex-1">
                  {ord.items.map((item: any) => {
                    let toppings: Array<{ name: string }> = [];
                    try {
                      if (item.toppings) toppings = JSON.parse(item.toppings);
                    } catch (e) {}

                    const isItemDone = item.itemStatus === "COMPLETED";
                    const isItemPreparing = item.itemStatus === "PREPARING";

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border transition flex items-start justify-between gap-2 ${
                          isItemDone
                            ? "bg-emerald-50/60 border-emerald-200 opacity-60 line-through"
                            : isItemPreparing
                            ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-400/40"
                            : "bg-slate-50/70 border-slate-200"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-base font-black text-amber-600">
                              {item.quantity}x
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {item.name}
                            </span>
                            {item.variantName && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                                {item.variantName}
                              </span>
                            )}
                          </div>

                          {toppings.length > 0 && (
                            <div className="text-[11px] font-semibold text-slate-600 pl-4 mt-0.5">
                              {toppings.map((t) => `+ ${t.name}`).join(", ")}
                            </div>
                          )}

                          {item.note && (
                            <div className="text-xs font-bold text-red-600 bg-red-50/80 px-2 py-0.5 rounded mt-1 inline-block">
                              ⚠️ {item.note}
                            </div>
                          )}
                        </div>

                        {/* Nút bấm chuyển trạng thái từng món */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {!isItemDone && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateItemStatus(
                                  item.id,
                                  isItemPreparing ? "COMPLETED" : "PREPARING"
                                )
                              }
                              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                isItemPreparing
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "bg-amber-600 text-white hover:bg-amber-700"
                              }`}
                              title={isItemPreparing ? "Bấm để xong món" : "Bấm để bắt đầu pha"}
                            >
                              {isItemPreparing ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Action */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Tổng: {ord.items.reduce((s: number, it: any) => s + it.quantity, 0)} ly
                  </span>

                  {!isAllCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleCompleteAll(ord.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Hoàn thành toàn bộ
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Đã phục vụ
                    </span>
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
