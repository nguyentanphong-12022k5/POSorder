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
  Upload,
  Trash2,
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
  const [editImageUrl, setEditImageUrl] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
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
    setEditImageUrl(product.imageUrl || "");
    setEditCategoryId(product.categoryId || (categories[0]?.id || ""));
  };

  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError("Dung lượng ảnh tối đa 2MB!", "Ảnh quá lớn");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (isEdit) {
        setEditImageUrl(base64);
      } else {
        setNewImageUrl(base64);
      }
      showSuccess("Đã tải ảnh lên thành công!", "Hình ảnh");
    };
    reader.readAsDataURL(file);
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
          imageUrl: editImageUrl || null,
          categoryId: editCategoryId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Đã cập nhật thông tin món thành công!");
        fetchData();
        setEditingProduct(null);
      } else {
        showError(data.message || "Lỗi cập nhật món");
      }
    } catch (e) {
      console.error("Lỗi lưu sản phẩm:", e);
      showError("Lỗi hệ thống khi lưu sản phẩm");
    }
  };

  const handleDeleteProduct = async (product: any) => {
    if (!confirm(`Bạn có chắc chắn muốn xoá món "${product.name}" khỏi menu?`)) return;
    try {
      const res = await fetch(`/api/products?id=${product.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showSuccess("Đã xoá món khỏi thực đơn!");
        if (editingProduct?.id === product.id) setEditingProduct(null);
        fetchData();
      } else {
        showError(data.message || "Không thể xoá món");
      }
    } catch (e) {
      console.error(e);
      showError("Lỗi hệ thống khi xoá món");
    }
  };
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
                        <div>
                          <span>{product.name}</span>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {product.variants?.map((v: any) => v.name).join(", ")}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                          {product.category?.name || "Khác"}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-amber-600">
                        {formatVND(product.basePrice)}
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(product)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-slate-100 transition"
                            title="Chỉnh sửa thông tin món"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Xoá món"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chỉnh sửa thông tin món */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                Chỉnh sửa món đồ uống
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Danh mục *
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
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
                    Giá bán (VNĐ) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ảnh món (Link URL hoặc chọn từ máy)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="Dán link ảnh https://... hoặc tải từ máy"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      Chọn file ảnh từ máy tính
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileUpload(e, true)}
                      />
                    </label>

                    {editImageUrl && (
                      <img
                        src={editImageUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct)}
                  className="px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Xoá món
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-semibold text-xs hover:bg-slate-100 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-white font-bold text-xs bg-amber-600 hover:bg-amber-700 shadow-xs transition"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Link ảnh thumbnail (URL hoặc tải từ máy)
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="https://... hoặc bấm nút dưới để chọn file"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                      <Upload className="w-3.5 h-3.5 text-amber-600" />
                      Chọn file ảnh từ máy tính
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileUpload(e, false)}
                      />
                    </label>

                    {newImageUrl && (
                      <img
                        src={newImageUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                      />
                    )}
                  </div>
                </div>
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
