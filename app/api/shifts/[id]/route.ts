import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createApiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/shifts/[id]
 * Lấy chi tiết toàn diện của 1 ca làm việc:
 * - Thông tin tài chính ca (tiền đầu ca, tiền đếm thực tế, lệch két)
 * - Toàn bộ danh sách đơn hàng đã tạo trong ca
 * - Tổng hợp thống kê danh mục món nước bán trong ca
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getSessionUser(req);
    const shopId = session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const shift = await prisma.shift.findFirst({
      where: {
        id,
        shopId,
      },
      include: {
        staff: {
          select: { id: true, name: true, email: true, role: true },
        },
        orders: {
          include: {
            items: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!shift) {
      return createApiErrorResponse(
        "NOT_FOUND",
        "Không tìm thấy ca làm việc yêu cầu",
        404
      );
    }

    // Nếu ca đang OPEN, tính toán số liệu live
    let liveSummary = {
      cashRevenue: shift.cashRevenue,
      transferRevenue: shift.totalTransfer,
      totalOrders: shift.totalOrders,
      expectedCash: shift.expectedCash,
    };

    if (shift.status === "OPEN") {
      const cashSales = shift.orders
        .filter((o) => o.status === "PAID" && o.paymentMethod === "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const transferSales = shift.orders
        .filter((o) => o.status === "PAID" && o.paymentMethod === "TRANSFER")
        .reduce((sum, o) => sum + o.total, 0);

      liveSummary = {
        cashRevenue: cashSales,
        transferRevenue: transferSales,
        totalOrders: shift.orders.filter((o) => o.status === "PAID").length,
        expectedCash: shift.openingCash + cashSales,
      };
    }

    // Tổng hợp món bán chạy trong ca (Top items breakdown)
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    shift.orders.forEach((order) => {
      if (order.status !== "PAID") return;
      order.items.forEach((item) => {
        const key = item.variantName ? `${item.name} (${item.variantName})` : item.name;
        const current = itemMap.get(key) || { name: key, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += item.lineTotal;
        itemMap.set(key, current);
      });
    });

    const topItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);

    return NextResponse.json({
      success: true,
      data: {
        ...shift,
        liveSummary,
        topItems,
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy chi tiết ca làm việc:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Không thể tải chi tiết ca làm việc",
      500
    );
  }
}
