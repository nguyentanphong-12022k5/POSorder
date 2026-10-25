"use client";

import React, { useState, useEffect } from "react";
import { Product, Variant, Topping, CartItemTopping } from "@/types";
import { formatVND } from "@/lib/money";
import { useCartStore } from "@/lib/store/cart";
import { useLanguageStore } from "@/lib/i18n";
import { X, Plus, Minus, Check } from "lucide-react";

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { t } = useLanguageStore();

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<CartItemTopping[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (product) {
      // Mặc định chọn Size M (hoặc variant đầu tiên)
      const defaultVariant =
        product.variants.find((v) => v.name.includes("M")) ||
        product.variants[0] ||
        null;
      setSelectedVariant(defaultVariant);
      setSelectedToppings([]);
      setQuantity(1);
      setNote("");
    }
  }, [product]);

  // Phím tắt Escape đóng dialog
  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const basePrice = product.basePrice;
  const variantExtra = selectedVariant ? selectedVariant.extraPrice : 0;
  const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const singleCupPrice = basePrice + variantExtra + toppingsTotal;
  const totalPrice = singleCupPrice * quantity;

  const handleToggleTopping = (topping: Topping) => {
    if (selectedToppings.some((t) => t.id === topping.id)) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== topping.id));
    } else {
      setSelectedToppings([
        ...selectedToppings,
        { id: topping.id, name: topping.name, price: topping.price },
      ]);
    }
  };

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      variantExtra,
      toppings: selectedToppings,
      basePrice,
      quantity,
      note,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150 border border-slate-200">
        {/* Header Dialog */}
        <div className="relative border-b border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-12 h-12 rounded-2xl object-cover shadow-xs"
              />
            )}
            <div>
              <h3 id="product-modal-title" className="font-bold text-lg text-slate-900">
                {product.name}
              </h3>
              <p className="text-xs font-bold text-amber-600">
                {formatVND(product.basePrice)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng cửa sổ chọn món"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. Chọn Size (Variant) */}
          {product.variants.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                1. {t("pos.size")}
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      aria-pressed={isSelected}
                      className={`min-h-[48px] p-3 rounded-2xl border text-left transition select-none touch-manipulation flex flex-col justify-between active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        isSelected
                          ? "border-amber-600 bg-amber-50/70 text-amber-900 ring-2 ring-amber-600/30"
                          : "border-slate-200 active:border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{v.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-amber-600" />}
                      </div>
                      <span className="text-xs font-semibold text-slate-500 mt-1">
                        {v.extraPrice > 0 ? `+${formatVND(v.extraPrice)}` : "Chuẩn"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Chọn Topping - Nút to cảm ứng >= 44px */}
          {product.toppings.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                2. {t("pos.topping")}
              </label>
              <div className="space-y-2">
                {product.toppings.map(({ topping }) => {
                  const isChecked = selectedToppings.some((t) => t.id === topping.id);
                  return (
                    <label
                      key={topping.id}
                      className={`min-h-[48px] flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer select-none touch-manipulation transition active:scale-[0.99] focus-within:ring-2 focus-within:ring-amber-500 ${
                        isChecked
                          ? "border-amber-500 bg-amber-50/50 text-amber-900"
                          : "border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTopping(topping)}
                          className="w-5 h-5 rounded-md text-amber-600 accent-amber-600 cursor-pointer"
                        />
                        <span className="text-sm font-bold text-slate-800">{topping.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        +{formatVND(topping.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Ghi chú yêu cầu */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5">
              3. {t("pos.note")}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pos.notePlaceholder")}
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-slate-900 placeholder:text-slate-500 font-medium transition"
            />
          </div>

          {/* 4. Chọn số lượng */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-slate-800">{t("pos.quantity")}:</span>
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                aria-label="Giảm số lượng"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-2xs active:bg-slate-200 disabled:opacity-40 transition select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold text-slate-900 text-lg select-none">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                onClick={() => setQuantity(quantity + 1)}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white flex items-center justify-center text-slate-700 shadow-2xs active:bg-slate-200 transition select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions - Touch Target >= 48px */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">{t("pos.total")}</span>
            <span className="text-xl font-black text-amber-600">{formatVND(totalPrice)}</span>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            className="min-h-[48px] px-6 py-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md shadow-amber-600/20 transition flex items-center gap-2 select-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("pos.addToCart")} ({quantity})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
