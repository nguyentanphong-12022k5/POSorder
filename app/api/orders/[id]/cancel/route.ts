import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createApiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/[id]/cancel
 * Luồng hủy đơn hàng:
 * 1. Admin được phép hủy đơn đã thanh toán bất kỳ lúc nào
 * 2. Staff chỉ được hủy đơn:
 *    - Trong vòng 5 phút kể từ khi tạo đơn
 *    - Đơn CHƯA TỪNG ĐƯỢC IN (printLogs.length === 0)
 * 3. Hủy KHÔNG xoá OrderItem (Audit trail)
 * 4. Tự động ghi vào bảng AuditLog kèm snapshot before/after JSON
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { reason = "Khách hủy đơn", adminPin } = body;

    // 1. Xác thực người dùng & Phân quyền
    const session = await getSessionUser(req);
    const headerRole = req.headers.get("x-user-role");
    const setting = await prisma.setting.findFirst({ where: { id: "default" } });
    const correctPin = setting?.adminPin || "1234";

    const isAdminByPin = Boolean(adminPin && adminPin === correctPin);
    const isAdminBySession = session?.role === "admin";
    const isAdminByHeader = headerRole === "admin";
    const isAdmin = isAdminBySession || isAdminByPin || isAdminByHeader;

    // 2. Tìm đơn hàng kèm printLogs & items
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: {
        items: true,
        printLogs: true,
      },
    });

    if (!order) {
      return createApiErrorResponse("NOT_FOUND", "Không tìm thấy hóa đơn cần hủy", 404);
    }

    if (order.status === "CANCELLED") {
      return createApiErrorResponse("BAD_REQUEST", "Đơn hàng này đã bị hủy trước đó", 400);
    }

    // 3. Kiểm tra điều kiện hủy dành cho Staff
    if (!isAdmin) {
      // 3.1. Kiểm tra thời gian tạo đơn: <= 5 phút
      const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
      const maxAgeMs = 5 * 60 * 1000; // 5 phút

      if (orderAgeMs > maxAgeMs) {
        const minutesPassed = Math.floor(orderAgeMs / 60000);
        return createApiErrorResponse(
          "FORBIDDEN",
          `Nhân viên chỉ được phép hủy đơn trong vòng 5 phút sau khi tạo (Đơn này đã tạo được ${minutesPassed} phút). Vui lòng yêu cầu Quản lý/Admin xử lý!`,
          403
        );
      }

      // 3.2. Kiểm tra trạng thái in: Chưa từng in
      if (order.printLogs && order.printLogs.length > 0) {
        return createApiErrorResponse(
          "FORBIDDEN",
          "Hóa đơn này đã được in ra cho khách, nhân viên không được phép tự hủy. Vui lòng nhập mã PIN Quản lý hoặc liên hệ Admin!",
          403
        );
      }
    }

    // 4. Thực hiện Hủy trong Transaction (KHÔNG XOÁ OrderItem, ghi AuditLog)
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      // Snapshot dữ liệu trước khi hủy
      const beforeSnapshot = JSON.stringify(order);

      const cancellerName =
        session?.name ||
        session?.email ||
        (isAdmin ? "Quản trị viên (Admin)" : "Nhân viên thu ngân");

      // Cập nhật trạng thái đơn
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: String(reason).trim(),
          cancelledBy: cancellerName,
          cancelledById: session?.id || null,
        },
        include: {
          items: true,
        },
      });

      // Hoàn lại điểm tích luỹ nếu có
      if (order.customerPhone && (order.pointsEarned > 0 || order.pointsUsed > 0)) {
        await tx.customer.updateMany({
          where: { phone: order.customerPhone },
          data: {
            points: {
              decrement: order.pointsEarned - order.pointsUsed,
            },
          },
        });
      }

      // Giải phóng bàn nếu có
      if (order.tableNumber) {
        await tx.restaurantTable.updateMany({
          where: { name: order.tableNumber },
          data: { status: "EMPTY", orderId: null },
        });
      }

      // Cập nhật lại ca làm việc nếu đơn gắn với ca
      if (order.shiftId) {
        await tx.shift.update({
          where: { id: order.shiftId },
          data: {
            totalOrders: { decrement: 1 },
            cashRevenue:
              order.paymentMethod === "CASH" ? { decrement: order.total } : undefined,
            totalTransfer:
              order.paymentMethod === "TRANSFER" ? { decrement: order.total } : undefined,
          },
        });
      }

      // Hoàn trả nguyên liệu kho (Audit trail: CANCEL_RESTORE)
      const saleMovements = await tx.stockMovement.findMany({
        where: {
          orderId: order.id,
          reason: "SALE",
        },
      });

      for (const sm of saleMovements) {
        const restoreQty = Math.abs(sm.delta);
        const updatedIng = await tx.ingredient.update({
          where: { id: sm.ingredientId },
          data: {
            stockQty: { increment: restoreQty },
          },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: sm.ingredientId,
            delta: restoreQty,
            reason: "CANCEL_RESTORE",
            orderId: order.id,
          },
        });

        // Phục hồi cờ outOfStock nếu nguyên liệu có hàng trở lại
        if (updatedIng.stockQty > 0) {
          const affectedRecipes = await tx.recipeItem.findMany({
            where: { ingredientId: sm.ingredientId, productId: { not: null } },
            select: { productId: true },
          });
          const affectedProductIds = affectedRecipes
            .map((r) => r.productId)
            .filter(Boolean) as string[];

          if (affectedProductIds.length > 0) {
            await tx.product.updateMany({
              where: { id: { in: affectedProductIds } },
              data: { outOfStock: false },
            });
          }
        }
      }

      // Ghi log vào bảng AuditLog
      await tx.auditLog.create({
        data: {
          entity: "Order",
          entityId: order.id,
          action: "CANCEL",
          before: beforeSnapshot,
          after: JSON.stringify(updated),
          staffId: session?.id || null,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: `Đã hủy đơn ${order.code} thành công!`,
      data: cancelledOrder,
    });
  } catch (error: any) {
    console.error("Lỗi xử lý hủy đơn hàng:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      error?.message || "Lỗi máy chủ khi hủy đơn hàng",
      500
    );
  }
}
