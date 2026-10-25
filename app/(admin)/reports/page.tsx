"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatVND } from "@/lib/money";
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  AlertOctagon,
  Calendar,
  Download,
  RefreshCw,
  Award,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Clock,
  Receipt,
  ExternalLink,
  Flame,
  PieChart as PieIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function AdminReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<string>("today"); // today, yesterday, 7days, month, custom
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Dữ liệu API báo cáo
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Tab xếp hạng Top 10: "quantity" hoặc "revenue"
  const [topSortTab, setTopSortTab] = useState<"quantity" | "revenue">("quantity");

  // Tab xem biểu đồ giờ: "revenue" hoặc "orders"
  const [hourlyViewMode, setHourlyViewMode] = useState<"revenue" | "orders">("revenue");

  // Phân trang & lọc trạng thái cho bảng đơn hàng
  const [tableStatus, setTableStatus] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchReports = async (targetPage = page) => {
    try {
      setIsLoading(true);
      let url = `/api/reports?period=${period}&page=${targetPage}&pageSize=${pageSize}&status=${tableStatus}`;
      if (period === "custom") {
        url += `&from=${customFrom}&to=${customTo}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setReportData(json.data);
      }
    } catch (e) {
      console.error("Lỗi khi tải dữ liệu báo cáo:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchReports(1);
  }, [period, tableStatus, pageSize]);

  useEffect(() => {
    fetchReports(page);
  }, [page]);

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (period !== "custom") setPeriod("custom");
    setPage(1);
    fetchReports(1);
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    let url = `/api/reports?period=${period}&status=${tableStatus}&export=csv`;
    if (period === "custom") {
      url += `&from=${customFrom}&to=${customTo}`;
    }
    // Kích hoạt tải file bằng anchor link
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bao_cao_don_hang_${period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setIsExporting(false), 1200);
  };

  const periodsList = [
    { id: "today", label: "Hôm nay" },
    { id: "yesterday", label: "Hôm qua" },
    { id: "7days", label: "7 ngày qua" },
    { id: "month", label: "Tháng này" },
    { id: "custom", label: "Tùy chọn ngày" },
  ];

  const kpi = reportData?.kpi || {
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    totalCustomers: 0,
    totalCancelledOrders: 0,
    cancelRate: 0,
  };

  const hourlyList = reportData?.hourlyStats?.stats || [];
  const peakHour = reportData?.hourlyStats?.peakHour;
  const peakRevenue = reportData?.hourlyStats?.peakRevenue || 0;

  const paymentList = reportData?.paymentDistribution || [];
  const topList =
    topSortTab === "quantity"
      ? reportData?.topSelling?.byQuantity || []
      : reportData?.topSelling?.byRevenue || [];

  const orders = reportData?.ordersList?.orders || [];
  const pagination = reportData?.ordersList?.pagination || {
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Bộ lọc thời gian */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-600" />
              Báo Cáo Doanh Thu & Hiệu Quả Bán Hàng
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Dữ liệu tổng hợp tức thì từ hệ thống POS, hỗ trợ phân tích khung giờ cao điểm và món bán chạy.
            </p>
          </div>

          {/* Nút Xuất CSV & Làm mới */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? "Đang xuất file..." : "Xuất file CSV"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReports(page)}
              disabled={isLoading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Danh sách nút chọn khoảng thời gian */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {periodsList.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === p.id
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Bộ chọn ngày tùy chỉnh (Hiện khi chọn "Tùy chọn ngày") */}
          {period === "custom" && (
            <form
              onSubmit={handleApplyCustomRange}
              className="flex items-center gap-2 bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl text-xs"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-semibold text-slate-700">Từ:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium"
              />
              <span className="font-semibold text-slate-700">Đến:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition ml-1"
              >
                Áp dụng
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 2. KPI Cards Grid (5 Chỉ số quan trọng) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Doanh thu */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              Doanh Thu
            </span>
            <span className="text-lg font-extrabold text-slate-900 leading-tight">
              {isLoading ? "..." : formatVND(kpi.totalRevenue)}
            </span>
          </div>
        </div>

        {/* KPI 2: Số đơn hoàn tất */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              Số Đơn Hoàn Tất
            </span>
            <span className="text-lg font-extrabold text-slate-900 leading-tight">
              {isLoading ? "..." : `${kpi.totalOrders} đơn`}
            </span>
          </div>
        </div>

        {/* KPI 3: Giá trị TB / đơn */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              TB / Đơn Hàng
            </span>
            <span className="text-lg font-extrabold text-slate-900 leading-tight">
              {isLoading ? "..." : formatVND(kpi.averageOrderValue)}
            </span>
          </div>
        </div>

        {/* KPI 4: Số lượng khách */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              Số Lượng Khách
            </span>
            <span className="text-lg font-extrabold text-slate-900 leading-tight">
              {isLoading ? "..." : `${kpi.totalCustomers} khách`}
            </span>
          </div>
        </div>

        {/* KPI 5: Tỉ lệ hủy đơn */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              kpi.cancelRate > 10
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              Tỉ Lệ Hủy Đơn
            </span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-lg font-extrabold leading-tight ${
                  kpi.cancelRate > 10 ? "text-rose-600" : "text-slate-900"
                }`}
              >
                {isLoading ? "..." : `${kpi.cancelRate}%`}
              </span>
              <span className="text-[11px] text-slate-400">
                ({kpi.totalCancelledOrders} đơn)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Charts Section (Biểu đồ theo giờ & Phân bổ thanh toán) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3.1. Biểu đồ doanh thu & đơn hàng theo giờ (2 Cột) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Biểu Đồ Doanh Thu & Đơn Hàng Theo Khung Giờ
              </h2>
              {peakHour && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold mt-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                  <span>
                    Khung giờ cao điểm: <strong>{peakHour}</strong> ({formatVND(peakRevenue)})
                  </span>
                </div>
              )}
            </div>

            {/* Chuyển đổi xem Doanh thu hoặc Số đơn */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setHourlyViewMode("revenue")}
                className={`px-3 py-1 rounded-md transition ${
                  hourlyViewMode === "revenue"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Doanh thu (₫)
              </button>
              <button
                type="button"
                onClick={() => setHourlyViewMode("orders")}
                className={`px-3 py-1 rounded-md transition ${
                  hourlyViewMode === "orders"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Số đơn
              </button>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="w-full h-72">
            {mounted && hourlyList.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyList} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="hourLabel"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) =>
                      hourlyViewMode === "revenue"
                        ? val >= 1000000
                          ? `${(val / 1000000).toFixed(1)}M`
                          : val >= 1000
                          ? `${val / 1000}k`
                          : val
                        : `${val}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(245, 158, 11, 0.08)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-lg space-y-1">
                            <p className="font-bold text-amber-400">
                              Khung giờ: {d.hourLabel} - {d.hour}:59
                            </p>
                            <p>Doanh thu: {formatVND(d.revenue)}</p>
                            <p>Số đơn: {d.orderCount} đơn</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey={hourlyViewMode === "revenue" ? "revenue" : "orderCount"}
                    fill={hourlyViewMode === "revenue" ? "#d97706" : "#2563eb"}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                Đang chuẩn bị biểu đồ...
              </div>
            )}
          </div>
        </div>

        {/* 3.2. Biểu đồ phân bổ phương thức thanh toán (1 Cột) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-600" />
              Phân Bổ Phương Thức Thanh Toán
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Tỷ trọng tiền mặt vs chuyển khoản</p>
          </div>

          <div className="w-full h-52 flex items-center justify-center">
            {mounted && paymentList.length > 0 && kpi.totalRevenue > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentList}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="revenue"
                  >
                    {paymentList.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-lg space-y-1">
                            <p className="font-bold text-emerald-400">{d.name}</p>
                            <p>Doanh thu: {formatVND(d.revenue)}</p>
                            <p>Tỷ lệ: {d.percentage}% ({d.orderCount} đơn)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 text-center py-8">
                {kpi.totalRevenue === 0 ? "Chưa có doanh thu trong kỳ" : "Đang tải biểu đồ..."}
              </div>
            )}
          </div>

          {/* Chi tiết từng phương thức */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            {paymentList.map((p: any) => (
              <div
                key={p.method}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-semibold text-slate-800">{p.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{formatVND(p.revenue)}</span>
                  <span className="text-[11px] text-slate-500">
                    {p.percentage}% ({p.orderCount} đơn)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Top 10 Món Bán Chạy (Theo số lượng & Theo doanh thu) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              Top 10 Đồ Uống Bán Chạy Nhất
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Xếp hạng món dựa trên dữ liệu các hóa đơn hoàn tất trong kỳ
            </p>
          </div>

          {/* Tabs chuyển đổi tiêu chí xếp hạng */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTopSortTab("quantity")}
              className={`px-3 py-1.5 rounded-md transition ${
                topSortTab === "quantity"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Theo Số Lượng (Ly)
            </button>
            <button
              type="button"
              onClick={() => setTopSortTab("revenue")}
              className={`px-3 py-1.5 rounded-md transition ${
                topSortTab === "revenue"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Theo Doanh Thu (₫)
            </button>
          </div>
        </div>

        {/* Danh sách Top 10 */}
        {topList.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Chưa có dữ liệu món bán chạy trong khoảng thời gian này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {topList.map((item: any) => {
              const isTop1 = item.rank === 1;
              const isTop2 = item.rank === 2;
              const isTop3 = item.rank === 3;

              return (
                <div
                  key={item.name}
                  className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        isTop1
                          ? "bg-amber-500 text-white shadow-xs"
                          : isTop2
                          ? "bg-slate-300 text-slate-800"
                          : isTop3
                          ? "bg-amber-700/60 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      #{item.rank}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {item.quantity} ly
                        </span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] text-amber-600 font-bold">
                          {formatVND(item.revenue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Phần trăm đóng góp doanh thu */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-700">
                      {item.percentageOfRevenue}%
                    </span>
                    <span className="text-[10px] text-slate-400 block">tổng doanh số</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Bảng chi tiết từng đơn hàng & Phân trang */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              Chi Tiết Từng Hóa Đơn ({pagination.totalCount} đơn)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Toàn bộ lịch sử giao dịch đã được phân trang và lọc server-side
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc trạng thái đơn */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTableStatus("ALL")}
                className={`px-3 py-1 rounded-md transition ${
                  tableStatus === "ALL"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setTableStatus("PAID")}
                className={`px-3 py-1 rounded-md transition ${
                  tableStatus === "PAID"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hoàn tất
              </button>
              <button
                type="button"
                onClick={() => setTableStatus("CANCELLED")}
                className={`px-3 py-1 rounded-md transition ${
                  tableStatus === "CANCELLED"
                    ? "bg-white text-rose-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Đã hủy
              </button>
            </div>

            {/* Chọn số dòng hiển thị */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white"
            >
              <option value={10}>10 dòng/trang</option>
              <option value={20}>20 dòng/trang</option>
              <option value={50}>50 dòng/trang</option>
            </select>
          </div>
        </div>

        {/* Table data */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold">
                <th className="py-3 px-3.5">Mã đơn</th>
                <th className="py-3 px-3.5">Thời gian</th>
                <th className="py-3 px-3.5">Loại & Bàn</th>
                <th className="py-3 px-3.5">Khách hàng</th>
                <th className="py-3 px-3.5">Món & Topping</th>
                <th className="py-3 px-3.5">Phương thức</th>
                <th className="py-3 px-3.5">Trạng thái</th>
                <th className="py-3 px-3.5 text-right">Tổng tiền</th>
                <th className="py-3 px-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Đang tải dữ liệu danh sách đơn hàng...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không có đơn hàng nào khớp với điều kiện lọc.
                  </td>
                </tr>
              ) : (
                orders.map((ord: any) => {
                  const dateStr = new Date(ord.createdAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });

                  const isCancelled = ord.status === "CANCELLED";

                  return (
                    <tr
                      key={ord.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isCancelled ? "bg-rose-50/30 opacity-75 line-through-text" : ""
                      }`}
                    >
                      <td className="py-3 px-3.5 font-bold text-amber-700 whitespace-nowrap">
                        {ord.code}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            ord.orderType === "DINE_IN"
                              ? "bg-sky-50 text-sky-700 border border-sky-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ord.orderType === "DINE_IN"
                            ? `Tại bàn (${ord.tableNumber || "-"})`
                            : "Mang đi"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                        {ord.customerPhone ? (
                          <div>
                            <span className="font-semibold block">{ord.customerName || "Khách"}</span>
                            <span className="text-[10px] text-slate-400">{ord.customerPhone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Khách vãng lai</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 max-w-xs">
                        <span className="line-clamp-1">
                          {ord.items
                            ?.map((it: any) => `${it.quantity}x ${it.name}`)
                            .join(", ")}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            ord.paymentMethod === "TRANSFER"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {ord.paymentMethod === "TRANSFER" ? "QR Chuyển khoản" : "Tiền mặt"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[11px]">
                            <XCircle className="w-3 h-3" />
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Hoàn tất
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-3.5 font-bold text-right whitespace-nowrap ${
                          isCancelled ? "text-slate-400 line-through" : "text-slate-900"
                        }`}
                      >
                        {formatVND(ord.total)}
                      </td>
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <Link
                          href={`/orders/${ord.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-600 hover:text-white text-slate-700 text-xs font-semibold transition"
                        >
                          <span>Bill</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang (Pagination footer) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <div>
            Hiển thị trang <strong>{pagination.page}</strong> /{" "}
            <strong>{pagination.totalPages}</strong> (Tổng {pagination.totalCount} đơn)
          </div>

          <div className="flex items-center gap-1.5 self-center sm:self-auto">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={pagination.page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Trước</span>
            </button>

            <span className="px-2 font-bold text-slate-800">
              {pagination.page} / {pagination.totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <span>Sau</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
