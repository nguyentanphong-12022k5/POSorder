import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sort: "asc" },
      include: {
        products: {
          where: { isActive: true },
          include: {
            variants: {
              orderBy: { extraPrice: "asc" },
            },
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("Lỗi lấy danh sách menu:", error);
    return NextResponse.json(
      { success: false, message: "Không thể lấy danh mục thực đơn" },
      { status: 500 }
    );
  }
}
