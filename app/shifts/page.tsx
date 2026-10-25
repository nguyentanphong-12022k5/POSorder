"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatVND } from "@/lib/money";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Clock,
  Banknote,
  DollarSign,
  QrCode,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Printer,
  Calendar,
  Filter,
  User,
  ArrowRight,
  RotateCw,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function ShiftsPage() {
  const { showError, showSuccess, showWarning } = useToast();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Bộ lọc Admin
  const [filterStaffId, setFilterStaffId] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Modal đóng ca
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [closingCashInput, setClosingCashInput] = useState<string>("");
  const [closeNote, setCloseNote] = useState<string>("");

  // Modal mở ca mới
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [openingCashInput, setOpeningCashInput] = useState<string>("500000");
  const [openNote, setOpenNote] = useState<string>("Tiền lẻ đầu ca");

  const fetchShiftData = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (filterStaffId && filterStaffId !== "ALL") queryParams.set("staffId", filterStaffId);
      if (filterDate) queryParams.set("date", filterDate);
      if (filterStatus && filterStatus !== "ALL") queryParams.set("status", filterStatus);

      const res = await fetch(`/api/shifts?${queryParams.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data?.liveStats && !closingCashInput) {
          setClosingCashInput(String(json.data.liveStats.expectedCash));
        }
        if (json.data?.staffList?.length > 0 && !selectedStaffId) {
          setSelectedStaffId(json.data.staffList[0].id);
        }
      }
    } catch (e: any) {
      showError(e, "Không thể tải danh sách ca làm việc");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, [filterStaffId, filterDate, filterStatus]);

  // Xử lý MỞ CA
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedOpeningCash = parseInt(openingCashInput.replace(/\D/g, ""), 10) || 0;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN",
          staffId: selectedStaffId,
          openingCash: parsedOpeningCash,
          note: openNote.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || "Không thể mở ca làm việc");
      }

      showSuccess(json.message || "Đã mở ca làm việc thành công!", "Mở ca hoàn tất");
      setShowOpenModal(false);
      fetchShiftData();
    } catch (err: any) {
      showError(err, "Mở ca thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý ĐÓNG CA
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedClosingCash = parseInt(closingCashInput.replace(/\D/g, ""), 10) || 0;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          closingCash: parsedClosingCash,
          note: closeNote.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || "Không thể đóng ca làm việc");
      }

      showSuccess("Đã đóng ca làm việc thành công!", "Bàn giao ca hoàn tất");
      setShowCloseModal(false);
      setClosingCashInput("");
      setCloseNote("");
      fetchShiftData();
    } catch (err: any) {
      showError(err, "Đóng ca thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeShift = data?.activeShift;
  const liveStats = data?.liveStats || {
    cashSales: 0,
    transferSales: 0,
    totalOrders: 0,
    expectedCash: 0,
  };
  const shifts: any[] = data?.shifts || [];
  const staffList: any[] = data?.staffList || [];

  // Tính toán nhẩm độ lệch khi gõ vào modal đóng ca
  const previewExpected = liveStats.expectedCash;
  const previewActual = parseInt(closingCashInput.replace(/\D/g, ""), 10) || 0;
  const previewDiff = previewActual - previewExpected;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header Trang */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Quản Lý Ca Làm Việc & Bàn Giao Két
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mở ca đầu ngày, theo dõi doanh thu trực tiếp và đối soát tiền mặt cuối ca chống thất thoát.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!activeShift ? (
            <button
              type="button"
              onClick={() => {
                setOpeningCashInput("500000");
                setShowOpenModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Mở ca làm việc mới</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setClosingCashInput(String(liveStats.expectedCash));
                setShowCloseModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Đóng ca & Kết sổ két</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Banner Ca Đang Mở (Active Shift) */}
      {activeShift ? (
        <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-50/40 rounded-3xl border-2 border-amber-300/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xs font-black uppercase text-amber-900 tracking-wider">
                Ca đang mở trực tiếp
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                Mã: {activeShift.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-slate-600">
              Nhân viên: <strong>{activeShift.staff?.name || activeShift.staffName}</strong> • Bắt đầu lúc:{" "}
              <strong>{new Date(activeShift.openedAt).toLocaleTimeString("vi-VN")}</strong> (
              {new Date(activeShift.openedAt).toLocaleDateString("vi-VN")})
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/80 p-3.5 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tiền đầu ca</span>
              <p className="text-base font-black text-slate-800">{formatVND(activeShift.openingCash)}</p>
              <span className="text-[10px] text-slate-400">Tiền thối sẵn két</span>
            </div>

            <div className="bg-white/80 p-3.5 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Thu tiền mặt</span>
              <p className="text-base font-black text-emerald-600">{formatVND(liveStats.cashSales)}</p>
              <span className="text-[10px] text-slate-400">Từ các đơn hoàn tất</span>
            </div>

            <div className="bg-white/80 p-3.5 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Thu VietQR</span>
              <p className="text-base font-black text-blue-600">{formatVND(liveStats.transferSales)}</p>
              <span className="text-[10px] text-slate-400">Đã vào tài khoản quán</span>
            </div>

            <div className="bg-white/80 p-3.5 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Tiền mặt dự kiến két</span>
              <p className="text-base font-black text-amber-700">{formatVND(liveStats.expectedCash)}</p>
              <span className="text-[10px] text-amber-600 font-semibold">= Đầu ca + Thu tiền mặt</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-600" />
              <span>Đã tạo <strong>{liveStats.totalOrders} đơn hàng</strong> trong ca làm việc này.</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/shifts/${activeShift.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-50 transition"
              >
                <span>Xem chi tiết & Đơn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setClosingCashInput(String(liveStats.expectedCash));
                  setShowCloseModal(true);
                }}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
              >
                Đóng ca ngay
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Chưa có ca làm việc nào đang mở</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Thu ngân vui lòng bấm nút &quot;Mở ca làm việc mới&quot; và nhập số tiền mặt bàn giao đầu ca để bắt đầu ghi nhận đơn hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpeningCashInput("500000");
              setShowOpenModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Mở ca làm việc ngay</span>
          </button>
        </div>
      )}

      {/* 3. Khu vực Bộ Lọc Admin */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            Bộ lọc lịch sử ca
          </span>
          {(filterStaffId !== "ALL" || filterDate || filterStatus !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setFilterStaffId("ALL");
                setFilterDate("");
                setFilterStatus("ALL");
              }}
              className="text-[11px] text-amber-600 hover:underline font-bold"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Lọc theo nhân viên */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Nhân viên trực ca
            </label>
            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none"
            >
              <option value="ALL">Tất cả nhân viên</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role === "admin" ? "Quản trị" : "Thu ngân"})
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo ngày */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ngày làm việc
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none"
            />
          </div>

          {/* Lọc theo trạng thái */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Trạng thái ca
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="OPEN">Đang mở (chưa kết ca)</option>
              <option value="CLOSED">Đã đóng (đã bàn giao két)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Bảng Lịch Sử Ca Làm Việc */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm">
            Danh sách lịch sử ca ({shifts.length} ca)
          </h2>
          <span className="text-[11px] text-slate-400">Nhấn vào ca để xem chi tiết hoặc in phiếu bàn giao</span>
        </div>

        {shifts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Không tìm thấy ca làm việc nào khớp với điều kiện lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-bold">
                  <th className="py-3 px-4">Nhân viên</th>
                  <th className="py-3 px-4">Thời gian ca</th>
                  <th className="py-3 px-4 text-right">Tiền đầu ca</th>
                  <th className="py-3 px-4 text-right">Doanh thu TM</th>
                  <th className="py-3 px-4 text-right">Doanh thu QR</th>
                  <th className="py-3 px-4 text-right">Tiền thực tế</th>
                  <th className="py-3 px-4 text-right">Chênh lệch</th>
                  <th className="py-3 px-4 text-center">Số đơn</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {shifts.map((s) => {
                  const isOpen = s.status === "OPEN";
                  const openStr = new Date(s.openedAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  });
                  const closeStr = s.closedAt
                    ? new Date(s.closedAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : "Đang mở";

                  const diff = s.cashDifference ?? 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {s.staff?.name || s.staffName}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        <div>{openStr}</div>
                        <div>→ {closeStr}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatVND(s.openingCash)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                        {formatVND(s.cashRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-700 font-semibold">
                        {formatVND(s.totalTransfer)}
                      </td>
                      <td className="py-3 px-4 text-right font-black">
                        {isOpen ? "—" : formatVND(s.closingCash ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {isOpen ? (
                          <span className="text-slate-400 italic">Đang chạy</span>
                        ) : diff === 0 ? (
                          <span className="text-emerald-600">0 ₫ (Khớp)</span>
                        ) : diff > 0 ? (
                          <span className="text-blue-600">+{formatVND(diff)} (Dư)</span>
                        ) : (
                          <span className="text-red-600">{formatVND(diff)} (Thiếu)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {s.totalOrders || s._count?.orders || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOpen
                              ? "bg-emerald-100 text-emerald-800 animate-pulse"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isOpen ? "Đang mở" : "Đã đóng"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/shifts/${s.id}`}
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
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

      {/* MODAL MỞ CA MỚI */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleOpenShift}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Mở Ca Làm Việc Mới
              </h3>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhân viên đứng ca *
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tiền mặt đầu ca trong két (VNĐ) *
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                placeholder="500000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400">Chọn nhanh:</span>
                {[200000, 500000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningCashInput(String(amt))}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {formatVND(amt)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú đầu ca
              </label>
              <input
                type="text"
                value={openNote}
                onChange={(e) => setOpenNote(e.target.value)}
                placeholder="Ví dụ: Tiền lẻ tiền thối sẵn 500k..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                {isSubmitting ? "Đang mở ca..." : "Xác nhận mở ca"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ĐÓNG CA & BÀN GIAO KÉT */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCloseShift}
            className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  Đóng Ca Làm Việc & Đối Soát Két
                </h3>
                <p className="text-[11px] text-slate-500">
                  Thu ngân: {activeShift?.staff?.name || activeShift?.staffName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Bảng kê tổng hợp tự động */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Số đơn hoàn tất trong ca:</span>
                <strong>{liveStats.totalOrders} đơn</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tiền mặt đầu ca (1):</span>
                <span>{formatVND(activeShift?.openingCash || 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Doanh thu tiền mặt (2):</span>
                <span>+{formatVND(liveStats.cashSales)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Doanh thu chuyển khoản VietQR:</span>
                <span>+{formatVND(liveStats.transferSales)}</span>
              </div>
              <div className="flex justify-between font-black text-amber-900 border-t border-slate-200 pt-2 text-sm bg-amber-100/60 p-2 rounded-xl">
                <span>Tiền mặt dự kiến két (1 + 2):</span>
                <span>{formatVND(previewExpected)}</span>
              </div>
            </div>

            {/* Nhập tiền mặt thực tế kiểm đếm */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Tiền mặt thực tế kiểm đếm trong két (VNĐ) *
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                required
                value={closingCashInput}
                onChange={(e) => setClosingCashInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Hiển thị chênh lệch két thời gian thực */}
            <div
              className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                previewDiff === 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : previewDiff > 0
                  ? "bg-blue-50 border-blue-300 text-blue-800"
                  : "bg-red-50 border-red-300 text-red-800"
              }`}
            >
              <span>Kết quả đối soát két:</span>
              <span className="text-sm">
                {previewDiff === 0
                  ? "0 ₫ (Khớp 100% két)"
                  : previewDiff > 0
                  ? `+${formatVND(previewDiff)} (Dư tiền)`
                  : `${formatVND(previewDiff)} (Thiếu hụt)`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú bàn giao ca
              </label>
              <input
                type="text"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="Ghi chú lý do nếu lệch két hoặc ghi chú chuyển giao ca sau..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100 hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition"
              >
                {isSubmitting ? "Đang xử lý đóng ca..." : "Xác nhận đóng ca"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
