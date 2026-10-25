import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/kitchen
 * Lấy danh sách các đơn hàng cho màn hình Bếp / KDS
 * Bao gồm các đơn đang chờ làm (PENDING, PAID), đang làm (MAKING) và vừa hoàn tất (DONE)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId = session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "ACTIVE"; // ACTIVE: PENDING, MAKING, PAID; COMPLETED: DONE

    let statusCondition: any = {
      in: ["PENDING", "MAKING", "PAID"],
    };

    if (filter === "COMPLETED") {
      statusCondition = "DONE";
    } else if (filter === "ALL") {
      statusCondition = { in: ["PENDING", "MAKING", "DONE", "PAID"] };
    }

    const orders = await prisma.order.findMany({
      where: {
        shopId,
        status: statusCondition,
      },
      include: {
        items: true,
        staff: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    console.error("Lỗi tải danh sách bếp:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi tải đơn hàng màn hình bếp" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/kitchen
 * Cập nhật trạng thái quy trình pha chế đơn hàng:
 * PENDING -> MAKING -> DONE
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId = session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { success: false, message: "Thiếu mã đơn hàng hoặc trạng thái cần cập nhật" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "MAKING", "DONE", "PAID", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: `Trạng thái không hợp lệ: ${status}` },
        { status: 422 }
      );
    }

    const existingOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        shopId,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đơn hàng cần cập nhật" },
        { status: 404 }
      );
    }

    // Đồng bộ trạng thái đơn hàng và các món con (OrderItem)
    const itemStatus =
      status === "DONE"
        ? "COMPLETED"
        : status === "MAKING"
        ? "PREPARING"
        : "PENDING";

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { items: true },
      }),
      prisma.orderItem.updateMany({
        where: { orderId },
        data: { itemStatus },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Đã chuyển trạng thái đơn ${updatedOrder.code} sang ${status}`,
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error("Lỗi cập nhật trạng thái bếp:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Lỗi cập nhật trạng thái đơn hàng" },
      { status: 500 }
    );
  }
}
