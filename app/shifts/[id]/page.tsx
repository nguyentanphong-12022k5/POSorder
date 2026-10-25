"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatVND } from "@/lib/money";
import {
  Clock,
  Banknote,
  DollarSign,
  QrCode,
  ArrowLeft,
  Printer,
  FileText,
  User,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  ExternalLink,
  Receipt,
  Calendar,
} from "lucide-react";

export default function ShiftDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shiftId = params?.id as string;

  const [shift, setShift] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [printPaperSize, setPrintPaperSize] = useState<"80mm" | "A5">("80mm");
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  const fetchShiftDetail = async () => {
    try {
      setIsLoading(true);
      const [shiftRes, settingsRes] = await Promise.all([
        fetch(`/api/shifts/${shiftId}`),
        fetch("/api/settings"),
      ]);

      const shiftData = await shiftRes.json();
      const settingsData = await settingsRes.json();

      if (!shiftRes.ok || !shiftData.success) {
        throw new Error(shiftData.message || "Không tìm thấy thông tin ca");
      }

      setShift(shiftData.data);
      if (settingsData.success) {
        setShopSettings(settingsData.data);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi tải chi tiết ca làm việc");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (shiftId) {
      fetchShiftDetail();
    }
  }, [shiftId]);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="font-semibold text-sm">Đang tải dữ liệu ca làm việc...</p>
      </div>
    );
  }

  if (error || !shift) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-red-200 text-center shadow-xs">
        <p className="text-red-600 font-bold mb-4">{error || "Ca làm việc không tồn tại"}</p>
        <Link
          href="/shifts"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Về danh sách ca
        </Link>
      </div>
    );
  }

  const isOpen = shift.status === "OPEN";
  const orders: any[] = shift.orders || [];

  const openDateStr = new Date(shift.openedAt).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const closeDateStr = shift.closedAt
    ? new Date(shift.closedAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Đang mở";

  // Tính thời gian làm việc
  const startTime = new Date(shift.openedAt).getTime();
  const endTime = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainingMinutes = durationMinutes % 60;

  const cashSales = isOpen ? shift.liveSummary?.cashRevenue || 0 : shift.cashRevenue;
  const transferSales = isOpen ? shift.liveSummary?.transferRevenue || 0 : shift.totalTransfer;
  const totalRevenue = cashSales + transferSales;
  const expectedCash = isOpen
    ? shift.openingCash + cashSales
    : shift.expectedCash;
  const closingCash = shift.closingCash ?? expectedCash;
  const cashDiff = shift.cashDifference ?? 0;

  const handlePrintReport = (size: "80mm" | "A5") => {
    setPrintPaperSize(size);
    setShowPrintModal(true);
  };

  const triggerBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/shifts"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">
                Ca làm việc: {shift.staff?.name || shift.staffName}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isOpen
                    ? "bg-emerald-100 text-emerald-800 animate-pulse"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {isOpen ? "• Đang mở" : "Đã kết ca"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Từ {openDateStr} — Đến {closeDateStr} ({durationHours}h {durationRemainingMinutes}p)
            </p>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePrintReport("80mm")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>In bill ca (80mm)</span>
          </button>

          <button
            type="button"
            onClick={() => handlePrintReport("A5")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
          >
            <FileText className="w-4 h-4" />
            <span>Báo cáo ca (A5)</span>
          </button>
        </div>
      </div>

      {/* Grid thống kê tài chính ca */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
        {/* 1. Tiền đầu ca */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Tiền đầu ca
          </span>
          <p className="text-base font-black text-slate-800">
            {formatVND(shift.openingCash)}
          </p>
          <span className="text-[10px] text-slate-400">Tiền thối sẵn két</span>
        </div>

        {/* 2. Doanh thu tiền mặt */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Thu tiền mặt
          </span>
          <p className="text-base font-black text-emerald-600">
            {formatVND(cashSales)}
          </p>
          <span className="text-[10px] text-slate-400">
            {orders.filter((o) => o.paymentMethod === "CASH").length} đơn tiền mặt
          </span>
        </div>

        {/* 3. Doanh thu chuyển khoản */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Thu VietQR
          </span>
          <p className="text-base font-black text-blue-600">
            {formatVND(transferSales)}
          </p>
          <span className="text-[10px] text-slate-400">
            {orders.filter((o) => o.paymentMethod === "TRANSFER").length} đơn chuyển khoản
          </span>
        </div>

        {/* 4. Tổng doanh thu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Tổng doanh thu
          </span>
          <p className="text-base font-black text-slate-900">
            {formatVND(totalRevenue)}
          </p>
          <span className="text-[10px] text-slate-400">{orders.length} tổng số đơn</span>
        </div>

        {/* 5. Tiền mặt dự kiến két */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Dự kiến trong két
          </span>
          <p className="text-base font-black text-amber-700">
            {formatVND(expectedCash)}
          </p>
          <span className="text-[10px] text-slate-400">Đầu ca + Tiền mặt</span>
        </div>

        {/* 6. Tiền lệch két */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Chênh lệch két
          </span>
          {isOpen ? (
            <p className="text-sm font-bold text-slate-400 italic">Đang kiểm đếm...</p>
          ) : (
            <>
              <p
                className={`text-base font-black ${
                  cashDiff === 0
                    ? "text-emerald-600"
                    : cashDiff > 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {cashDiff > 0 ? `+${formatVND(cashDiff)}` : formatVND(cashDiff)}
              </p>
              <span className="text-[10px] font-semibold text-slate-500">
                {cashDiff === 0 ? "Khớp 100%" : cashDiff > 0 ? "Thừa tiền két" : "Thiếu hụt két"}
              </span>
            </>
          )}
        </div>
      </div>

      {shift.note && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 print:hidden">
          <strong>Ghi chú bàn giao:</strong> {shift.note}
        </div>
      )}

      {/* Bảng danh sách đơn hàng trong ca */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              Danh sách đơn hàng trong ca ({orders.length} đơn)
            </h2>
            <p className="text-xs text-slate-500">
              Tất cả hóa đơn đã tạo và gắn shiftId trong thời gian ca làm việc
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Chưa có đơn hàng nào phát sinh trong ca làm việc này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-bold">
                  <th className="py-3 px-4">Mã đơn</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Loại đơn</th>
                  <th className="py-3 px-4">Chi tiết món</th>
                  <th className="py-3 px-4">Thanh toán</th>
                  <th className="py-3 px-4 text-right">Tổng tiền</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.map((o) => {
                  const oDate = new Date(o.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-700">
                        {o.code}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{oDate}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.orderType === "DINE_IN"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {o.orderType === "DINE_IN"
                            ? `Tại bàn: ${o.tableNumber || "Bàn"}`
                            : `Mang về: #${o.queueNumber || 1}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="line-clamp-2 text-[11px] text-slate-600">
                          {o.items.map((it: any, idx: number) => (
                            <span key={it.id || idx}>
                              {it.quantity}x {it.name}
                              {it.variantName && ` (${it.variantName})`}
                              {idx < o.items.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.paymentMethod === "CASH"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {o.paymentMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản QR"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatVND(o.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/orders/${o.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          <span>Xem bill</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Khung In Báo Cáo Ca (80mm hoặc A5) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Xem Trước Báo Cáo Bàn Giao Ca ({printPaperSize.toUpperCase()})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintPaperSize("80mm")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    printPaperSize === "80mm"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Khổ 80mm
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPaperSize("A5")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    printPaperSize === "A5"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Khổ A5
                </button>
              </div>
            </div>

            {/* Vùng xem trước in */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 rounded-2xl flex justify-center">
              <div
                id="shift-report-printable"
                className={`bg-white text-black font-mono shadow-xs border border-dashed border-slate-400 p-5 leading-tight ${
                  printPaperSize === "80mm"
                    ? "w-[80mm] max-w-[80mm] text-[12px]"
                    : "w-[148mm] max-w-[148mm] text-[13px]"
                }`}
              >
                {/* Header quán */}
                <div className="text-center space-y-0.5 mb-2">
                  <h2 className="font-bold uppercase tracking-wider text-[14px]">
                    {shopSettings?.shopName || "TIỆM TRÀ & CÀ PHÊ 88"}
                  </h2>
                  <p className="text-[10px] text-gray-600">
                    {shopSettings?.shopAddress || "123 Đường Nguyễn Huệ, Quận 1, TP.HCM"}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Hotline: {shopSettings?.shopPhone || "0909 123 456"}
                  </p>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div className="text-center space-y-1 mb-3">
                  <h3 className="font-bold text-[14px] uppercase tracking-wide">
                    PHIẾU BÀN GIAO CA LÀM VIỆC
                  </h3>
                  <p className="text-[10px] text-gray-700">Mã ca: {shift.id.slice(-8).toUpperCase()}</p>
                </div>

                <div className="space-y-1 text-[11px] mb-2">
                  <div className="flex justify-between">
                    <span>Nhân viên trực ca:</span>
                    <strong>{shift.staff?.name || shift.staffName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian mở:</span>
                    <span>{openDateStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian đóng:</span>
                    <span>{closeDateStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời lượng ca:</span>
                    <span>{durationHours} giờ {durationRemainingMinutes} phút</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                {/* Bảng số liệu tài chính */}
                <div className="space-y-1.5 text-[11px]">
                  <p className="font-bold uppercase text-[11px] border-b border-black pb-0.5">
                    1. TỔNG HỢP TÀI CHÍNH
                  </p>
                  <div className="flex justify-between">
                    <span>Tiền mặt đầu ca (1):</span>
                    <span>{formatVND(shift.openingCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Doanh thu tiền mặt (2):</span>
                    <span>{formatVND(cashSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Doanh thu chuyển khoản (3):</span>
                    <span>{formatVND(transferSales)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-dotted border-gray-400">
                    <span>Tổng doanh thu (2 + 3):</span>
                    <span>{formatVND(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[12px] bg-gray-100 p-1 rounded">
                    <span>Tiền mặt dự kiến két (1 + 2):</span>
                    <span>{formatVND(expectedCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[12px] pt-1">
                    <span>Tiền thực tế đếm được:</span>
                    <span>{formatVND(closingCash)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-dashed border-black pt-1">
                    <span>Chênh lệch két:</span>
                    <span>
                      {cashDiff === 0
                        ? "0 ₫ (Khớp 100%)"
                        : cashDiff > 0
                        ? `+${formatVND(cashDiff)} (Thừa)`
                        : `${formatVND(cashDiff)} (Thiếu)`}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div className="space-y-1 text-[11px]">
                  <p className="font-bold uppercase text-[11px] border-b border-black pb-0.5">
                    2. THỐNG KÊ ĐƠN HÀNG
                  </p>
                  <div className="flex justify-between">
                    <span>Tổng số đơn hoàn tất:</span>
                    <strong>{orders.length} đơn</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Đơn thanh toán Tiền mặt:</span>
                    <span>{orders.filter((o) => o.paymentMethod === "CASH").length} đơn</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Đơn thanh toán VietQR:</span>
                    <span>{orders.filter((o) => o.paymentMethod === "TRANSFER").length} đơn</span>
                  </div>
                </div>

                {shift.note && (
                  <div className="mt-2 pt-2 border-t border-dotted border-gray-400 text-[10px] italic">
                    Ghi chú ca: {shift.note}
                  </div>
                )}

                <div className="border-t border-dashed border-black my-4"></div>

                {/* Chữ ký xác nhận */}
                <div className="grid grid-cols-2 text-center text-[10px] gap-2 pt-1 pb-4">
                  <div>
                    <p className="font-bold">THU NGÂN BÀN GIAO</p>
                    <p className="text-[9px] text-gray-500 italic mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-12"></div>
                    <p className="font-bold">{shift.staff?.name || shift.staffName}</p>
                  </div>
                  <div>
                    <p className="font-bold">QUẢN LÝ TIẾP NHẬN</p>
                    <p className="text-[9px] text-gray-500 italic mt-0.5">(Ký và xác nhận)</p>
                    <div className="h-12"></div>
                    <p className="font-bold">.............................</p>
                  </div>
                </div>

                <div className="text-center text-[9px] text-gray-500 pt-2 border-t border-dashed border-gray-300">
                  In lúc: {new Date().toLocaleString("vi-VN")}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200 transition"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={triggerBrowserPrint}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Tiến hành In</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
