"use client";

import React from "react";
import { formatVND } from "@/lib/money";

interface InvoiceItem {
  id: string;
  name: string;
  variantName?: string | null;
  toppings: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string | null;
}

interface InvoiceOrder {
  id: string;
  code: string;
  createdAt: string | Date;
  status: string;
  orderType?: string;
  tableNumber?: string | null;
  queueNumber?: number | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  note?: string | null;
  cancelReason?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  pointsEarned?: number;
  items: InvoiceItem[];
}

interface InvoiceProps {
  order: InvoiceOrder;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  isReprint?: boolean;
  printNum?: number;
}

export default function InvoiceTemplate({
  order,
  shopName = "TIỆM TRÀ & CÀ PHÊ 88",
  shopAddress = "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
  shopPhone = "0909 123 456",
  isReprint = false,
  printNum = 1,
}: InvoiceProps) {
  const dateFormatted = new Date(order.createdAt).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const isCancelled = order.status === "CANCELLED";

  return (
    <div
      id="printable-receipt"
      className={`bg-white text-black font-mono text-[13px] leading-tight p-4 mx-auto w-[80mm] max-w-[80mm] border border-dashed ${
        isCancelled ? "border-red-400 bg-red-50/10" : "border-slate-400"
      } print:border-none print:p-0 print:m-0`}
      style={{ boxSizing: "border-box" }}
    >
      {/* Cảnh báo đơn bị hủy */}
      {isCancelled && (
        <div className="border-2 border-red-600 text-red-600 font-bold text-center py-1.5 mb-2 uppercase text-xs">
          *** ĐƠN HÀNG ĐÃ HỦY ***
          {order.cancelReason && <div className="text-[10px] normal-case mt-0.5">Lý do: {order.cancelReason}</div>}
        </div>
      )}

      {/* Thông báo In lại */}
      {isReprint && (
        <div className="border-2 border-dashed border-red-500 bg-red-50 text-red-600 font-bold text-center py-1 mb-2 uppercase text-xs tracking-wider">
          *** IN LẠI LẦN {printNum} ***
        </div>
      )}

      {/* 1. Header quán */}
      <div className="text-center mb-3">
        <h1 className="font-bold text-[15px] uppercase tracking-wide">{shopName}</h1>
        <p className="text-[11px] text-gray-700">{shopAddress}</p>
        <p className="text-[11px] text-gray-700">Hotline: {shopPhone}</p>
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* 2. Tiêu đề hóa đơn & Số bàn / Mang về */}
      <div className="text-center mb-2">
        {isCancelled ? (
          <div className="space-y-1 mb-2">
            <h2 className="font-black text-[15px] text-red-600 line-through decoration-red-700 decoration-2 tracking-wider">
              HÓA ĐƠN HỦY
            </h2>
            <div className="bg-red-50 border border-red-300 rounded p-1.5 text-[10px] text-red-800 text-left space-y-0.5">
              <p>• <strong>Lý do hủy:</strong> {order.cancelReason || "Khách hủy đơn"}</p>
              {(order as any).cancelledBy && (
                <p>• <strong>Người hủy:</strong> {(order as any).cancelledBy}</p>
              )}
              {(order as any).cancelledAt && (
                <p>
                  • <strong>Thời gian hủy:</strong>{" "}
                  {new Date((order as any).cancelledAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <h2 className="font-bold text-[14px]">HÓA ĐƠN THANH TOÁN</h2>
        )}
        <div className="flex justify-between text-[11px] mt-1 text-gray-800">
          <span>Số: <strong>{order.code}</strong></span>
          <span>{dateFormatted}</span>
        </div>

        <div className="flex justify-between text-[11px] font-bold mt-1 text-gray-900 border-t border-dotted border-gray-300 pt-1">
          <span>Hình thức:</span>
          <span>
            {order.orderType === "DINE_IN"
              ? `Tại bàn (${order.tableNumber || "Bàn"})`
              : `Mang về (Số: #${order.queueNumber || 1})`}
          </span>
        </div>

        {order.customerPhone && (
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>Khách hàng: {order.customerName || order.customerPhone}</span>
            <span>+{(order.pointsEarned || 0)} điểm</span>
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* 3. Bảng danh sách món */}
      <table className="w-full text-left text-[12px] mb-2 border-collapse">
        <thead>
          <tr className="border-b border-black font-bold">
            <th className="py-1 text-left">Tên món</th>
            <th className="py-1 text-center w-8">SL</th>
            <th className="py-1 text-right w-14">Đ.Giá</th>
            <th className="py-1 text-right w-16">T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => {
            let toppings: Array<{ name: string; price: number }> = [];
            try {
              if (item.toppings) toppings = JSON.parse(item.toppings);
            } catch (e) {
              toppings = [];
            }

            return (
              <React.Fragment key={item.id || idx}>
                <tr className="align-top">
                  <td className="py-1 pr-1 font-semibold">
                    {item.name}
                    {item.variantName && ` (${item.variantName})`}
                  </td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">{formatVND(item.unitPrice).replace(" ₫", "")}</td>
                  <td className="py-1 text-right font-medium">{formatVND(item.lineTotal).replace(" ₫", "")}</td>
                </tr>
                {toppings.length > 0 && (
                  <tr>
                    <td colSpan={4} className="pb-1 pl-2 text-[10px] text-gray-600">
                      {toppings.map((top, tIdx) => (
                        <div key={tIdx}>
                          + {top.name} ({formatVND(top.price)})
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
                {item.note && (
                  <tr>
                    <td colSpan={4} className="pb-1 pl-2 text-[10px] italic text-gray-700">
                      * {item.note}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* 4. Tổng tiền và thanh toán */}
      <div className="space-y-1 text-[12px]">
        <div className="flex justify-between">
          <span>Tạm tính:</span>
          <span>{formatVND(order.subtotal)}</span>
        </div>

        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Giảm giá:</span>
            <span>-{formatVND(order.discount)}</span>
          </div>
        )}

        <div className="flex justify-between text-[15px] font-bold border-t border-dashed border-black pt-1 my-1">
          <span>TỔNG CỘNG:</span>
          <span>{formatVND(order.total)}</span>
        </div>

        <div className="flex justify-between pt-1">
          <span>Hình thức:</span>
          <span>{order.paymentMethod === "TRANSFER" ? "Chuyển khoản VietQR" : "Tiền mặt"}</span>
        </div>

        {order.paymentMethod === "CASH" && (
          <>
            <div className="flex justify-between">
              <span>Tiền khách đưa:</span>
              <span>{formatVND(order.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tiền thối lại:</span>
              <span>{formatVND(order.changeAmount)}</span>
            </div>
          </>
        )}

        {order.note && (
          <div className="pt-1 text-[11px] italic">
            Ghi chú: {order.note}
          </div>
        )}
      </div>

      <div className="border-t border-dashed border-black my-2"></div>

      {/* 5. Lời cảm ơn */}
      <div className="text-center text-[11px] space-y-1 pt-1 text-gray-800">
        <p className="font-semibold">Cảm ơn quý khách! Hẹn gặp lại 🌸</p>
        <p className="text-[10px] text-gray-600">Wifi: CaPhe88 | Mật khẩu: 88888888</p>
      </div>
    </div>
  );
}
