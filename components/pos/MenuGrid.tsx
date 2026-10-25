"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Category, Product } from "@/types";
import { formatVND } from "@/lib/money";
import { Search, Plus, Sparkles, X, Coffee } from "lucide-react";
import ProductModal from "./ProductModal";
import { cacheMenuOffline, getCachedMenuOffline } from "@/lib/offline/db";
import { ProductGridSkeleton, CategoryPillSkeleton } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useCartStore } from "@/lib/store/cart";
import { useLanguageStore } from "@/lib/i18n";

interface MenuGridProps {
  categories: Category[];
}

export default function MenuGrid({ categories: initialCategories }: MenuGridProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartTotalItems = useCartStore((state) => state.getTotalItems());
  const { t } = useLanguageStore();

  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialCategories || initialCategories.length === 0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Lưu cache menu khi có dữ liệu mới, hoặc nạp từ cache offline nếu ban đầu rỗng
  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      setIsLoading(false);
      cacheMenuOffline(initialCategories).catch(() => {});
    } else {
      setIsLoading(true);
      getCachedMenuOffline().then((cached) => {
        if (cached && cached.length > 0) {
          setCategories(cached);
        }
        setIsLoading(false);
      });
    }
  }, [initialCategories]);

  // Thu thập tất cả các món từ các danh mục
  const allProducts: Product[] = categories.flatMap((cat) => cat.products || []);

  // Lọc sản phẩm theo Category và từ khoá tìm kiếm
  const filteredProducts = allProducts.filter((product) => {
    const matchCategory =
      selectedCategoryId === "ALL" || product.categoryId === selectedCategoryId;
    const matchSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim());
    return matchCategory && matchSearch;
  });

  // 3. Phím tắt POS Desktop: / focus search, Escape clear/blur, Enter chọn món, F2 thanh toán
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // Phím '/' focus vào ô tìm kiếm (trừ khi đang gõ chữ trong input khác)
      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Phím 'Escape': Nếu đang gõ tìm kiếm thì xóa tìm kiếm & blur
      if (e.key === "Escape") {
        if (selectedProduct) {
          setSelectedProduct(null);
        } else if (searchQuery) {
          setSearchQuery("");
          searchInputRef.current?.blur();
        }
        return;
      }

      // Phím 'F2': Thanh toán nhanh nếu giỏ hàng có món
      if (e.key === "F2") {
        e.preventDefault();
        if (cartTotalItems > 0) {
          router.push("/checkout");
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedProduct, searchQuery, cartTotalItems, router]);

  // Xử lý khi nhấn Enter trong ô tìm kiếm
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredProducts.length > 0) {
      e.preventDefault();
      // Mở modal cho sản phẩm đầu tiên tìm thấy
      setSelectedProduct(filteredProducts[0]);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Thanh tìm kiếm và Tabs danh mục */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Search input with keyboard hint */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="pos-search-input"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t("pos.searchPlaceholder")}
            aria-label={t("pos.searchPlaceholder")}
            className="w-full pl-10 pr-20 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-slate-900 placeholder:text-slate-500 font-medium transition"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Xóa nội dung tìm kiếm"
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-500 shadow-2xs select-none">
              /
            </kbd>
          </div>
        </div>

        {/* Category Pills - Touch Target >= 44px */}
        {isLoading ? (
          <CategoryPillSkeleton count={5} />
        ) : (
          <div
            role="tablist"
            aria-label="Danh mục đồ uống"
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === "ALL"}
              onClick={() => setSelectedCategoryId("ALL")}
              className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition select-none flex items-center gap-1.5 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                selectedCategoryId === "ALL"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t("pos.allProducts")}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedCategoryId === "ALL" ? "bg-amber-700/60 text-white" : "bg-slate-200 text-slate-700"
              }`}>
                {allProducts.length}
              </span>
            </button>

            {categories.map((cat) => {
              const count = (cat.products || []).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  type="button"
                  role="tab"
                  key={cat.id}
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition select-none flex items-center gap-1.5 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    isSelected
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isSelected ? "bg-amber-700/60 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Grid các thẻ sản phẩm hoặc Loading Skeleton hoặc Empty State */}
      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title={t("pos.noProducts")}
          description={t("pos.noProductsDesc")}
          actionLabel={t("pos.clearFilter")}
          onAction={() => {
            setSearchQuery("");
            setSelectedCategoryId("ALL");
            searchInputRef.current?.focus();
          }}
          className="my-auto py-16"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 overflow-y-auto pr-1">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              role="button"
              tabIndex={0}
              aria-label={`Chọn đồ uống ${product.name}, giá ${formatVND(product.basePrice)}`}
              onClick={() => setSelectedProduct(product)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedProduct(product);
                }
              }}
              className="group bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:border-amber-400 active:border-amber-500 active:scale-[0.98] transition cursor-pointer flex flex-col justify-between touch-manipulation select-none min-h-[140px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {/* Product Thumbnail */}
              <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                    Không có ảnh
                  </div>
                )}
                {/* Badge số variant */}
                {product.variants.length > 0 && (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white shadow-xs">
                    {product.variants.length} Size (S/M/L)
                  </span>
                )}
              </div>

              {/* Product Details */}
              <div className="p-3.5 flex flex-col justify-between flex-1">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug group-hover:text-amber-700 transition">
                    {product.name}
                  </h4>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                  <span className="font-black text-amber-600 text-sm">
                    {formatVND(product.basePrice)}
                  </span>
                  <div
                    aria-hidden="true"
                    className="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center transition shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog Chọn Size & Topping */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
