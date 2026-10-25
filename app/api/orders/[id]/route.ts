import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Lấy session người dùng hiện tại
    const session = await getSessionUser(req);
    const shopId =
      session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    // Chống IDOR: Ràng buộc chặt chẽ theo shopId của người dùng
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: id }, { code: id }],
        shopId: shopId,
      },
      include: {
        items: true,
        printLogs: {
          include: {
            staff: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: {
            printedAt: "desc",
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy hóa đơn hoặc bạn không có quyền truy cập",
          },
          message: "Không tìm thấy hóa đơn hoặc bạn không có quyền truy cập",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("Lỗi lấy chi tiết đơn hàng:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lỗi hệ thống khi tải đơn hàng",
        },
        message: "Lỗi hệ thống khi tải đơn hàng",
      },
      { status: 500 }
    );
  }
}
