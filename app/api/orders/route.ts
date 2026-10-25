import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderCode } from "@/lib/orderCode";
import { OrderValidationError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rateLimit";
import { getSessionUser } from "@/lib/auth";
import { CreateOrderSchema, formatZodError } from "@/lib/validations/schemas";

export const dynamic = "force-dynamic";

interface RequestOrderItem {
  productId?: string | null;
  variantId?: string | null;
  toppings?: any;
  quantity?: number;
  note?: string | null;
}

export async function POST(req: NextRequest) {
  // 1. Áp dụng Rate Limit: Tối đa 30 request/phút/IP (In-memory LRU Sliding window)
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const rateLimit = checkRateLimit(clientIp, 30, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Quá nhiều yêu cầu tạo đơn từ IP của bạn. Giới hạn tối đa 30 đơn/phút. Vui lòng thử lại sau ${rateLimit.resetSeconds}s.`,
          field: "rate_limit",
          fields: { rate_limit: `Chờ ${rateLimit.resetSeconds}s` },
        },
        message: `Quá nhiều yêu cầu tạo đơn từ IP của bạn. Vui lòng thử lại sau ${rateLimit.resetSeconds}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.resetSeconds.toString(),
        },
      }
    );
  }

  // Lấy thông tin phiên đăng nhập để gán shopId và staffId (Multi-tenant & Anti-IDOR)
  const session = await getSessionUser(req);
  const shopId =
    session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";
  const staffId = session?.id || req.headers.get("x-user-id") || null;

  // Lấy Idempotency-Key từ header (nếu client có gửi)
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    req.headers.get("idempotency-key") ||
    null;

  try {
    // 2. Fast-path Idempotency
    if (idempotencyKey) {
      const existingIdempotency = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: {
          order: {
            include: { items: true },
          },
        },
      });

      if (existingIdempotency?.order) {
        return NextResponse.json(
          {
            success: true,
            message: "Đơn hàng đã được tạo trước đó (Idempotent replay)",
            data: existingIdempotency.order,
          },
          {
            status: 200,
            headers: { "X-Idempotent-Replay": "true" },
          }
        );
      }
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            field: "body",
            message: "Payload gửi lên không phải định dạng JSON hợp lệ",
            fields: { body: "JSON parse error" },
          },
          message: "Payload gửi lên không phải định dạng JSON hợp lệ",
        },
        { status: 422 }
      );
    }

    // 3. Client & Server Zod Schema Validation
    const zodValidation = CreateOrderSchema.safeParse(body);
    if (!zodValidation.success) {
      const { fields, firstMessage } = formatZodError(zodValidation.error);
      const firstField = Object.keys(fields)[0] || "items";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            field: firstField,
            message: firstMessage,
            fields,
          },
          message: firstMessage,
        },
        { status: 422 }
      );
    }

    const {
      items,
      discount = 0,
      paymentMethod = "CASH",
      paidAmount = 0,
      note = "",
      orderType = "TAKEAWAY",
      tableNumber = null,
      customerPhone = null,
      customerName = null,
      pointsUsed = 0,
      shiftId = null,
    } = zodValidation.data;

    // 4. TOÀN BỘ THAO TÁC THỰC HIỆN TRONG 1 PRISMA TRANSACTION ($transaction)
    const newOrder = await prisma.$transaction(async (tx) => {
      // 4.1. Kiểm tra lại Idempotency Key bên trong transaction
      if (idempotencyKey) {
        const inTxExisting = await tx.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
          include: {
            order: {
              include: { items: true },
            },
          },
        });
        if (inTxExisting?.order) {
          return inTxExisting.order;
        }
      }

      // 4.2. Validate server-side từng item & tính giá gốc từ DB
      let calculatedSubtotal = 0;
      const validatedItemsToCreate: any[] = [];

      for (let i = 0; i < items.length; i++) {
        const item: RequestOrderItem = items[i];

        if (
          typeof item.quantity !== "number" ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          throw new OrderValidationError(
            `items[${i}].quantity`,
            `Số lượng món thứ ${i + 1} phải là số nguyên dương lớn hơn 0`
          );
        }

        if (!item.productId) {
          throw new OrderValidationError(
            `items[${i}].productId`,
            `Món thứ ${i + 1} thiếu mã sản phẩm (productId)`
          );
        }

        const dbProduct = await tx.product.findUnique({
          where: { id: item.productId },
          include: {
            variants: true,
            toppings: {
              include: { topping: true },
            },
          },
        });

        if (!dbProduct || !dbProduct.isActive) {
          throw new OrderValidationError(
            `items[${i}].productId`,
            `Sản phẩm (ID: ${item.productId}) không tồn tại hoặc đã ngừng phục vụ`
          );
        }

        if (dbProduct.outOfStock) {
          throw new OrderValidationError(
            `items[${i}].productId`,
            `Sản phẩm "${dbProduct.name}" hiện đang tạm hết hàng do thiếu nguyên liệu`
          );
        }

        let variantExtraPrice = 0;
        let variantSnapshotName: string | null = null;

        if (item.variantId) {
          const matchedVariant = dbProduct.variants.find(
            (v) => v.id === item.variantId
          );
          if (!matchedVariant) {
            throw new OrderValidationError(
              `items[${i}].variantId`,
              `Kích thước/biến thể đã chọn không thuộc sản phẩm "${dbProduct.name}"`
            );
          }
          variantExtraPrice = matchedVariant.extraPrice;
          variantSnapshotName = matchedVariant.name;
        }

        const allowedToppingMap = new Map(
          dbProduct.toppings.map((tp) => [tp.toppingId, tp.topping])
        );

        const validatedToppingSnapshots: Array<{
          id: string;
          name: string;
          price: number;
        }> = [];
        let toppingsTotalPrice = 0;

        if (Array.isArray(item.toppings) && item.toppings.length > 0) {
          for (let tIdx = 0; tIdx < item.toppings.length; tIdx++) {
            const reqTop = item.toppings[tIdx];
            const realTopping = allowedToppingMap.get(reqTop.id);

            if (!realTopping) {
              throw new OrderValidationError(
                `items[${i}].toppings[${tIdx}]`,
                `Topping (ID: ${reqTop.id}) không hợp lệ hoặc không thuộc sản phẩm "${dbProduct.name}"`
              );
            }

            validatedToppingSnapshots.push({
              id: realTopping.id,
              name: realTopping.name,
              price: realTopping.price,
            });
            toppingsTotalPrice += realTopping.price;
          }
        }

        const unitPrice = dbProduct.basePrice + variantExtraPrice;
        const lineTotal = (unitPrice + toppingsTotalPrice) * item.quantity;
        calculatedSubtotal += lineTotal;

        validatedItemsToCreate.push({
          productId: dbProduct.id,
          name: dbProduct.name,
          variantName: variantSnapshotName,
          toppings: JSON.stringify(validatedToppingSnapshots),
          unitPrice,
          quantity: item.quantity,
          lineTotal,
          note: item.note ? String(item.note).trim() : null,
          itemStatus: "PENDING",
        });
      }

      // 4.2.1. Kiểm tra định lượng nguyên liệu theo công thức (RecipeItem Check)
      const reqProductIds = Array.from(
        new Set(items.map((it: any) => it.productId).filter(Boolean))
      ) as string[];
      const reqVariantIds = Array.from(
        new Set(items.map((it: any) => it.variantId).filter(Boolean))
      ) as string[];
      const reqToppingIds = Array.from(
        new Set(
          items.flatMap((it: any) => it.toppings?.map((t: any) => t.id) || []).filter(Boolean)
        )
      ) as string[];

      const matchedRecipes = await tx.recipeItem.findMany({
        where: {
          OR: [
            { productId: { in: reqProductIds } },
            { variantId: { in: reqVariantIds } },
            { toppingId: { in: reqToppingIds } },
          ],
        },
        include: {
          ingredient: true,
        },
      });

      // Gom nhóm định lượng nguyên liệu cần dùng cho cả đơn hàng
      const requiredIngredients = new Map<
        string,
        { ingredientId: string; ingredientName: string; unit: string; requiredQty: number }
      >();

      for (const item of items) {
        const qty = Number(item.quantity) || 1;

        // Recipes theo Product
        const pRecipes = matchedRecipes.filter((r) => r.productId === item.productId);
        for (const r of pRecipes) {
          const cur = requiredIngredients.get(r.ingredientId) || {
            ingredientId: r.ingredientId,
            ingredientName: r.ingredient?.name || "Nguyên liệu",
            unit: r.ingredient?.unit || "đơn vị",
            requiredQty: 0,
          };
          cur.requiredQty += r.qtyPerUnit * qty;
          requiredIngredients.set(r.ingredientId, cur);
        }

        // Recipes theo Variant
        if (item.variantId) {
          const vRecipes = matchedRecipes.filter((r) => r.variantId === item.variantId);
          for (const r of vRecipes) {
            const cur = requiredIngredients.get(r.ingredientId) || {
              ingredientId: r.ingredientId,
              ingredientName: r.ingredient?.name || "Nguyên liệu",
              unit: r.ingredient?.unit || "đơn vị",
              requiredQty: 0,
            };
            cur.requiredQty += r.qtyPerUnit * qty;
            requiredIngredients.set(r.ingredientId, cur);
          }
        }

        // Recipes theo Topping
        if (Array.isArray(item.toppings)) {
          for (const top of item.toppings) {
            const tRecipes = matchedRecipes.filter((r) => r.toppingId === top.id);
            for (const r of tRecipes) {
              const cur = requiredIngredients.get(r.ingredientId) || {
                ingredientId: r.ingredientId,
                ingredientName: r.ingredient?.name || "Nguyên liệu",
                unit: r.ingredient?.unit || "đơn vị",
                requiredQty: 0,
              };
              cur.requiredQty += r.qtyPerUnit * qty;
              requiredIngredients.set(r.ingredientId, cur);
            }
          }
        }
      }

      // Kiểm tra tồn kho từng nguyên liệu trong transaction
      for (const req of Array.from(requiredIngredients.values())) {
        const ing = await tx.ingredient.findUnique({
          where: { id: req.ingredientId },
        });

        if (!ing || ing.stockQty < req.requiredQty) {
          const currentStock = ing ? ing.stockQty : 0;
          throw new OrderValidationError(
            "inventory",
            `Hết nguyên liệu ${req.ingredientName} (Cần: ${req.requiredQty} ${req.unit}, Tồn kho: ${currentStock} ${req.unit})`
          );
        }
      }

      // 4.3. Validate discount
      const parsedDiscount = Number(discount) || 0;
      if (parsedDiscount < 0 || parsedDiscount > calculatedSubtotal) {
        throw new OrderValidationError(
          "discount",
          `Số tiền giảm giá (${parsedDiscount} ₫) không hợp lệ (phải >= 0 và <= tạm tính ${calculatedSubtotal} ₫)`
        );
      }

      const calculatedTotal = calculatedSubtotal - parsedDiscount;

      // 4.4. Validate paidAmount
      const parsedPaid = Number(paidAmount) || 0;
      if (paymentMethod === "CASH" && parsedPaid < calculatedTotal) {
        throw new OrderValidationError(
          "paidAmount",
          `Số tiền khách đưa (${parsedPaid} ₫) không đủ thanh toán tổng đơn (${calculatedTotal} ₫)`
        );
      }

      if (paymentMethod === "TRANSFER" && parsedPaid < calculatedTotal) {
        throw new OrderValidationError(
          "paidAmount",
          `Số tiền chuyển khoản (${parsedPaid} ₫) phải bằng hoặc lớn hơn tổng đơn (${calculatedTotal} ₫)`
        );
      }

      const finalPaid =
        paymentMethod === "TRANSFER"
          ? calculatedTotal
          : Math.max(calculatedTotal, parsedPaid);
      const calculatedChange = Math.max(0, finalPaid - calculatedTotal);

      // 4.5. Sinh mã đơn tự tăng bằng Counter + SELECT ... FOR UPDATE
      const code = await generateOrderCode(tx);

      // 4.6. Lấy số thứ tự trong ngày theo shopId
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await tx.order.count({
        where: { shopId, createdAt: { gte: todayStart } },
      });
      const queueNumber = todayCount + 1;

      // 4.6.1. Tự động gắn đơn vào ca làm việc đang mở (Active Shift)
      let assignedShiftId = shiftId || null;
      if (!assignedShiftId) {
        const activeShift = await tx.shift.findFirst({
          where: { status: "OPEN", shopId },
          orderBy: { openedAt: "desc" },
        });
        if (activeShift) {
          assignedShiftId = activeShift.id;
        }
      }

      // 4.7. Tạo Order gắn shopId, staffId và shiftId
      const createdOrder = await tx.order.create({
        data: {
          code,
          shopId,
          staffId,
          shiftId: assignedShiftId,
          status: "PAID",
          orderType: orderType === "DINE_IN" ? "DINE_IN" : "TAKEAWAY",
          tableNumber: orderType === "DINE_IN" ? tableNumber : null,
          queueNumber,
          subtotal: calculatedSubtotal,
          discount: parsedDiscount,
          total: calculatedTotal,
          paidAmount: finalPaid,
          changeAmount: calculatedChange,
          paymentMethod,
          note: note ? String(note).trim() : null,
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          customerName: customerName ? String(customerName).trim() : null,
          pointsEarned: Math.floor(calculatedTotal / 10000),
          pointsUsed: Number(pointsUsed) || 0,
          items: {
            create: validatedItemsToCreate,
          },
        },
        include: {
          items: true,
        },
      });

      // 4.7.1. Cập nhật thống kê cho ca làm việc nếu có
      if (assignedShiftId) {
        await tx.shift.update({
          where: { id: assignedShiftId },
          data: {
            totalOrders: { increment: 1 },
            cashRevenue: paymentMethod === "CASH" ? { increment: calculatedTotal } : undefined,
            totalTransfer: paymentMethod === "TRANSFER" ? { increment: calculatedTotal } : undefined,
          },
        });
      }

      // 4.7.2. Trừ tồn kho nguyên liệu theo recipe & Ghi log biến động kho StockMovement
      for (const req of Array.from(requiredIngredients.values())) {
        const updatedIng = await tx.ingredient.update({
          where: { id: req.ingredientId },
          data: {
            stockQty: { decrement: req.requiredQty },
          },
        });

        await tx.stockMovement.create({
          data: {
            ingredientId: req.ingredientId,
            delta: -req.requiredQty,
            reason: "SALE",
            orderId: createdOrder.id,
          },
        });

        // Nếu nguyên liệu tồn kho cạn (stockQty <= 0), tự động đánh dấu outOfStock cho các món dùng nguyên liệu này
        if (updatedIng.stockQty <= 0) {
          const affectedRecipes = await tx.recipeItem.findMany({
            where: { ingredientId: req.ingredientId, productId: { not: null } },
            select: { productId: true },
          });
          const affectedProductIds = affectedRecipes
            .map((r) => r.productId)
            .filter(Boolean) as string[];

          if (affectedProductIds.length > 0) {
            await tx.product.updateMany({
              where: { id: { in: affectedProductIds } },
              data: { outOfStock: true },
            });
          }
        }
      }

      // 4.8. Lưu IdempotencyKey
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            orderId: createdOrder.id,
          },
        });
      }

      // 4.9. Cập nhật điểm thành viên
      if (customerPhone && String(customerPhone).trim()) {
        const phoneClean = String(customerPhone).trim();
        const earned = Math.floor(calculatedTotal / 10000);
        const used = Number(pointsUsed) || 0;

        await tx.customer.upsert({
          where: { phone: phoneClean },
          update: {
            points: { increment: earned - used },
            name: customerName || undefined,
          },
          create: {
            phone: phoneClean,
            name: customerName || "Khách quen",
            points: Math.max(0, earned - used),
          },
        });
      }

      // 4.10. Cập nhật trạng thái bàn
      if (orderType === "DINE_IN" && tableNumber) {
        await tx.restaurantTable.updateMany({
          where: { name: tableNumber },
          data: { status: "OCCUPIED", orderId: createdOrder.id },
        });
      }

      return createdOrder;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Tạo đơn hàng thành công!",
        data: newOrder,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof OrderValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            field: err.field,
            message: err.message,
            fields: { [err.field]: err.message },
          },
          message: err.message,
        },
        { status: err.status }
      );
    }

    if (err.code === "P2002" && idempotencyKey) {
      const existingIdempotency = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
        include: {
          order: {
            include: { items: true },
          },
        },
      });

      if (existingIdempotency?.order) {
        return NextResponse.json(
          {
            success: true,
            message: "Đơn hàng đã được tạo trước đó (Idempotent replay)",
            data: existingIdempotency.order,
          },
          {
            status: 200,
            headers: { "X-Idempotent-Replay": "true" },
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            field: "Idempotency-Key",
            message: "Xung đột Idempotency Key đang được xử lý đồng thời",
            fields: { "Idempotency-Key": "Khóa bị trùng lặp" },
          },
          message: "Xung đột Idempotency Key đang được xử lý đồng thời",
        },
        { status: 409 }
      );
    }

    console.error("Lỗi giao dịch tạo đơn hàng:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          field: "server",
          message: err?.message || "Đã xảy ra lỗi khi tạo đơn hàng",
          fields: { server: err?.message || "Internal error" },
        },
        message: err?.message || "Đã xảy ra lỗi khi tạo đơn hàng",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const shopId =
      session?.shopId || req.headers.get("x-user-shop-id") || "shop_default";

    const orders = await prisma.order.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: true,
      },
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn:", error);
    return NextResponse.json(
      { success: false, message: "Không thể lấy danh sách đơn hàng" },
      { status: 500 }
    );
  }
}
