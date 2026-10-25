import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Lỗi tải kho nguyên liệu" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, unit, quantity, minQuantity, costPrice } = body;

    const newItem = await prisma.inventoryItem.create({
      data: {
        name,
        unit: unit || "cái",
        quantity: parseFloat(quantity) || 0,
        minQuantity: parseFloat(minQuantity) || 10,
        costPrice: parseInt(costPrice, 10) || 0,
      },
    });

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, unit, costPrice, quantity, addQuantity, minQuantity } = body;

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ success: false, message: "Không tìm thấy nguyên liệu" }, { status: 404 });
    }

    let newQty = item.quantity;
    if (quantity !== undefined) newQty = parseFloat(quantity);
    if (addQuantity !== undefined) newQty += parseFloat(addQuantity);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        unit: unit !== undefined ? String(unit).trim() : undefined,
        costPrice: costPrice !== undefined ? parseInt(costPrice, 10) : undefined,
        quantity: Math.max(0, newQty),
        minQuantity: minQuantity !== undefined ? parseFloat(minQuantity) : undefined,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, message: "Thiếu ID nguyên liệu cần xoá" }, { status: 400 });
    }

    await prisma.inventoryItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Đã xoá nguyên liệu thành công" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
