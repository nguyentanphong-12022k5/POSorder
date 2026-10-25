"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { Grid, Utensils, CheckCircle, Plus, Eye, RefreshCw } from "lucide-react";

export default function TablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/tables");
      const json = await res.json();
      if (json.success) setTables(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleClearTable = async (table: any) => {
    try {
      await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: table.id, status: "EMPTY", orderId: null }),
      });
      fetchTables();
    } catch (e) {
      console.error(e);
    }
  };

  const occupiedCount = tables.filter((t) => t.status === "OCCUPIED").length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Grid className="w-5 h-5 text-amber-600" />
            Sơ Đồ Phòng & Quản Lý Bàn
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi trạng thái các bàn: Đang phục vụ khách ({occupiedCount}) • Đang trống ({tables.length - occupiedCount})
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTables}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold self-start sm:self-auto transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Đang tải danh sách bàn...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map((table) => {
            const isOccupied = table.status === "OCCUPIED";
            return (
              <div
                key={table.id}
                className={`p-5 rounded-2xl border text-center flex flex-col justify-between transition shadow-xs ${
                  isOccupied
                    ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div
                    className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-2.5 transition ${
                      isOccupied
                        ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Utensils className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900">{table.name}</h3>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold mt-1.5 ${
                      isOccupied
                        ? "bg-amber-200/80 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isOccupied ? "Đang có khách" : "Bàn trống"}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  {isOccupied ? (
                    <button
                      type="button"
                      onClick={() => handleClearTable(table)}
                      className="w-full py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Dọn bàn
                    </button>
                  ) : (
                    <a
                      href="/"
                      className="w-full py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Gọi món
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
