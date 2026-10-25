"use client";

import React, { useState, useEffect } from "react";
import { Settings, Store, Printer, Save, CheckCircle2, QrCode, Lock, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { VIETNAM_BANKS } from "@/lib/vietqr";

export default function SettingsPage() {
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [printerInterface, setPrinterInterface] = useState("tcp://192.168.1.100:9100");
  const [enableThermal, setEnableThermal] = useState(false);

  // VietQR banking settings
  const [bankCode, setBankCode] = useState("MB");
  const [bankAccountNumber, setBankAccountNumber] = useState("888899998888");
  const [bankAccountName, setBankAccountName] = useState("TIEM TRA VA CA PHE 88");

  // Admin PIN
  const [adminPin, setAdminPin] = useState("1234");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Printer Health Check State
  const [isCheckingPrinter, setIsCheckingPrinter] = useState(false);
  const [printerHealth, setPrinterHealth] = useState<any | null>(null);
  const [printerCheckMsg, setPrinterCheckMsg] = useState<string | null>(null);

  const handleTestPrinter = async (testPrint = false) => {
    setIsCheckingPrinter(true);
    setPrinterCheckMsg(null);
    try {
      const res = await fetch("/api/print/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPrint }),
      });
      const json = await res.json();
      if (json.data) {
        setPrinterHealth(json.data);
        if (testPrint) {
          setPrinterCheckMsg(json.data.testPrintMessage || "Đã gửi lệnh in thử");
        }
      }
    } catch (err: any) {
      setPrinterHealth({
        online: false,
        status: "OFFLINE",
        message: err.message || "Lỗi kiểm tra máy in",
      });
    } finally {
      setIsCheckingPrinter(false);
    }
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success && json.data) {
          setShopName(json.data.shopName || "");
          setShopAddress(json.data.shopAddress || "");
          setShopPhone(json.data.shopPhone || "");
          setPrinterInterface(json.data.printerInterface || "tcp://192.168.1.100:9100");
          setEnableThermal(Boolean(json.data.enableThermal));
          setBankCode(json.data.bankCode || "MB");
          setBankAccountNumber(json.data.bankAccountNumber || "888899998888");
          setBankAccountName(json.data.bankAccountName || "TIEM TRA VA CA PHE 88");
          setAdminPin(json.data.adminPin || "1234");
        }
      } catch (e) {
        console.error("Lỗi tải cài đặt:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          shopAddress,
          shopPhone,
          printerInterface,
          enableThermal,
          bankCode,
          bankAccountNumber,
          bankAccountName,
          adminPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Đã lưu thông tin cấu hình thành công!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e) {
      console.error("Lỗi lưu:", e);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-slate-500">Đang tải cấu hình...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-600" />
          Cài Đặt Cửa Hàng & Thanh Toán VietQR
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Thông tin hiển thị trên đầu phiếu hóa đơn 80mm, số tài khoản ngân hàng và mã PIN bảo mật.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Nhóm 1: Thông tin quán */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="w-4 h-4 text-amber-600" />
            Thông Tin Quán (In trên bill)
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên quán / Thương hiệu *
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Địa chỉ quán *
            </label>
            <input
              type="text"
              required
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Số điện thoại liên hệ *
            </label>
            <input
              type="text"
              required
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>

        {/* Nhóm 2: Cấu hình Tài khoản Ngân hàng (VietQR Thật) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <QrCode className="w-4 h-4 text-amber-600" />
            Cấu Hình Tài Khoản Chuyển Khoản VietQR (Napas 247)
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ngân hàng nhận tiền *
            </label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white focus:outline-none"
            >
              {VIETNAM_BANKS.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.shortName} - {bank.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Số tài khoản ngân hàng *
            </label>
            <input
              type="text"
              required
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Ví dụ: 0123456789"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên chủ tài khoản (Không dấu) *
            </label>
            <input
              type="text"
              required
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
              placeholder="NGUYEN VAN A"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold uppercase focus:outline-none"
            />
          </div>
        </div>

        {/* Nhóm 3: Mã PIN Quản trị viên */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-amber-600" />
            Mã PIN Bảo Mật Quản Trị Viên (Admin PIN)
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mã PIN (Dùng để sửa menu, hủy đơn, xem doanh thu)
            </label>
            <input
              type="password"
              maxLength={6}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              className="w-48 px-3.5 py-2 rounded-xl border border-slate-200 text-base font-mono font-bold tracking-widest text-center"
            />
            <p className="text-[11px] text-slate-400 mt-1">Mặc định: 1234</p>
          </div>
        </div>

        {/* Nhóm 4: Cấu hình máy in nhiệt ESC/POS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Printer className="w-4 h-4 text-amber-600" />
            Cấu Hình Máy In Hóa Đơn Nhiệt (ESC/POS)
          </h2>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <span className="font-bold text-sm text-slate-800 block">
                Bật nút In nhiệt ESC/POS
              </span>
              <span className="text-xs text-slate-500">
                Cho phép in trực tiếp từ máy chủ tới máy in LAN hoặc USB
              </span>
            </div>
            <input
              type="checkbox"
              checked={enableThermal}
              onChange={(e) => setEnableThermal(e.target.checked)}
              className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Địa chỉ kết nối máy in (Interface / IP:Port / USB)
            </label>
            <input
              type="text"
              value={printerInterface}
              onChange={(e) => setPrinterInterface(e.target.value)}
              placeholder="tcp://192.168.1.100:9100 hoặc usb://COM1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Hỗ trợ 3 chế độ qua PRINTER_MODE: <code>tcp</code>, <code>network</code> (mạng LAN cổng 9100) và <code>usb</code> (COM port / device path).
            </p>
          </div>

          {/* Công cụ chẩn đoán & In thử máy in (/api/print/health) */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestPrinter(false)}
                disabled={isCheckingPrinter}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1.5"
              >
                <Activity className={`w-3.5 h-3.5 text-slate-500 ${isCheckingPrinter ? "animate-spin" : ""}`} />
                <span>{isCheckingPrinter ? "Đang kiểm tra..." : "Kiểm tra kết nối"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTestPrinter(true)}
                disabled={isCheckingPrinter}
                className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-amber-600" />
                <span>In thử (Test Print)</span>
              </button>
            </div>

            {printerCheckMsg && (
              <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{printerCheckMsg}</span>
              </div>
            )}

            {printerHealth && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                  printerHealth.status === "ONLINE"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : printerHealth.status === "SIMULATED"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {printerHealth.status === "ONLINE" && "🟢 Máy in ONLINE (Sẵn sàng)"}
                    {printerHealth.status === "SIMULATED" && "🟡 Chế độ Mô phỏng (Dev Mode)"}
                    {printerHealth.status === "OFFLINE" && "🔴 Máy in OFFLINE (Mất kết nối)"}
                  </span>
                  {printerHealth.latencyMs >= 0 && (
                    <span className="font-mono text-[11px] opacity-75">
                      {printerHealth.latencyMs} ms
                    </span>
                  )}
                </div>
                <p className="opacity-90">{printerHealth.message}</p>
                {printerHealth.details && (
                  <div className="font-mono text-[10px] opacity-75 pt-1 border-t border-current/10 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Target: {printerHealth.details.target}</span>
                    <span>Mode: {printerHealth.details.mode}</span>
                    <span>Codepage: {printerHealth.details.codepage}</span>
                    <span>Khổ: {printerHealth.details.paperWidth}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20 active:scale-98 transition flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Đang lưu..." : "Lưu Cài Đặt"}</span>
        </button>
      </form>
    </div>
  );
}
