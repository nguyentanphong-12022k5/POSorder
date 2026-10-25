"use client";

import React from "react";
import { formatVND } from "@/lib/money";
import { Printer, X, WifiOff, CheckCircle } from "lucide-react";

interface OfflineReceiptModalProps {
  order: any | null;
  onClose: () => void;
}

export default function OfflineReceiptModal({ order, onClose }: OfflineReceiptModalProps) {
  if (!order) return null;

  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const items = order.orderData?.items || order.items || [];
  const subtotal = order.orderData?.subtotal || order.subtotal || order.orderData?.total || 0;
  const discount = order.orderData?.discount || order.discount || 0;
  const total = order.orderData?.total || order.total || subtotal - discount;
  const paidAmount = order.orderData?.paidAmount || order.paidAmount || total;
  const changeAmount = Math.max(0, paidAmount - total);
  const paymentMethod =
    order.orderData?.paymentMethod === "TRANSFER" ? "Chuyển khoản QR" : "Tiền mặt";
  const orderTypeStr =
    order.orderData?.orderType === "DINE_IN"
      ? `Tại bàn (${order.orderData?.tableNumber || "-"})`
      : "Mang đi";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden print:p-0 print:border-none print:shadow-none">
        {/* Header Modal - Ẩn khi in */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400" />
            <h3 className="font-bold text-sm">Xem trước & In hóa đơn Ngoại tuyến</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung Hóa đơn khổ 80mm - Dùng cho cả màn hình và máy in */}
        <div
          id="offline-receipt"
          className="p-6 text-slate-900 text-xs font-mono space-y-4 max-w-[80mm] mx-auto bg-white"
        >
          {/* Thông tin Quán */}
          <div className="text-center space-y-1">
            <h2 className="font-extrabold text-base tracking-wide uppercase">
              TIỆM TRÀ & CÀ PHÊ 88
            </h2>
            <p className="text-[11px] text-slate-500">123 Đường Nguyễn Huệ, Quận 1, TP.HCM</p>
            <p className="text-[11px] text-slate-500">Hotline: 0909 123 456</p>
            <div className="pt-2 border-b border-dashed border-slate-300 pb-2">
              <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 block text-center">
                *** HÓA ĐƠN TẠM THỜI (OFFLINE) ***
              </span>
            </div>
          </div>

          {/* Thông tin đơn */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã đơn:</span>
              <span className="font-bold">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Thời gian:</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Hình thức:</span>
              <span className="font-semibold">{orderTypeStr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Thu ngân:</span>
              <span>Thu ngân 1 (Offline)</span>
            </div>
          </div>

          {/* Danh sách món */}
          <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-2">
            <div className="flex justify-between font-bold text-[11px] uppercase text-slate-600">
              <span>Tên món</span>
              <span>T.Tiền</span>
            </div>

            {items.map((item: any, idx: number) => {
              const toppingsList = Array.isArray(item.toppings) ? item.toppings : [];
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-xs">
                    <span className="line-clamp-1">
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatVND(item.lineTotal || item.unitPrice * item.quantity)}</span>
                  </div>
                  {item.variantName && (
                    <p className="text-[10px] text-slate-500 pl-4">+ Size: {item.variantName}</p>
                  )}
                  {toppingsList.map((top: any, tIdx: number) => (
                    <p key={tIdx} className="text-[10px] text-slate-500 pl-4">
                      + Topping: {top.name} (+{formatVND(top.price)})
                    </p>
                  ))}
                  {item.note && (
                    <p className="text-[10px] text-amber-700 italic pl-4">
                      Ghi chú: {item.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Thanh toán & Tổng tiền */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Tạm tính:</span>
              <span>{formatVND(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Giảm giá:</span>
                <span>-{formatVND(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
              <span>TỔNG CỘNG:</span>
              <span className="text-base text-amber-700">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1">
              <span>Hình thức:</span>
              <span className="font-bold">{paymentMethod}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tiền khách đưa:</span>
              <span>{formatVND(paidAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tiền trả lại:</span>
              <span className="font-bold">{formatVND(changeAmount)}</span>
            </div>
          </div>

          {/* Footer hóa đơn */}
          <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
            <p>Hóa đơn được tạo ở chế độ ngoại tuyến không có mạng.</p>
            <p>Hệ thống sẽ tự động đồng bộ khi có kết nối trở lại.</p>
            <p className="font-bold text-slate-700">Cảm ơn Quý khách & Hẹn gặp lại!</p>
          </div>
        </div>

        {/* Action Buttons Footer - Ẩn khi in */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            Đóng / Tạo đơn mới
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>In hóa đơn (80mm)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
