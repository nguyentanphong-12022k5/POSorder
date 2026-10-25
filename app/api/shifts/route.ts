import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createApiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/shifts
 * - Lấy ca đang mở (activeShift) kèm số liệu trực tiếp (liveStats)
 * - Lấy danh sách lịch sử ca (hỗ trợ lọc theo staffId, date, status)
 * - Lấy danh sách nhân viên để phục vụ lọc
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId = session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const { searchParams } = new URL(req.url);
    const filterStaffId = searchParams.get("staffId");
    const filterDate = searchParams.get("date"); // YYYY-MM-DD
    const filterStatus = searchParams.get("status"); // OPEN | CLOSED

    // 1. Tìm ca đang mở (Active Shift)
    const activeShift = await prisma.shift.findFirst({
      where: { shopId, status: "OPEN" },
      include: {
        staff: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    let liveStats = {
      cashSales: 0,
      transferSales: 0,
      totalOrders: 0,
      expectedCash: activeShift ? activeShift.openingCash : 0,
    };

    if (activeShift) {
      // Tổng hợp các đơn tạo trong ca này
      const activeOrders = await prisma.order.findMany({
        where: {
          OR: [
            { shiftId: activeShift.id },
            { shopId, createdAt: { gte: activeShift.openedAt }, status: "PAID" },
          ],
          status: "PAID",
        },
      });

      const cashSales = activeOrders
        .filter((o) => o.paymentMethod === "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const transferSales = activeOrders
        .filter((o) => o.paymentMethod === "TRANSFER")
        .reduce((sum, o) => sum + o.total, 0);

      liveStats = {
        cashSales,
        transferSales,
        totalOrders: activeOrders.length,
        expectedCash: activeShift.openingCash + cashSales,
      };
    }

    // 2. Xây dựng điều kiện lọc cho danh sách ca
    const whereCondition: any = { shopId };

    if (filterStaffId && filterStaffId !== "ALL") {
      whereCondition.staffId = filterStaffId;
    }

    if (filterStatus && filterStatus !== "ALL") {
      whereCondition.status = filterStatus;
    }

    if (filterDate) {
      const startOfDay = new Date(`${filterDate}T00:00:00.000Z`);
      const endOfDay = new Date(`${filterDate}T23:59:59.999Z`);
      whereCondition.openedAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const shifts = await prisma.shift.findMany({
      where: whereCondition,
      include: {
        staff: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { openedAt: "desc" },
      take: 50,
    });

    // 3. Danh sách nhân viên để hiển thị dropdown lọc
    const staffList = await prisma.profile.findMany({
      where: { shopId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        activeShift,
        liveStats,
        shifts,
        staffList,
      },
    });
  } catch (error: any) {
    console.error("Lỗi lấy danh sách ca làm việc:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Không thể tải danh sách ca làm việc",
      500
    );
  }
}

/**
 * POST /api/shifts
 * - action = "OPEN": Mở ca làm việc mới, nhập tiền đầu ca
 * - action = "CLOSE": Đóng ca làm việc, tổng hợp doanh thu & tính tiền lệch
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId = session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";
    const staffId = session?.id || req.headers.get("x-user-id") || null;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return createApiErrorResponse("BAD_REQUEST", "Dữ liệu JSON không hợp lệ", 400);
    }

    const { action, openingCash, initialCash, closingCash, actualCash, note, staffName } = body;

    // A. MỞ CA LÀM VIỆC (OPEN SHIFT)
    if (action === "OPEN") {
      const parsedOpeningCash = Math.max(
        0,
        parseInt(openingCash !== undefined ? openingCash : initialCash || 0, 10) || 0
      );

      // Nếu đang có ca OPEN của shop, tự động đóng ca cũ trước để tránh trùng lặp
      const existingOpen = await prisma.shift.findFirst({
        where: { shopId, status: "OPEN" },
      });

      if (existingOpen) {
        await prisma.shift.update({
          where: { id: existingOpen.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            note: existingOpen.note
              ? `${existingOpen.note} (Tự động đóng khi mở ca mới)`
              : "(Tự động đóng khi mở ca mới)",
          },
        });
      }

      // Lấy tên nhân viên
      let resolvedStaffName = staffName || "Thu ngân";
      if (staffId) {
        const profile = await prisma.profile.findUnique({ where: { id: staffId } });
        if (profile?.name) resolvedStaffName = profile.name;
      }

      const newShift = await prisma.shift.create({
        data: {
          shopId,
          staffId,
          staffName: resolvedStaffName,
          openingCash: parsedOpeningCash,
          expectedCash: parsedOpeningCash,
          status: "OPEN",
          openedAt: new Date(),
          note: note ? String(note).trim() : null,
        },
        include: {
          staff: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Đã mở ca làm việc thành công với số tiền đầu ca ${parsedOpeningCash.toLocaleString("vi-VN")} ₫`,
        data: newShift,
      });
    }

    // B. ĐÓNG CA LÀM VIỆC (CLOSE SHIFT)
    if (action === "CLOSE") {
      const activeShift = await prisma.shift.findFirst({
        where: { shopId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

      if (!activeShift) {
        return createApiErrorResponse(
          "NOT_FOUND",
          "Hiện tại không có ca làm việc nào đang mở để đóng",
          404
        );
      }

      // Lấy tất cả các đơn hàng thuộc ca
      const ordersInShift = await prisma.order.findMany({
        where: {
          OR: [
            { shiftId: activeShift.id },
            { shopId, createdAt: { gte: activeShift.openedAt }, shiftId: null },
          ],
          status: "PAID",
        },
      });

      // Gắn shiftId cho các đơn chưa gắn
      await prisma.order.updateMany({
        where: {
          shopId,
          createdAt: { gte: activeShift.openedAt },
          shiftId: null,
          status: "PAID",
        },
        data: { shiftId: activeShift.id },
      });

      const cashRevenue = ordersInShift
        .filter((o) => o.paymentMethod === "CASH")
        .reduce((sum, o) => sum + o.total, 0);

      const transferRevenue = ordersInShift
        .filter((o) => o.paymentMethod === "TRANSFER")
        .reduce((sum, o) => sum + o.total, 0);

      const expectedCash = activeShift.openingCash + cashRevenue;
      const parsedClosingCash = Math.max(
        0,
        parseInt(closingCash !== undefined ? closingCash : actualCash || 0, 10) || 0
      );
      const cashDifference = parsedClosingCash - expectedCash;

      const closedShift = await prisma.shift.update({
        where: { id: activeShift.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closingCash: parsedClosingCash,
          expectedCash,
          cashDifference,
          cashRevenue,
          totalTransfer: transferRevenue,
          totalOrders: ordersInShift.length,
          note: note ? String(note).trim() : activeShift.note,
        },
        include: {
          staff: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Đã đóng ca làm việc thành công!",
        data: {
          ...closedShift,
          summary: {
            totalOrders: ordersInShift.length,
            openingCash: activeShift.openingCash,
            cashRevenue,
            transferRevenue,
            totalRevenue: cashRevenue + transferRevenue,
            expectedCash,
            closingCash: parsedClosingCash,
            cashDifference,
          },
        },
      });
    }

    return createApiErrorResponse("BAD_REQUEST", "Hành động yêu cầu không hợp lệ (hỗ trợ OPEN hoặc CLOSE)", 400);
  } catch (error: any) {
    console.error("Lỗi xử lý ca làm việc:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      error?.message || "Lỗi máy chủ khi thao tác ca làm việc",
      500
    );
  }
}
