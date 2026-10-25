"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCartStore } from "@/lib/store/cart";
import { formatVND } from "@/lib/money";
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useLanguageStore } from "@/lib/i18n";

export default function CartPanel() {
  const { items, updateQuantity, removeItem, clearCart, getSubtotal, getTotalItems } =
    useCartStore();
  const { t } = useLanguageStore();
  const [mounted, setMounted] = useState(false);
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center justify-center h-full min-h-[300px]">
        <div className="animate-pulse text-slate-500 font-medium text-sm">
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const totalCount = getTotalItems();

  const handleFocusSearch = () => {
    const searchInput = document.getElementById("pos-search-input") as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
    }
  };

  return (
    <div
      id="cart-section"
      className="bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col h-full overflow-hidden"
    >
      {/* 1. Header Giỏ hàng */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              {t("pos.cartTitle")}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {totalCount} {t("pos.itemsSelected")}
            </span>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            aria-label="Xóa tất cả món trong giỏ hàng"
            onClick={() => setShowClearConfirmDialog(true)}
            className="text-xs px-3 py-1.5 rounded-xl font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 active:scale-95 transition flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t("pos.clearCart")}</span>
          </button>
        )}
      </div>

      {/* 2. Danh sách sản phẩm trong giỏ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={ShoppingBag}
              title={t("pos.emptyCartTitle")}
              description={t("pos.emptyCartDesc")}
              actionLabel={t("pos.selectItemCta")}
              onAction={handleFocusSearch}
              className="border-none shadow-none p-4"
            />
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition space-y-2 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm leading-tight">
                      {item.name}
                    </span>
                    {item.variantName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                        {item.variantName}
                      </span>
                    )}
                  </div>

                  {/* Toppings list */}
                  {item.toppings && item.toppings.length > 0 && (
                    <div className="text-[11px] text-slate-500 mt-1 space-x-1">
                      {item.toppings.map((t, idx) => (
                        <span key={t.id || idx} className="inline-block font-medium">
                          +{t.name}
                          {idx < item.toppings.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ghi chú */}
                  {item.note && (
                    <p className="text-[11px] italic text-amber-800/90 mt-1">
                      "{item.note}"
                    </p>
                  )}
                </div>

                {/* Nút xoá món cảm ứng >= 44px */}
                <button
                  type="button"
                  aria-label={`Xóa ${item.name} khỏi giỏ`}
                  onClick={() => removeItem(item.id)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 active:text-red-700 active:bg-red-50 rounded-xl transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Dòng điều khiển số lượng & thành tiền */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-black text-sm text-slate-900">
                  {formatVND(item.lineTotal)}
                </span>

                <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    aria-label={`Giảm số lượng ${item.name}`}
                    onClick={() => updateQuantity(item.id, -1)}
                    className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-bold text-sm text-slate-900 select-none">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Tăng số lượng ${item.name}`}
                    onClick={() => updateQuantity(item.id, 1)}
                    className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 flex items-center justify-center transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Footer Thanh toán */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600 font-medium">
            <span>{t("pos.subtotal")}</span>
            <span className="font-semibold text-slate-800">{formatVND(subtotal)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>{t("pos.total")}</span>
            <span className="text-amber-600 text-lg font-black">{formatVND(subtotal)}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <button
            type="button"
            disabled
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-slate-200 text-slate-400 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>{t("pos.checkoutBtn")}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href="/checkout"
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 active:scale-98 transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            <span>{t("pos.checkoutBtn")} ({totalCount})</span>
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-700/60 text-amber-100 border border-amber-500/40">
              F2
            </kbd>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Confirm Dialog Xoá Giỏ Hàng (Destructive action) */}
      <ConfirmDialog
        isOpen={showClearConfirmDialog}
        onClose={() => setShowClearConfirmDialog(false)}
        onConfirm={() => {
          clearCart();
          setShowClearConfirmDialog(false);
        }}
        title={t("pos.confirmClearCartTitle")}
        description={t("pos.confirmClearCartDesc")}
        confirmLabel={t("pos.confirmClear")}
        cancelLabel={t("pos.keepCart")}
        isDanger={true}
      />
    </div>
  );
}
