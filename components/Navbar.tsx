"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coffee,
  ShoppingCart,
  ChefHat,
  Grid,
  Package,
  Clock,
  UtensilsCrossed,
  BarChart3,
  Settings,
  ShieldCheck,
  User,
  LogOut,
} from "lucide-react";
import { useCartStore } from "@/lib/store/cart";
import { useLanguageStore, TranslationKey } from "@/lib/i18n";
import NetworkStatusChip from "@/components/pos/NetworkStatusChip";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const totalItems = useCartStore((state) => state.getTotalItems());
  const { language, toggleLanguage, t } = useLanguageStore();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
    // Lấy thông tin user hiện tại
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const json = await res.json();
          if (json.success) setCurrentUser(json.data);
        }
      } catch (e) {
        // Ignore
      }
    }
    loadUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const navLinks: { href: string; labelKey: TranslationKey; fallback: string; icon: any; requiresAdmin: boolean }[] = [
    { href: "/", labelKey: "nav.pos", fallback: "Bán hàng", icon: ShoppingCart, requiresAdmin: false },
    { href: "/kitchen", labelKey: "nav.kitchen", fallback: "Bếp / Bar", icon: ChefHat, requiresAdmin: false },
    { href: "/tables", labelKey: "nav.tables", fallback: "Bàn", icon: Grid, requiresAdmin: false },
    { href: "/inventory", labelKey: "nav.inventory", fallback: "Kho", icon: Package, requiresAdmin: false },
    { href: "/shifts", labelKey: "nav.shifts", fallback: "Ca bán", icon: Clock, requiresAdmin: false },
    { href: "/menu", labelKey: "nav.menu", fallback: "Menu", icon: UtensilsCrossed, requiresAdmin: true },
    { href: "/reports", labelKey: "nav.reports", fallback: "Báo cáo", icon: BarChart3, requiresAdmin: true },
    { href: "/settings", labelKey: "nav.settings", fallback: "Cài đặt", icon: Settings, requiresAdmin: true },
  ];

  const visibleNavLinks = navLinks.filter(
    (item) => !item.requiresAdmin || currentUser?.role === "admin"
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2 group shrink-0" aria-label="Trang chủ POS">
            <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-xs shadow-amber-600/20 group-hover:bg-amber-700 transition">
              <Coffee className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-base text-slate-800 tracking-tight block">
                {mounted ? t("nav.brand") : "POS Tea & Coffee"}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {mounted ? t("nav.subtitle") : "Hệ thống F&B"}
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Điều hướng chính" className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            {visibleNavLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const label = mounted ? t(item.labelKey) : item.fallback;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    isActive
                      ? "bg-amber-50 text-amber-800 shadow-xs ring-1 ring-amber-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-600" : "text-slate-500"}`} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info & Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Nút đổi ngôn ngữ song ngữ */}
            {mounted && (
              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={`Chuyển đổi ngôn ngữ, hiện tại: ${language === "vi" ? "Tiếng Việt" : "English"}`}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                {language === "vi" ? "🇻🇳 VI" : "🇬🇧 EN"}
              </button>
            )}

            {mounted && <NetworkStatusChip />}

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold border ${
                    currentUser.role === "admin"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {currentUser.role === "admin" ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden md:inline">{currentUser.name}</span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs"
              >
                Đăng nhập
              </Link>
            )}

            {/* Cart badge on mobile */}
            {mounted && totalItems > 0 && pathname !== "/checkout" && (
              <Link
                href="#cart-section"
                className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{totalItems}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
