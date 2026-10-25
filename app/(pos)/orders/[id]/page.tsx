"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import {
  Printer,
  Download,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Tag,
  Ban,
  X,
  AlertTriangle,
  RotateCw,
  Clock,
  User,
  History,
  FileText,
  AlertCircle,
} from "lucide-react";

interface PrintLogItem {
  id: string;
  orderId: string;
  staffId?: string | null;
  printedAt: string | Date;
  isReprint: boolean;
  printNum: number;
  staff?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function OrderDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const shouldAutoPrint = searchParams?.get("print") === "1";

  const [order, setOrder] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Trạng thái in ấn & Lỗi máy in
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccessMessage, setPrintSuccessMessage] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState<boolean>(false);
  const hasAutoPrintedRef = React.useRef(false);

  // Modal Hủy đơn
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("Khách đổi ý");
  const [adminPin, setAdminPin] = useState("1234");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Modal Tem dán ly (Cup Labels)
  const [showLabelModal, setShowLabelModal] = useState(false);

  const fetchOrderAndSettings = async () => {
    try {
      const [orderRes, settingRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`),
        fetch(`/api/settings`),
      ]);

      const orderData = await orderRes.json();
      const settingData = await settingRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.message || "Không tìm thấy hóa đơn");
      }

      setOrder(orderData.data);
      if (settingData.success) {
        setShopSettings(settingData.data);
      }
    } catch (err: any) {
      setError(err.message || "Lỗi tải thông tin hóa đơn");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderAndSettings();
    }
  }, [orderId]);

  // Hàm chuẩn hóa chuỗi lỗi tránh render object làm crash React
  const extractErrorMessage = (err: any, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === "string") return err;
    if (typeof err === "object") {
      if (typeof err.message === "string") return err.message;
      if (typeof err.error === "string") return err.error;
      if (err.error && typeof err.error.message === "string") return err.error.message;
    }
    return fallback;
  };

  // Tự động in DUY NHẤT 1 LẦN nếu chuyển từ checkout
  useEffect(() => {
    if (!isLoading && order && shouldAutoPrint && !hasAutoPrintedRef.current) {
      hasAutoPrintedRef.current = true;
      // Dọn sạch tham số ?print=1 trên URL để tránh lặp khi F5
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", `/orders/${order.id}`);
      }
      const timer = setTimeout(() => {
        handleTriggerPrint(false, true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, order, shouldAutoPrint]);

  /**
   * Gọi API POST /api/orders/[id]/print
   * Hỗ trợ in lần đầu, in lại, chặn spam < 3s và xử lý an toàn khi máy in throw
   */
  const handleTriggerPrint = async (simErr = simulateError, isAuto = false) => {
    if (!order) return;
    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccessMessage(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateError: simErr }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Chặn spam in < 3s
        setPrintError(
          extractErrorMessage(
            data.error || data.message,
            "Thao tác in quá nhanh! Vui lòng chờ ít nhất 3 giây."
          )
        );
        return;
      }

      if (!res.ok || data.printed === false) {
        // Máy in lỗi (ESC/POS throw error) -> Đơn không bị mất, báo lỗi rõ ràng
        setPrintError(
          extractErrorMessage(
            data.error || data.message,
            "In thất bại do sự cố máy in hoặc kết nối. Vui lòng kiểm tra thiết bị!"
          )
        );
        return;
      }

      // In thành công
      setPrintSuccessMessage(
        data.message || (data.isReprint ? `Đã in lại lần ${data.printNum}` : "Đã in hóa đơn thành công")
      );

      // Cập nhật lại lịch sử in ngay lập tức
      if (data.log) {
        setOrder((prev: any) => ({
          ...prev,
          printLogs: [data.log, ...(prev?.printLogs || [])],
        }));
      }

      // Chỉ bật hộp thoại window.print() nếu in thủ công (không tự động ép hiện pop-up chặn màn hình)
      if (!isAuto) {
        try {
          if (typeof window !== "undefined" && typeof window.print === "function") {
            window.print();
          }
        } catch (e) {
          // Bỏ qua môi trường kiểm thử
        }
      }
    } catch (err: any) {
      setPrintError(extractErrorMessage(err, "In thất bại, bấm để thử lại"));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason, adminPin }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || "Lỗi khi hủy đơn");
      }
      setShowCancelModal(false);
      fetchOrderAndSettings();
    } catch (err: any) {
      setCancelError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="font-semibold text-sm">Đang tải hóa đơn...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl border border-red-200 text-center shadow-xs">
        <p className="text-red-600 font-bold mb-4">{error || "Hóa đơn không tồn tại"}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Về trang bán hàng
        </Link>
      </div>
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const printLogs: PrintLogItem[] = order.printLogs || [];
  const printCount = printLogs.length;
  const isReprint = printCount > 0;
  const nextPrintNum = printCount + 1;

  // Tạo danh sách từng ly riêng biệt cho tem dán ly
  const individualCupLabels: Array<{
    cupIndex: number;
    totalCups: number;
    name: string;
    variantName?: string | null;
    toppings: string[];
    note?: string | null;
  }> = [];

  let currentCupCount = 0;
  const totalCups = order.items.reduce((s: number, it: any) => s + it.quantity, 0);

  order.items.forEach((item: any) => {
    let toppings: string[] = [];
    try {
      if (item.toppings) {
        toppings = JSON.parse(item.toppings).map((t: any) => t.name);
      }
    } catch (e) {}

    for (let i = 0; i < item.quantity; i++) {
      currentCupCount++;
      individualCupLabels.push({
        cupIndex: currentCupCount,
        totalCups,
        name: item.name,
        variantName: item.variantName,
        toppings,
        note: item.note,
      });
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Action Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isCancelled ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isCancelled ? <Ban className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm">
                Đơn hàng {order.code} {isCancelled ? "(ĐÃ HỦY)" : "đã thanh toán"}
              </h2>
              {isReprint && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                  Đã in {printCount} lần
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {order.orderType === "DINE_IN"
                ? `Tại bàn: ${order.tableNumber || "Bàn"}`
                : `Mang về: #${order.queueNumber || 1}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút In bill / In lại */}
          <button
            type="button"
            disabled={isPrinting}
            onClick={() => handleTriggerPrint(false)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition ${
              isPrinting
                ? "bg-amber-400 cursor-not-allowed"
                : isReprint
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}
          >
            {isPrinting ? (
              <RotateCw className="w-4 h-4 animate-spin" />
            ) : isReprint ? (
              <RotateCw className="w-4 h-4" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            <span>
              {isPrinting
                ? "Đang gửi lệnh in..."
                : isReprint
                ? `In lại (Lần ${nextPrintNum})`
                : "In bill 80mm"}
            </span>
          </button>

          {/* Nút Tải PDF (vẫn hoạt động kể cả khi máy in lỗi) */}
          <a
            href={`/api/invoice/${order.id}${isReprint ? `?reprint=1&printNum=${printCount}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
            title="Tải file PDF hóa đơn chuẩn 80mm"
          >
            <Download className="w-4 h-4" />
            <span>Tải PDF</span>
          </a>

          {/* Nút In Tem Dán Ly */}
          <button
            type="button"
            onClick={() => setShowLabelModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tem dán ly ({totalCups})</span>
          </button>

          {/* Nút Hủy đơn */}
          {!isCancelled && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Hủy đơn</span>
            </button>
          )}

          {/* Nút Đơn mới */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Đơn mới</span>
          </Link>
        </div>
      </div>

      {/* Cảnh báo máy in lỗi: KHÔNG mất đơn, cho phép bấm thử lại ngay và tải PDF */}
      {printError && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-800 animate-in fade-in duration-200 print:hidden shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs uppercase tracking-wide text-red-700">
                In thất bại: {printError}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Đơn hàng vẫn an toàn trong hệ thống. Bạn có thể bấm thử lại hoặc tải file PDF để in ngoài.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleTriggerPrint(false)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition"
            >
              Bấm để thử lại
            </button>
            <a
              href={`/api/invoice/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 text-center transition"
            >
              Tải PDF
            </a>
          </div>
        </div>
      )}

      {/* Thông báo in thành công */}
      {printSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800 text-xs font-medium flex items-center justify-between animate-in fade-in duration-150 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{printSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrintSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Tùy chọn test mô phỏng lỗi máy in (dành cho kiểm thử) */}
      <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500 print:hidden">
        <label className="flex items-center gap-1.5 cursor-pointer select-none bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            checked={simulateError}
            onChange={(e) => setSimulateError(e.target.checked)}
            className="rounded text-red-600 focus:ring-0"
          />
          <span className="text-slate-600 font-medium">Mô phỏng máy in lỗi (Test ESC/POS throw)</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Hóa đơn chuẩn 80mm */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex justify-center print:p-0 print:border-none print:shadow-none">
          <InvoiceTemplate
            order={order}
            shopName={shopSettings?.shopName}
            shopAddress={shopSettings?.shopAddress}
            shopPhone={shopSettings?.shopPhone}
            isReprint={isReprint}
            printNum={printCount || 1}
          />
        </div>

        {/* Cột phải: Lịch sử in chi tiết (Print History Audit Log) */}
        <div className="lg:col-span-5 space-y-4 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                Lịch sử in ({printCount} lần)
              </h3>
              <span className="text-[11px] font-semibold text-slate-500">
                {isReprint ? "Đã có bản in lại" : "Chưa in lại"}
              </span>
            </div>

            {printLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Chưa có bản ghi in nhiệt nào.</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Bấm nút &quot;In bill 80mm&quot; để gửi lệnh in đầu tiên.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2 max-h-[420px] overflow-y-auto pr-1">
                {printLogs.map((log, index) => {
                  const printDate = new Date(log.printedAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });
                  const isFirst = !log.isReprint && log.printNum === 1;

                  return (
                    <div key={log.id || index} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                              isFirst
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isFirst ? "Lần 1 (Gốc)" : `In lại lần ${log.printNum}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {log.staff?.name || log.staff?.email || "Thu ngân ca hiện tại"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>{printDate}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <a
                          href={`/api/invoice/${order.id}?reprint=${log.isReprint ? "1" : "0"}&printNum=${log.printNum}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hướng dẫn vận hành in ấn */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5">
            <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Quy tắc in hóa đơn an toàn
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
              <li>Lần in đầu tiên hiển thị tiêu đề chuẩn <strong>&quot;HÓA ĐƠN&quot;</strong>.</li>
              <li>Từ lần thứ 2 trở đi, hóa đơn sẽ tự động đóng dấu đỏ <strong>*** IN LẠI LẦN N ***</strong> để chống nhân viên in nhiều lần thu tiền khách.</li>
              <li>Hệ thống chống bấm spam in liên tục (khoảng cách tối thiểu 3 giây).</li>
              <li>Khi máy in kẹt giấy hoặc mất mạng, đơn hàng vẫn an toàn tuyệt đối.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal Hủy Đơn Hàng (Accessible Dialog) */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <form onSubmit={handleCancelOrder} className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 id="cancel-dialog-title" className="font-bold text-red-600 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Hủy Đơn Hàng {order.code}
              </h3>
              <button
                type="button"
                aria-label="Đóng hộp thoại hủy đơn"
                onClick={() => setShowCancelModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cancelError && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-lg">{cancelError}</p>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 space-y-1">
              <p className="font-bold">Quy định bảo vệ đơn hàng:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[10px]">
                <li>Thu ngân chỉ tự hủy được đơn trong vòng <strong>5 phút</strong> và <strong>chưa từng in hóa đơn</strong>.</li>
                <li>Đơn đã in hoặc quá 5 phút bắt buộc phải nhập mã PIN Admin.</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý do hủy đơn *
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
              >
                <option value="Khách đổi ý không mua nữa">Khách đổi ý không mua nữa</option>
                <option value="Pha nhầm món / Hỏng món">Pha nhầm món / Hỏng món</option>
                <option value="Thu ngân nhập nhầm thông tin">Thu ngân nhập nhầm thông tin</option>
                <option value="Khác">Khác...</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mã PIN Quản trị viên (Mặc định: 1234) *
              </label>
              <input
                type="password"
                required
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                className="w-full text-center font-mono font-bold px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-1/2 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 rounded-xl text-white font-bold text-xs bg-red-600 hover:bg-red-700"
              >
                Xác nhận hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal In Tem Dán Ly (Cup Labels 50x30mm) */}
      {showLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                Mẫu Tem Dán Thân Ly ({individualCupLabels.length} tem)
              </h3>
              <button
                type="button"
                onClick={() => setShowLabelModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 p-1 flex-1">
              {individualCupLabels.map((cup, idx) => (
                <div
                  key={idx}
                  className="w-72 mx-auto bg-white border-2 border-slate-800 rounded-lg p-3 text-black font-mono text-xs space-y-1 shadow-xs"
                >
                  <div className="flex justify-between items-center border-b border-slate-400 pb-1 text-[10px]">
                    <span className="font-bold">{shopSettings?.shopName || "TIỆM TRÀ 88"}</span>
                    <span>Ly {cup.cupIndex}/{cup.totalCups}</span>
                  </div>

                  <div className="pt-1">
                    <p className="font-black text-sm text-slate-900 leading-tight">
                      {cup.name} {cup.variantName && `(${cup.variantName})`}
                    </p>
                    {cup.toppings.length > 0 && (
                      <p className="text-[10px] text-slate-600 pt-0.5">
                        +{cup.toppings.join(", ")}
                      </p>
                    )}
                    {cup.note && (
                      <p className="text-[10px] font-bold text-slate-800 italic pt-0.5">
                        *{cup.note}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-300 pt-1 text-[9px] text-slate-500">
                    <span>Đơn: <strong>{order.code}</strong></span>
                    <span>{order.orderType === "DINE_IN" ? order.tableNumber : "Mang về"}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLabelModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
              >
                In toàn bộ tem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
