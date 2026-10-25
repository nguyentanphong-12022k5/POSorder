import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (phone) {
      const customer = await prisma.customer.findUnique({
        where: { phone: phone.trim() },
      });
      return NextResponse.json({ success: true, data: customer });
    }

    const customers = await prisma.customer.findMany({
      orderBy: { points: "desc" },
      take: 50,
    });
    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Lỗi tải khách hàng" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, name } = body;

    if (!phone) {
      return NextResponse.json({ success: false, message: "Số điện thoại bắt buộc" }, { status: 400 });
    }

    const customer = await prisma.customer.upsert({
      where: { phone: phone.trim() },
      update: { name: name || undefined },
      create: {
        phone: phone.trim(),
        name: name || "Khách hàng",
        points: 0,
      },
    });

    return NextResponse.json({ success: true, data: customer });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
