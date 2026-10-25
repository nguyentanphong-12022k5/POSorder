import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/reports/route";

describe("Nâng cấp Module Báo cáo /admin/reports & API /api/reports", () => {
  const shopId = "shop_default";

  beforeEach(async () => {
    // Đảm bảo có ít nhất 1 ca và dữ liệu mẫu nếu cần
  });

  it("1. GET /api/reports: Trả về đầy đủ KPI, hourlyStats, paymentDistribution, topSelling, ordersList", async () => {
    const req = new NextRequest("http://localhost:3000/api/reports?period=month", {
      headers: { "x-user-shop-id": shopId },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();

    // 1. Kiểm tra cấu trúc KPI cards
    const kpi = json.data.kpi;
    expect(kpi).toBeDefined();
    expect(typeof kpi.totalRevenue).toBe("number");
    expect(typeof kpi.totalOrders).toBe("number");
    expect(typeof kpi.averageOrderValue).toBe("number");
    expect(typeof kpi.totalCustomers).toBe("number");
    expect(typeof kpi.cancelRate).toBe("number");

    // 2. Kiểm tra biểu đồ theo giờ (24 khung giờ 00h - 23h)
    const hourly = json.data.hourlyStats;
    expect(hourly).toBeDefined();
    expect(Array.isArray(hourly.stats)).toBe(true);
    expect(hourly.stats.length).toBe(24);
    expect(hourly.stats[0]).toHaveProperty("hour");
    expect(hourly.stats[0]).toHaveProperty("hourLabel");
    expect(hourly.stats[0]).toHaveProperty("revenue");
    expect(hourly.stats[0]).toHaveProperty("orderCount");

    // 3. Kiểm tra phân bổ phương thức thanh toán (Pie chart)
    const payment = json.data.paymentDistribution;
    expect(Array.isArray(payment)).toBe(true);
    expect(payment.length).toBe(2);
    expect(payment.some((p: any) => p.method === "CASH")).toBe(true);
    expect(payment.some((p: any) => p.method === "TRANSFER")).toBe(true);

    // 4. Kiểm tra Top 10 món bán chạy
    const top = json.data.topSelling;
    expect(top).toBeDefined();
    expect(Array.isArray(top.byQuantity)).toBe(true);
    expect(Array.isArray(top.byRevenue)).toBe(true);
    expect(top.byQuantity.length).toBeLessThanOrEqual(10);
    expect(top.byRevenue.length).toBeLessThanOrEqual(10);

    // 5. Kiểm tra danh sách đơn hàng có phân trang
    const ordersList = json.data.ordersList;
    expect(ordersList).toBeDefined();
    expect(Array.isArray(ordersList.orders)).toBe(true);
    expect(ordersList.pagination).toBeDefined();
    expect(ordersList.pagination.page).toBe(1);
    expect(ordersList.pagination.pageSize).toBe(20);
  });

  it("2. GET /api/reports?period=custom: Hỗ trợ lọc theo khoảng ngày tùy chọn (from - to)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const req = new NextRequest(
      `http://localhost:3000/api/reports?period=custom&from=${today}&to=${today}`,
      {
        headers: { "x-user-shop-id": shopId },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.filter.period).toBe("custom");
    expect(json.data.filter.from).toBeDefined();
    expect(json.data.filter.to).toBeDefined();
  });

  it("3. GET /api/reports?export=csv: Xuất file CSV định dạng UTF-8 with BOM kèm Content-Disposition", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/reports?period=month&export=csv",
      {
        headers: { "x-user-shop-id": shopId },
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment; filename=");

    const buf = Buffer.from(await res.arrayBuffer());
    // Kiểm tra UTF-8 BOM (0xEF, 0xBB, 0xBF)
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);

    const csvText = buf.toString("utf-8");
    // Kiểm tra header cột tiếng Việt
    expect(csvText).toContain("Mã đơn");
    expect(csvText).toContain("Thời gian");
    expect(csvText).toContain("Tổng tiền (₫)");
    expect(csvText).toContain("Phương thức");
  });

  it("4. Phân trang server-side: thay đổi page và pageSize", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/reports?period=month&page=1&pageSize=5",
      {
        headers: { "x-user-shop-id": shopId },
      }
    );

    const res = await GET(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.ordersList.orders.length).toBeLessThanOrEqual(5);
    expect(json.data.ordersList.pagination.pageSize).toBe(5);
  });
});
