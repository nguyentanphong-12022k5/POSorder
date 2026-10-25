"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/lib/store/cart";
import { formatVND, parseVND } from "@/lib/money";
import { getVietQRUrl } from "@/lib/vietqr";
import { useToast } from "@/components/ui/ToastProvider";
import { CreateOrderSchema, formatZodError } from "@/lib/validations/schemas";
import { savePendingOrder } from "@/lib/offline/db";
import { offlineManager } from "@/lib/offline/offlineManager";
import OfflineReceiptModal from "@/components/pos/OfflineReceiptModal";
import {
  ArrowLeft,
  Banknote,
  QrCode,
  Printer,
  Receipt,
  User,
  Sparkles,
  ShoppingBag,
  Utensils,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getSubtotal, clearCart } = useCartStore();
  const { showError, showSuccess } = useToast();
  const [mounted, setMounted] = useState(false);

  // States
  const [orderType, setOrderType] = useState<"TAKEAWAY" | "DINE_IN">("TAKEAWAY");
  const [selectedTable, setSelectedTable] = useState<string>("Bàn 01");
  const [tables, setTables] = useState<any[]>([]);

  const [discountType, setDiscountType] = useState<"VND" | "PERCENT">("VND");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [orderNote, setOrderNote] = useState<string>("");

  // Customer Loyalty states
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [pointsToUse, setPointsToUse] = useState<number>(0);

  // Shop Bank Settings
  const [shopSettings, setShopSettings] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offlineOrderToPrint, setOfflineOrderToPrint] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
    // Fetch tables & shop bank settings
    async function initData() {
      try {
        const [tabRes, setRes] = await Promise.all([
          fetch("/api/tables"),
          fetch("/api/settings"),
        ]);
        const tabData = await tabRes.json();
        const setData = await setRes.json();
        if (tabData.success) setTables(tabData.data);
        if (setData.success) setShopSettings(setData.data);
      } catch (e) {
        console.error("Lỗi tải thông tin:", e);
      }
    }
    initData();
  }, []);

  const subtotal = getSubtotal();

  // Khách hàng tra cứu điểm
  const handleLookupCustomer = async (phone: string) => {
    setCustomerPhone(phone);
    if (phone.length >= 9) {
      try {
        const res = await fetch(`/api/customers?phone=${phone.trim()}`);
        const json = await res.json();
        if (json.success && json.data) {
          setCustomerInfo(json.data);
        } else {
          setCustomerInfo(null);
          setPointsToUse(0);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setCustomerInfo(null);
      setPointsToUse(0);
    }
  };

  // Điểm tích luỹ đổi giảm giá: 1 điểm = 1.000 ₫
  const loyaltyDiscount = pointsToUse * 1000;

  // Tính tiền giảm giá
  const rawDiscount =
    discountType === "PERCENT"
      ? Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100)
      : Math.min(subtotal, Math.max(0, discountValue));

  const totalDiscount = Math.min(subtotal, rawDiscount + loyaltyDiscount);
  const total = Math.max(0, subtotal - totalDiscount);

  // Tự động gán tiền khách đưa = tổng tiền khi thay đổi tổng
  useEffect(() => {
    if (paymentMethod === "CASH" && (paidAmount === 0 || paidAmount < total)) {
      setPaidAmount(total);
    }
  }, [total, paymentMethod]);

  if (!mounted) {
    return <div className="py-20 text-center text-slate-500">Đang chuẩn bị trang thanh toán...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-xs">
        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Giỏ hàng của bạn đang rỗng</h2>
        <p className="text-sm text-slate-500 mt-1">Vui lòng quay lại menu để chọn đồ uống trước khi thanh toán.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại bán hàng
        </Link>
      </div>
    );
  }

  const changeAmount = paymentMethod === "CASH" ? Math.max(0, paidAmount - total) : 0;
  const isCashInsufficient = paymentMethod === "CASH" && paidAmount < total;
  const quickDenominations = [50000, 100000, 200000, 500000];

  // URL VietQR thật
  const vietQrUrl = getVietQRUrl({
    bankCode: shopSettings?.bankCode || "MB",
    accountNumber: shopSettings?.bankAccountNumber || "888899998888",
    accountName: shopSettings?.bankAccountName || "TIEM TRA VA CA PHE 88",
    amount: total,
    description: `POS ${orderType === "DINE_IN" ? selectedTable : "Mang ve"}`,
  });

  const handleSubmitOrder = async () => {
    // 1. Chặn hoàn toàn double-click hoặc spam bấm liên tiếp
    if (isSubmitting) return;

    if (isCashInsufficient) {
      const msg = "Số tiền khách đưa không được nhỏ hơn tổng thanh toán!";
      setErrorMessage(msg);
      showError(msg, "Chưa đủ tiền khách đưa");
      return;
    }

    // 2. Chuẩn bị payload
    const orderPayload = {
      items,
      subtotal,
      discount: totalDiscount,
      total,
      paymentMethod,
      paidAmount: paymentMethod === "TRANSFER" ? total : paidAmount,
      note: orderNote || null,
      orderType,
      tableNumber: orderType === "DINE_IN" ? selectedTable : null,
      customerPhone: customerPhone || null,
      customerName: customerInfo?.name || null,
      pointsUsed: pointsToUse,
    };

    // 3. Client Zod Validation trước khi gửi request
    const clientValidation = CreateOrderSchema.safeParse(orderPayload);
    if (!clientValidation.success) {
      const { firstMessage } = formatZodError(clientValidation.error);
      setErrorMessage(firstMessage);
      showError(firstMessage, "Thông tin đơn chưa hợp lệ");
      return;
    }

    // 4. Kích hoạt loading spinner và khóa nút
    setIsSubmitting(true);
    setErrorMessage(null);

    const isNetworkOffline = typeof navigator !== "undefined" && !navigator.onLine;
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos-${Date.now()}-${Math.random()}`;

    // 4.1. NẾU THIẾT BỊ ĐANG NGOẠI TUYẾN (MẤT MẠNG): Lưu IndexedDB & Mở in local
    if (isNetworkOffline) {
      try {
        const pending = await savePendingOrder(orderPayload, idempotencyKey);
        await offlineManager.refreshPendingCount();
        showSuccess(
          "Thiết bị đang mất mạng. Đơn hàng đã được lưu an toàn vào máy và sẽ tự động đồng bộ khi có mạng!",
          "Lưu Đơn Ngoại Tuyến"
        );
        clearCart();
        setIsSubmitting(false);
        setOfflineOrderToPrint(pending);
        return;
      } catch (saveErr: any) {
        showError(saveErr, "Lỗi lưu đơn vào bộ nhớ máy");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(orderPayload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Lấy message từ cấu trúc chuẩn { error: { message } }
        const errMsg =
          result.error?.message || result.message || "Tạo đơn hàng thất bại. Vui lòng kiểm tra lại!";
        throw new Error(errMsg);
      }

      showSuccess(`Đã tạo đơn ${result.data?.code || ""} thành công!`, "Thanh toán hoàn tất");
      clearCart();
      router.push(`/orders/${result.data.id}?print=1`);
    } catch (err: any) {
      console.error("Lỗi xác nhận thanh toán:", err);

      // 4.2. Nếu mất kết nối mạng bất ngờ trong lúc gửi fetch:
      const isFetchNetworkError =
        err.name === "TypeError" ||
        err.message?.includes("Failed to fetch") ||
        err.message?.includes("NetworkError") ||
        err.message?.includes("Network request failed");

      if (isFetchNetworkError) {
        offlineManager.setStatus("OFFLINE");
        const pending = await savePendingOrder(orderPayload, idempotencyKey);
        await offlineManager.refreshPendingCount();
        showSuccess(
          "Mất kết nối máy chủ! Đơn đã được lưu tạm vào máy và sẽ tự động gửi khi có mạng lại.",
          "Chuyển Sang Ngoại Tuyến"
        );
        clearCart();
        setIsSubmitting(false);
        setOfflineOrderToPrint(pending);
        return;
      }

      // Hiển thị toast lỗi tiếng Việt thân thiện, che giấu raw error kỹ thuật
      showError(err, "Không thể tạo đơn hàng");
      setErrorMessage(err.message || "Đã xảy ra lỗi khi tạo đơn hàng");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-amber-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại chọn món
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Xác nhận thanh toán & In hóa đơn</h1>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI: Tóm tắt đơn hàng & Hình thức phục vụ */}
        <div className="lg:col-span-5 space-y-4">
          {/* Chọn Mang về / Tại bàn */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Hình thức phục vụ
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType("TAKEAWAY")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  orderType === "TAKEAWAY"
                    ? "bg-amber-50 border-amber-600 text-amber-800 ring-1 ring-amber-500/30"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Mang về (Takeaway)
              </button>

              <button
                type="button"
                onClick={() => setOrderType("DINE_IN")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                  orderType === "DINE_IN"
                    ? "bg-amber-50 border-amber-600 text-amber-800 ring-1 ring-amber-500/30"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <Utensils className="w-4 h-4" />
                Tại bàn (Dine-in)
              </button>
            </div>

            {orderType === "DINE_IN" && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Chọn vị trí bàn:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:outline-none"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} {t.status === "OCCUPIED" ? "(Đang có khách)" : "(Trống)"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Chi tiết đơn */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-600" />
                Chi tiết hóa đơn ({items.length} món)
              </h2>
              <Link href="/" className="text-xs text-amber-600 hover:underline font-semibold">
                Sửa món
              </Link>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex items-start justify-between text-sm pb-2 border-b border-slate-100 last:border-none"
                >
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">
                      <span className="text-amber-600 font-bold mr-1.5">{item.quantity}x</span>
                      {item.name}
                      {item.variantName && (
                        <span className="text-slate-500 font-normal ml-1">
                          ({item.variantName})
                        </span>
                      )}
                    </div>
                    {item.toppings && item.toppings.length > 0 && (
                      <div className="text-[10px] text-slate-500 pl-4 mt-0.5">
                        {item.toppings.map((t) => `+ ${t.name}`).join(", ")}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-[10px] italic text-amber-700 pl-4">
                        *{item.note}
                      </div>
                    )}
                  </div>
                  <span className="font-bold text-slate-800 text-xs whitespace-nowrap ml-2">
                    {formatVND(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Tạm tính</span>
                <span className="font-semibold">{formatVND(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Giảm giá</span>
                  <span className="font-bold">-{formatVND(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>TỔNG CỘNG</span>
                <span className="text-base text-amber-600">{formatVND(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: Khách hàng, Giảm giá, Thanh toán */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Khách hàng thân thiết & Tích điểm */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" />
                Khách Hàng Thân Thiết (Tích điểm)
              </label>
              {customerInfo && (
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  {customerInfo.name}: {customerInfo.points} điểm
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => handleLookupCustomer(e.target.value)}
                placeholder="Nhập SĐT khách hàng (09...)"
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Đổi điểm nếu có */}
            {customerInfo && customerInfo.points >= 10 && (
              <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-purple-900">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Đổi 10 điểm = Giảm 10.000 ₫</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPointsToUse(pointsToUse > 0 ? 0 : 10)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                    pointsToUse > 0
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white text-purple-700 border border-purple-300 hover:bg-purple-100"
                  }`}
                >
                  {pointsToUse > 0 ? "Đang áp dụng (-10k)" : "Áp dụng"}
                </button>
              </div>
            )}
          </div>

          {/* 2. Giảm giá thêm */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2.5">
            <label className="block text-xs font-bold text-slate-800">
              Chiết khấu & Khuyến mãi thêm
            </label>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDiscountType("VND")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    discountType === "VND" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  VNĐ
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType("PERCENT")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    discountType === "PERCENT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  %
                </button>
              </div>

              <input
                type="number"
                min="0"
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(parseVND(e.target.value))}
                placeholder={discountType === "PERCENT" ? "% giảm (vd: 10)" : "Số tiền giảm..."}
                className="flex-1 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>
          </div>

          {/* 3. Phương thức thanh toán & VietQR Thật */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-800 uppercase">
              Phương thức thanh toán
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                  paymentMethod === "CASH"
                    ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/30 text-amber-900"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    paymentMethod === "CASH" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs block">Tiền mặt</span>
                  <span className="text-[10px] text-slate-500">Khách đưa tiền mặt</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("TRANSFER")}
                className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                  paymentMethod === "TRANSFER"
                    ? "border-amber-600 bg-amber-50/60 ring-2 ring-amber-600/30 text-amber-900"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    paymentMethod === "TRANSFER" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs block">VietQR Ngân hàng</span>
                  <span className="text-[10px] text-slate-500">Quét mã chuyển khoản</span>
                </div>
              </button>
            </div>

            {/* Nếu chọn TIỀN MẶT */}
            {paymentMethod === "CASH" && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Khách đưa (VNĐ):</span>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(total)}
                    className="text-xs text-amber-600 hover:underline font-semibold"
                  >
                    Đúng số tiền ({formatVND(total)})
                  </button>
                </div>

                <input
                  type="number"
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(parseVND(e.target.value))}
                  placeholder="Nhập số tiền khách đưa"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-base font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />

                <div className="flex flex-wrap gap-2 pt-1">
                  {quickDenominations.map((denom) => (
                    <button
                      type="button"
                      key={denom}
                      onClick={() => setPaidAmount(denom)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
                    >
                      {formatVND(denom)}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Tiền thối lại:</span>
                  <span
                    className={`text-base font-bold ${
                      isCashInsufficient ? "text-red-500" : "text-emerald-600"
                    }`}
                  >
                    {isCashInsufficient ? "Chưa đủ tiền!" : formatVND(changeAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* Nếu chọn CHUYỂN KHOẢN VIETQR THẬT */}
            {paymentMethod === "TRANSFER" && (
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-32 h-32 bg-white p-1 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  <img
                    src={vietQrUrl}
                    alt="VietQR Chuyển khoản"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-xs space-y-1 text-slate-700 flex-1">
                  <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-600" />
                    Mã VietQR Động Chuẩn Napas 247
                  </p>
                  <p>Ngân hàng: <strong>{shopSettings?.bankCode || "MBBank"}</strong></p>
                  <p>Số TK: <strong className="font-mono text-amber-700">{shopSettings?.bankAccountNumber || "888899998888"}</strong></p>
                  <p>Chủ tài khoản: <strong>{shopSettings?.bankAccountName || "TIEM TRA VA CA PHE 88"}</strong></p>
                  <p className="text-base font-bold text-amber-700 pt-1">Số tiền: {formatVND(total)}</p>
                  <p className="text-[11px] text-slate-500 italic">Khách quét bằng bất kỳ App ngân hàng nào cũng tự động nhận đúng số tiền.</p>
                </div>
              </div>
            )}

            <input
              type="text"
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder="Ghi chú đơn hàng (nếu có)..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none"
            />
          </div>

          {/* 4. Nút Xác nhận & In bill - Chặn double-click & hiển thị loading spinner */}
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={isSubmitting || isCashInsufficient}
            aria-busy={isSubmitting}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-sm text-white shadow-md transition flex items-center justify-center gap-2 select-none ${
              isSubmitting || isCashInsufficient
                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30 active:scale-98"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Đang xử lý thanh toán, vui lòng chờ...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Xác nhận & In bill ({formatVND(total)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Xem & In Hóa Đơn khi Offline */}
      {offlineOrderToPrint && (
        <OfflineReceiptModal
          order={offlineOrderToPrint}
          onClose={() => {
            setOfflineOrderToPrint(null);
            router.push("/");
          }}
        />
      )}
    </div>
  );
}
