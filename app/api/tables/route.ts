import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tables = await prisma.restaurantTable.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: tables });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Lỗi tải danh sách bàn" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, orderId } = body;

    const updated = await prisma.restaurantTable.update({
      where: { id },
      data: {
        status: status || "EMPTY",
        orderId: orderId !== undefined ? orderId : null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
