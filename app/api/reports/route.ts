import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Tính toán mốc thời gian bắt đầu & kết thúc dựa vào bộ lọc
 */
function parseDateRange(period: string, from?: string | null, to?: string | null) {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
    end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
  } else if (period === "7days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period === "custom" && from && to) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    start = new Date(fy, (fm || 1) - 1, fd || 1, 0, 0, 0, 0);
    end = new Date(ty, (tm || 1) - 1, td || 1, 23, 59, 59, 999);
  } else {
    // period === "today" hoặc mặc định
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * GET /api/reports
 * Hỗ trợ các tham số:
 * - period: "today" | "yesterday" | "7days" | "month" | "custom"
 * - from: "YYYY-MM-DD" (khi period = "custom")
 * - to: "YYYY-MM-DD" (khi period = "custom")
 * - page: number (mặc định 1)
 * - pageSize: number (mặc định 20)
 * - status: "ALL" | "PAID" | "CANCELLED"
 * - export: "csv" (tải trực tiếp file CSV)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId =
      session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const isExportCsv = searchParams.get("export") === "csv";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(5, Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)));
    const filterStatus = searchParams.get("status") || "ALL";

    const { start, end } = parseDateRange(period, from, to);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // =========================================================================
    // 1. XUẤT CSV NẾU CÓ YÊU CẦU export=csv
    // =========================================================================
    if (isExportCsv) {
      const allOrdersToExport = await prisma.order.findMany({
        where: {
          shopId,
          createdAt: { gte: start, lte: end },
          ...(filterStatus !== "ALL" ? { status: filterStatus } : {}),
        },
        include: {
          items: true,
          staff: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const bom = "\uFEFF"; // Byte Order Mark để Excel Windows mở đúng UTF-8 tiếng Việt
      const headers = [
        "Mã đơn",
        "Thời gian",
        "Trạng thái",
        "Loại đơn",
        "Bàn",
        "Khách hàng",
        "Số điện thoại",
        "Danh sách món",
        "Phương thức",
        "Tạm tính (₫)",
        "Giảm giá (₫)",
        "Tổng tiền (₫)",
        "Tiền khách đưa (₫)",
        "Tiền thối (₫)",
        "Thu ngân",
        "Ghi chú",
        "Lý do hủy",
      ];

      const csvRows = [headers.join(",")];

      for (const ord of allOrdersToExport) {
        const dateStr = new Date(ord.createdAt).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        const itemsStr = ord.items
          .map((it) => {
            let desc = `${it.quantity}x ${it.name}`;
            if (it.variantName) desc += ` (${it.variantName})`;
            return desc;
          })
          .join(" | ");

        const row = [
          `"${ord.code}"`,
          `"${dateStr}"`,
          `"${ord.status === "PAID" ? "Hoàn tất" : ord.status === "CANCELLED" ? "Đã hủy" : ord.status}"`,
          `"${ord.orderType === "DINE_IN" ? "Tại bàn" : "Mang đi"}"`,
          `"${ord.tableNumber || "-"}"`,
          `"${(ord.customerName || "-").replace(/"/g, '""')}"`,
          `"${ord.customerPhone || "-"}"`,
          `"${itemsStr.replace(/"/g, '""')}"`,
          `"${ord.paymentMethod === "TRANSFER" ? "Chuyển khoản QR" : "Tiền mặt"}"`,
          ord.subtotal,
          ord.discount,
          ord.total,
          ord.paidAmount,
          ord.changeAmount,
          `"${(ord.staff?.name || "Thu ngân").replace(/"/g, '""')}"`,
          `"${(ord.note || "-").replace(/"/g, '""')}"`,
          `"${(ord.cancelReason || "-").replace(/"/g, '""')}"`,
        ];

        csvRows.push(row.join(","));
      }

      const csvContent = bom + csvRows.join("\r\n");
      const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Bao_cao_don_hang_${period}_${dateTag}.csv"`,
        },
      });
    }

    // =========================================================================
    // 2. BACKEND AGGREGATION: PRISMA GROUPBY & RAW SQL (KHÔNG KÉO HẾT VỀ CLIENT)
    // =========================================================================

    // 2.1. Prisma groupBy Trạng thái đơn để tính KPI & Tỉ lệ hủy
    const statusGrouping = await prisma.order.groupBy({
      by: ["status"],
      where: {
        shopId,
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
      _sum: { total: true },
    });

    let totalPaidOrders = 0;
    let totalPaidRevenue = 0;
    let totalCancelledOrders = 0;

    for (const sg of statusGrouping) {
      if (sg.status === "PAID") {
        totalPaidOrders = sg._count.id || 0;
        totalPaidRevenue = sg._sum.total || 0;
      } else if (sg.status === "CANCELLED") {
        totalCancelledOrders = sg._count.id || 0;
      }
    }

    const totalCreatedOrders = totalPaidOrders + totalCancelledOrders;
    const cancelRate =
      totalCreatedOrders > 0
        ? Number(((totalCancelledOrders / totalCreatedOrders) * 100).toFixed(1))
        : 0;
    const averageOrderValue =
      totalPaidOrders > 0 ? Math.round(totalPaidRevenue / totalPaidOrders) : 0;

    // 2.2. Số lượng khách (Khách có SĐT thành viên distinct + Khách vãng lai)
    const distinctPhoneCustomers = await prisma.order.findMany({
      where: {
        shopId,
        status: "PAID",
        createdAt: { gte: start, lte: end },
        customerPhone: { not: null },
      },
      distinct: ["customerPhone"],
      select: { customerPhone: true },
    });

    const walkInOrdersCount = await prisma.order.count({
      where: {
        shopId,
        status: "PAID",
        createdAt: { gte: start, lte: end },
        customerPhone: null,
      },
    });

    const totalCustomers = distinctPhoneCustomers.length + walkInOrdersCount;

    // 2.3. Raw SQL: Doanh thu & Số đơn theo giờ (Hourly Revenue & Order Counts)
    // Dùng strftime trên Unix timestamp / 1000 với múi giờ Việt Nam (+7 hours)
    const hourlyRaw: Array<{ hour: string; revenue: bigint; orderCount: bigint }> =
      await prisma.$queryRawUnsafe(`
        SELECT 
          strftime('%H', datetime(createdAt / 1000, 'unixepoch', '+7 hours')) as hour,
          CAST(COALESCE(SUM(total), 0) AS INTEGER) as revenue,
          COUNT(id) as orderCount
        FROM "Order"
        WHERE shopId = '${shopId}'
          AND status = 'PAID'
          AND createdAt >= ${startMs}
          AND createdAt <= ${endMs}
        GROUP BY hour
        ORDER BY hour ASC
      `);

    // Chuẩn hóa 24 khung giờ từ 00:00 đến 23:00 và xác định Peak Hour
    let maxHourRevenue = 0;
    let peakHourStr: string | null = null;

    const hourlyStats = Array.from({ length: 24 }, (_, i) => {
      const hStr = i.toString().padStart(2, "0");
      const found = hourlyRaw.find((r) => r.hour === hStr);
      const rev = found ? Number(found.revenue) : 0;
      const cnt = found ? Number(found.orderCount) : 0;

      if (rev > maxHourRevenue && rev > 0) {
        maxHourRevenue = rev;
        peakHourStr = `${hStr}:00 - ${hStr}:59`;
      }

      return {
        hour: hStr,
        hourLabel: `${hStr}:00`,
        revenue: rev,
        orderCount: cnt,
      };
    });

    // 2.4. Prisma groupBy: Phân bổ phương thức thanh toán (CASH vs TRANSFER)
    const paymentGrouping = await prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        shopId,
        status: "PAID",
        createdAt: { gte: start, lte: end },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    let cashRevenue = 0;
    let cashCount = 0;
    let transferRevenue = 0;
    let transferCount = 0;

    for (const pg of paymentGrouping) {
      if (pg.paymentMethod === "CASH") {
        cashRevenue = pg._sum.total || 0;
        cashCount = pg._count.id || 0;
      } else if (pg.paymentMethod === "TRANSFER") {
        transferRevenue = pg._sum.total || 0;
        transferCount = pg._count.id || 0;
      }
    }

    const paymentSum = cashRevenue + transferRevenue;

    const paymentDistribution = [
      {
        method: "CASH",
        name: "Tiền mặt",
        revenue: cashRevenue,
        orderCount: cashCount,
        percentage:
          paymentSum > 0 ? Math.round((cashRevenue / paymentSum) * 100) : 0,
        color: "#10b981", // Emerald 500
      },
      {
        method: "TRANSFER",
        name: "Chuyển khoản QR",
        revenue: transferRevenue,
        orderCount: transferCount,
        percentage:
          paymentSum > 0 ? Math.round((transferRevenue / paymentSum) * 100) : 0,
        color: "#8b5cf6", // Purple 500
      },
    ];

    // 2.5. Prisma groupBy OrderItem: Top 10 món bán chạy (theo số lượng & theo doanh thu)
    const [topByQuantityRaw, topByRevenueRaw] = await Promise.all([
      prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            shopId,
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
        },
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            shopId,
            status: "PAID",
            createdAt: { gte: start, lte: end },
          },
        },
        _sum: {
          quantity: true,
          lineTotal: true,
        },
        orderBy: {
          _sum: {
            lineTotal: "desc",
          },
        },
        take: 10,
      }),
    ]);

    const topSellingByQuantity = topByQuantityRaw.map((it, idx) => ({
      rank: idx + 1,
      name: it.name,
      quantity: it._sum.quantity || 0,
      revenue: it._sum.lineTotal || 0,
      percentageOfRevenue:
        totalPaidRevenue > 0
          ? Number((((it._sum.lineTotal || 0) / totalPaidRevenue) * 100).toFixed(1))
          : 0,
    }));

    const topSellingByRevenue = topByRevenueRaw.map((it, idx) => ({
      rank: idx + 1,
      name: it.name,
      quantity: it._sum.quantity || 0,
      revenue: it._sum.lineTotal || 0,
      percentageOfRevenue:
        totalPaidRevenue > 0
          ? Number((((it._sum.lineTotal || 0) / totalPaidRevenue) * 100).toFixed(1))
          : 0,
    }));

    // 2.6. Phân trang danh sách đơn hàng cho bảng (Tránh kéo hàng ngàn đơn về client)
    const orderWhere: any = {
      shopId,
      createdAt: { gte: start, lte: end },
      ...(filterStatus !== "ALL" ? { status: filterStatus } : {}),
    };

    const [totalMatchingOrders, paginatedOrders] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.findMany({
        where: orderWhere,
        include: {
          items: true,
          staff: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalMatchingOrders / pageSize) || 1;

    return NextResponse.json({
      success: true,
      data: {
        filter: {
          period,
          from: start.toISOString(),
          to: end.toISOString(),
        },
        kpi: {
          totalRevenue: totalPaidRevenue,
          totalOrders: totalPaidOrders,
          averageOrderValue,
          totalCustomers,
          totalCancelledOrders,
          cancelRate,
        },
        hourlyStats: {
          stats: hourlyStats,
          peakHour: peakHourStr,
          peakRevenue: maxHourRevenue,
        },
        paymentDistribution,
        topSelling: {
          byQuantity: topSellingByQuantity,
          byRevenue: topSellingByRevenue,
        },
        ordersList: {
          orders: paginatedOrders,
          pagination: {
            page,
            pageSize,
            totalCount: totalMatchingOrders,
            totalPages,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("Lỗi API báo cáo thống kê:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Lỗi máy chủ khi kết xuất báo cáo",
        },
        message: "Lỗi hệ thống khi tải báo cáo",
      },
      { status: 500 }
    );
  }
}
