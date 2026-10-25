"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, Lock, Mail, ShieldCheck, User, ArrowRight, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Đăng nhập thất bại");
      }

      window.location.href = fromUrl;
    } catch (err: any) {
      setErrorMsg(err.message || "Tài khoản hoặc mật khẩu không chính xác");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl w-full max-w-md p-8 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-amber-600 flex items-center justify-center text-white mx-auto shadow-md shadow-amber-600/20">
          <Coffee className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          Đăng Nhập POS Order
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Hệ thống quản lý bán hàng & pha chế đồ uống
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Login */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Email đăng nhập *
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pos.vn hoặc staff@pos.vn"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Mật khẩu *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md transition flex items-center justify-center gap-2 ${
            isLoading
              ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
              : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 active:scale-98"
          }`}
        >
          <span>{isLoading ? "Đang xác thực..." : "Đăng Nhập"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Nút đăng nhập mẫu 1-click */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-wide">
          Tài khoản mẫu thử nghiệm
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("admin@pos.vn", "admin123")}
            className="p-2.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/70 text-purple-900 text-left transition flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <span className="font-bold text-xs block">Admin</span>
              <span className="text-[10px] text-purple-600">Toàn quyền</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin("staff@pos.vn", "staff123")}
            className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 text-left transition flex items-center gap-2"
          >
            <User className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-xs block">Thu ngân</span>
              <span className="text-[10px] text-emerald-600">Chỉ bán hàng</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Đang tải trang đăng nhập...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
