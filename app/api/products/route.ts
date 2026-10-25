import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProductSchema, formatZodError } from "@/lib/validations/schemas";
import { createApiErrorResponse } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        variants: true,
        toppings: {
          include: {
            topping: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const categories = await prisma.category.findMany({
      orderBy: { sort: "asc" },
    });

    const toppings = await prisma.topping.findMany({
      orderBy: { price: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: { products, categories, toppings },
    });
  } catch (error) {
    console.error("Lỗi lấy sản phẩm admin:", error);
    return NextResponse.json(
      { success: false, message: "Không thể lấy danh sách sản phẩm" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = ProductSchema.safeParse(rawBody);

    if (!parseResult.success) {
      const { fields, firstMessage } = formatZodError(parseResult.error);
      return createApiErrorResponse("VALIDATION_ERROR", firstMessage, 422, fields);
    }

    const { name, categoryId, basePrice, imageUrl, isActive, variants, toppingIds } = parseResult.data;

    const newProduct = await prisma.product.create({
      data: {
        name,
        categoryId,
        basePrice,
        imageUrl: imageUrl || null,
        isActive: isActive ?? true,
        variants: {
          create:
            variants && variants.length > 0
              ? variants
              : [
                  { name: "Size S", extraPrice: 0 },
                  { name: "Size M", extraPrice: 0 },
                  { name: "Size L", extraPrice: 6000 },
                ],
        },
      },
      include: {
        category: true,
        variants: true,
      },
    });

    // Liên kết toppings
    const toppingList =
      toppingIds && toppingIds.length > 0
        ? await prisma.topping.findMany({ where: { id: { in: toppingIds } } })
        : await prisma.topping.findMany();

    for (const top of toppingList) {
      await prisma.toppingOnProduct.create({
        data: {
          productId: newProduct.id,
          toppingId: top.id,
        },
      });
    }

    // Ghi AuditLog khi tạo món mới
    const session = await getSessionUser(req);
    await prisma.auditLog.create({
      data: {
        entity: "Product",
        entityId: newProduct.id,
        action: "CREATE",
        before: null,
        after: JSON.stringify(newProduct),
        staffId: session?.id || null,
      },
    });

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error("Lỗi thêm sản phẩm:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Lỗi hệ thống khi tạo sản phẩm mới. Vui lòng thử lại!",
      500
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const body = await req.json();
    const { id, name, basePrice, isActive, imageUrl, categoryId } = body;

    if (!id) {
      return createApiErrorResponse("BAD_REQUEST", "Thiếu mã sản phẩm (id)", 400);
    }

    // Lấy snapshot dữ liệu trước khi sửa để ghi AuditLog
    const beforeProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!beforeProduct) {
      return createApiErrorResponse("NOT_FOUND", "Không tìm thấy sản phẩm cần cập nhật", 404);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (basePrice !== undefined) updateData.basePrice = parseInt(basePrice, 10);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: true },
    });

    // Ghi AuditLog khi sửa menu
    await prisma.auditLog.create({
      data: {
        entity: "Product",
        entityId: id,
        action: "UPDATE",
        before: JSON.stringify(beforeProduct),
        after: JSON.stringify(updated),
        staffId: session?.id || null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      error?.message || "Lỗi cập nhật sản phẩm",
      500
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return createApiErrorResponse("BAD_REQUEST", "Thiếu tham số id sản phẩm cần xoá", 400);
    }

    const beforeProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!beforeProduct) {
      return createApiErrorResponse("NOT_FOUND", "Không tìm thấy sản phẩm cần xoá", 404);
    }

    // Chuyển sang ngưng phục vụ (soft delete) hoặc xóa trực tiếp
    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // Ghi AuditLog khi xóa / ngưng phục vụ món
    await prisma.auditLog.create({
      data: {
        entity: "Product",
        entityId: id,
        action: "DELETE",
        before: JSON.stringify(beforeProduct),
        after: JSON.stringify(updated),
        staffId: session?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã ngưng phục vụ món ${beforeProduct.name}`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Lỗi xoá sản phẩm:", error);
    return createApiErrorResponse(
      "INTERNAL_SERVER_ERROR",
      error?.message || "Lỗi khi xoá sản phẩm",
      500
    );
  }
}
