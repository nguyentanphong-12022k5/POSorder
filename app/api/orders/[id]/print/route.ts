import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { printReceipt } from "@/lib/printer/escpos";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/print
 * Lấy danh sách lịch sử các lần in của đơn hàng
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      select: { id: true, code: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy hóa đơn" },
        { status: 404 }
      );
    }

    const printLogs = await prisma.printLog.findMany({
      where: { orderId: order.id },
      include: {
        staff: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { printedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderCode: order.code,
        totalPrints: printLogs.length,
        logs: printLogs,
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy lịch sử in:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi hệ thống khi tải lịch sử in" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders/[id]/print
 * Gửi lệnh in hóa đơn qua máy in nhiệt ESC/POS
 * - Lần 1: isReprint = false, in header "HÓA ĐƠN"
 * - Lần >= 2: isReprint = true, in thêm header "*** IN LẠI LẦN N ***"
 * - Chặn spam: nếu cách lần in trước < 3 giây -> trả 429
 * - Nếu ESC/POS throw lỗi -> KHÔNG mất đơn, trả { printed: false, error }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 1. Kiểm tra session đăng nhập
    const session = await getSessionUser(req);
    const staffId = session?.id || null;

    // 2. Tìm đơn hàng
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đơn hàng cần in" },
        { status: 404 }
      );
    }

    // 3. Chặn spam in: kiểm tra lần in gần nhất của đơn hàng
    const lastLog = await prisma.printLog.findFirst({
      where: { orderId: order.id },
      orderBy: { printedAt: "desc" },
    });

    if (lastLog) {
      const elapsedMs = Date.now() - new Date(lastLog.printedAt).getTime();
      if (elapsedMs < 3000) {
        const waitRemainingSec = ((3000 - elapsedMs) / 1000).toFixed(1);
        const errMsg = `Thao tác in quá nhanh! Vui lòng chờ ${waitRemainingSec}s trước khi in lại.`;
        return NextResponse.json(
          {
            success: false,
            printed: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: errMsg,
            },
            message: errMsg,
            retryAfterMs: 3000 - elapsedMs,
          },
          { status: 429 }
        );
      }
    }

    // 4. Xác định lần in & trạng thái in lại
    const previousPrintCount = await prisma.printLog.count({
      where: { orderId: order.id },
    });
    const isReprint = previousPrintCount > 0;
    const printNum = previousPrintCount + 1;

    // Cho phép gửi simulateError từ body để test kịch bản máy in hỏng
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }
    const simulateError = Boolean(body?.simulateError);

    // 5. Gửi lệnh in tới máy in nhiệt ESC/POS
    try {
      await printReceipt(order, {
        isReprint,
        printNum,
        simulateError,
      });

      // Nếu in thành công -> Lưu log vào bảng PrintLog
      const newLog = await prisma.printLog.create({
        data: {
          orderId: order.id,
          staffId: staffId || order.staffId,
          isReprint,
          printNum,
        },
        include: {
          staff: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        printed: true,
        isReprint,
        printNum,
        message: isReprint
          ? `Đã gửi lệnh in lại lần ${printNum} thành công`
          : "Đã gửi lệnh in hóa đơn gốc thành công",
        log: newLog,
      });
    } catch (printErr: any) {
      // Yêu cầu 3: ESC/POS throw lỗi -> KHÔNG mất đơn, trả { printed: false, error: { code, message } }
      console.error(
        `[Print Failure] Lỗi khi in đơn ${order.code}:`,
        printErr?.message
      );

      const errMsg =
        printErr?.message ||
        "Máy in nhiệt ESC/POS không phản hồi hoặc hết giấy. Vui lòng kiểm tra thiết bị!";

      return NextResponse.json(
        {
          success: false,
          printed: false,
          error: {
            code: "PRINTER_ERROR",
            message: errMsg,
          },
          message: errMsg,
          isReprint,
          printNum,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Lỗi API print:", error);
    const errMsg = error?.message || "Lỗi máy chủ khi xử lý lệnh in";
    return NextResponse.json(
      {
        success: false,
        printed: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: errMsg,
        },
        message: errMsg,
      },
      { status: 500 }
    );
  }
}
