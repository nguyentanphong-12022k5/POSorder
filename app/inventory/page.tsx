"use client";

import React, { useState, useEffect } from "react";
import { formatVND } from "@/lib/money";
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  RefreshCw,
  X,
} from "lucide-react";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Nhập kho nhanh
  const [importModalItem, setImportModalItem] = useState<any | null>(null);
  const [addQty, setAddQty] = useState<string>("");

  // Modal Thêm nguyên liệu mới
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [newQty, setNewQty] = useState("");
  const [newMinQty, setNewMinQty] = useState("10");
  const [newCostPrice, setNewCostPrice] = useState("0");

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/inventory");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleImportStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importModalItem || !addQty) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: importModalItem.id,
          addQuantity: parseFloat(addQty),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setImportModalItem(null);
        setAddQty("");
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          unit: newUnit,
          quantity: newQty,
          minQuantity: newMinQty,
          costPrice: newCostPrice,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setNewName("");
        setNewQty("");
        fetchInventory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const lowStockItems = items.filter((it) => it.quantity <= it.minQuantity);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            Quản Lý Tồn Kho Nguyên Vật Liệu (Inventory)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kiểm soát nguyên liệu pha chế, cảnh báo khi tồn kho dưới ngưỡng an toàn.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchInventory}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Tải lại"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nguyên liệu</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo nguyên liệu sắp hết */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Có {lowStockItems.length} nguyên vật liệu sắp hết hàng!</p>
            <p className="text-amber-800">
              Các mặt hàng cần nhập thêm gấp:{" "}
              <strong>{lowStockItems.map((it) => `${it.name} (${it.quantity} ${it.unit})`).join(", ")}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Table Inventory */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase">
                <th className="py-3 px-4">Tên nguyên liệu</th>
                <th className="py-3 px-4">Đơn vị</th>
                <th className="py-3 px-4">Số lượng tồn</th>
                <th className="py-3 px-4">Định mức tối thiểu</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Đang tải kho nguyên liệu...</td>
                </tr>
              ) : (
                items.map((item) => {
                  const isLow = item.quantity <= item.minQuantity;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800 text-sm">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{item.unit}</td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-black ${isLow ? "text-red-600" : "text-slate-900"}`}>
                          {item.quantity.toLocaleString("vi-VN")} {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.minQuantity.toLocaleString("vi-VN")} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isLow
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isLow ? "Sắp hết hàng" : "Đủ nguyên liệu"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setImportModalItem(item)}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Nhập thêm
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nhập thêm kho */}
      {importModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleImportStock} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Nhập Thêm Kho: {importModalItem.name}
            </h3>

            <p className="text-xs text-slate-500">
              Hiện có: <strong>{importModalItem.quantity} {importModalItem.unit}</strong>
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Số lượng nhập thêm ({importModalItem.unit}) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="Ví dụ: 1000"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportModalItem(null)}
                className="w-1/2 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 rounded-xl text-white font-bold text-xs bg-amber-600 hover:bg-amber-700"
              >
                Lưu nhập kho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Thêm nguyên liệu mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form onSubmit={handleCreateItem} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Thêm Nguyên Liệu Mới</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên nguyên liệu *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ví dụ: Siro Dâu Torani"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị tính *</label>
                <input
                  type="text"
                  required
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="g, ml, chai, lon..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng ban đầu</label>
                <input
                  type="number"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-1/2 py-2 rounded-xl text-slate-600 font-semibold text-xs bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="w-1/2 py-2 rounded-xl text-white font-bold text-xs bg-amber-600 hover:bg-amber-700"
              >
                Tạo nguyên liệu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
