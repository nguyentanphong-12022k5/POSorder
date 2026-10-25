import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req?: NextRequest) {
  try {
    // Lấy các đơn hàng đã thanh toán và chưa hoàn thành pha chế hết các món
    const activeOrders = await prisma.order.findMany({
      where: {
        status: "PAID",
      },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: {
        items: true,
      },
    });

    return NextResponse.json({ success: true, data: activeOrders });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu KDS:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi tải danh sách pha chế" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, orderId, itemStatus } = body;

    if (itemId && itemStatus) {
      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: { itemStatus },
      });
      return NextResponse.json({ success: true, data: updatedItem });
    }

    if (orderId && itemStatus) {
      await prisma.orderItem.updateMany({
        where: { orderId },
        data: { itemStatus },
      });
      return NextResponse.json({ success: true, message: "Cập nhật toàn bộ món thành công" });
    }

    return NextResponse.json({ success: false, message: "Thiếu dữ liệu" }, { status: 400 });
  } catch (error: any) {
    console.error("Lỗi cập nhật KDS:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
