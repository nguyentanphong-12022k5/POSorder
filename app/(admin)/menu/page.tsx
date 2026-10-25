"use client";

import React, { useState, useEffect } from "react";
import { formatVND } from "@/lib/money";
import { useToast } from "@/components/ui/ToastProvider";
import { ProductSchema, formatZodError } from "@/lib/validations/schemas";
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

export default function AdminMenuPage() {
  const { showError, showSuccess } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New product form
  const [newName, setNewName] = useState<string>("");
  const [newCategoryId, setNewCategoryId] = useState<string>("");
  const [newBasePrice, setNewBasePrice] = useState<string>("");
  const [newImageUrl, setNewImageUrl] = useState<string>("");

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/products");
      const json = await res.json();
      if (json.success) {
        setProducts(json.data.products);
        setCategories(json.data.categories);
        if (json.data.categories.length > 0 && !newCategoryId) {
          setNewCategoryId(json.data.categories[0].id);
        }
      }
    } catch (e) {
      console.error("Lỗi tải menu:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (product: any) => {
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          isActive: !product.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts(
          products.map((p) =>
            p.id === product.id ? { ...p, isActive: !product.isActive } : p
          )
        );
      }
    } catch (e) {
      console.error("Lỗi cập nhật trạng thái:", e);
    }
  };

  const handleStartEdit = (product: any) => {
    setEditingProduct(product);
    setEditPrice(product.basePrice.toString());
    setEditName(product.name);
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProduct.id,
          name: editName,
          basePrice: parseInt(editPrice, 10),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts(
          products.map((p) =>
            p.id === editingProduct.id
              ? { ...p, name: editName, basePrice: parseInt(editPrice, 10) }
              : p
          )
        );
        setEditingProduct(null);
      }
    } catch (e) {
      console.error("Lỗi lưu sản phẩm:", e);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Client Zod Validation
    const parsedPrice = parseInt(newBasePrice.replace(/\D/g, ""), 10) || 0;
    const clientValidation = ProductSchema.safeParse({
      name: newName.trim(),
      categoryId: newCategoryId,
      basePrice: parsedPrice,
      imageUrl: newImageUrl?.trim() || null,
      isActive: true,
    });

    if (!clientValidation.success) {
      const { firstMessage } = formatZodError(clientValidation.error);
      showError(firstMessage, "Thông tin món chưa hợp lệ");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientValidation.data),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || "Không thể tạo món mới");
      }

      showSuccess(`Đã thêm món "${data.data?.name}" thành công!`, "Thực đơn đã cập nhật");
      setShowAddModal(false);
      setNewName("");
      setNewBasePrice("");
      setNewImageUrl("");
      fetchData();
    } catch (err: any) {
      console.error("Lỗi tạo món:", err);
      showError(err, "Thêm món thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            Quản lý Thực Đơn Món (Menu Admin)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Thêm mới, đổi giá món, hoặc tạm ngưng phục vụ. Thay đổi giá món không làm ảnh hưởng đến các hóa đơn cũ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm món mới</span>
        </button>
      </div>

      {/* Product List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold">
                <th className="py-3 px-4">Ảnh</th>
                <th className="py-3 px-4">Tên món</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4">Giá gốc (VNĐ)</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Đang tải danh mục món...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Chưa có món nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const isEditing = editingProduct?.id === product.id;
                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/70 transition ${
                        !product.isActive ? "bg-slate-50/40 opacity-70" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-xl object-cover shadow-xs border border-slate-100"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 text-sm w-full max-w-[200px]"
                          />
                        ) : (
                          <div>
                            <span>{product.name}</span>
                            <div className="text-[11px] text-slate-400 font-normal">
                              {product.variants?.map((v: any) => v.name).join(", ")}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                          {product.category?.name || "Khác"}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-amber-600">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 text-sm w-28"
                          />
                        ) : (
                          formatVND(product.basePrice)
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                            product.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {product.isActive ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Đang bán
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Tạm ngưng
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                              title="Lưu"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProduct(null)}
                              className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition"
                              title="Hủy"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(product)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-slate-100 transition"
                            title="Sửa tên / giá"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm món mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">Thêm đồ uống mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Trà đào cam sả"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Danh mục *
                </label>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giá gốc (VNĐ) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(e.target.value)}
                  placeholder="Ví dụ: 30000"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Link ảnh thumbnail (URL)
                </label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 ${
                    isSubmitting
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-700 active:scale-98"
                  }`}
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? "Đang lưu..." : "Lưu món"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
