import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { POST as createOrderHandler } from "@/app/api/orders/route";
import { POST as cancelOrderHandler } from "@/app/api/orders/[id]/cancel/route";
import { GET as getReportsHandler } from "@/app/api/reports/route";

describe("2. Integration Tests: POS Orders & Reporting Lifecycle", () => {
  const shopId = "shop_integ_unique";
  let sampleProduct: any;
  let sampleVariant: any;
  let sampleTopping: any;

  beforeAll(async () => {
    // 1. Chuẩn bị dữ liệu mẫu (Category, Product, Variant, Topping)
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({
        data: { name: "Trà sữa Đặc biệt", sort: 1 },
      });
    }

    sampleProduct = await prisma.product.findFirst({
      where: { name: "Trà sữa Ô Long Hoàng Gia" },
      include: { variants: true, toppings: { include: { topping: true } } },
    });

    if (!sampleProduct) {
      sampleProduct = await prisma.product.create({
        data: {
          name: "Trà sữa Ô Long Hoàng Gia",
          categoryId: category.id,
          basePrice: 45000,
          isActive: true,
          variants: {
            create: [
              { name: "Size M", extraPrice: 0 },
              { name: "Size L", extraPrice: 8000 },
            ],
          },
        },
        include: { variants: true, toppings: true },
      });
    }

    sampleVariant = sampleProduct.variants.find((v: any) => v.name === "Size L") || sampleProduct.variants[0];

    sampleTopping = await prisma.topping.findFirst({
      where: { name: "Trân châu hoàng kim" },
    });
    if (!sampleTopping) {
      sampleTopping = await prisma.topping.create({
        data: { name: "Trân châu hoàng kim", price: 10000 },
      });
      await prisma.toppingOnProduct.create({
        data: {
          productId: sampleProduct.id,
          toppingId: sampleTopping.id,
        },
      });
    } else {
      const topLink = await prisma.toppingOnProduct.findFirst({
        where: { productId: sampleProduct.id, toppingId: sampleTopping.id },
      });
      if (!topLink) {
        await prisma.toppingOnProduct.create({
          data: { productId: sampleProduct.id, toppingId: sampleTopping.id },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("2.1. Tạo đơn thành công -> Snapshot OrderItem lưu cứng giá, tên, toppings JSON", async () => {
    const idempotencyKey = `integ-snap-${Date.now()}`;
    const orderPayload = {
      items: [
        {
          productId: sampleProduct.id,
          variantId: sampleVariant.id,
          toppings: [{ id: sampleTopping.id }],
          quantity: 2,
          note: "Ít đường 50%, nhiều đá",
        },
      ],
      orderType: "TAKEAWAY",
      paymentMethod: "CASH",
      discount: 10000,
      paidAmount: 200000,
      note: "Giao tận tay",
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "x-user-shop-id": shopId,
      },
      body: JSON.stringify(orderPayload),
    });

    const res = await createOrderHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    const orderId = json.data.id;

    // Kiểm tra Snapshot chi tiết trong Database
    const savedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    expect(savedOrder).toBeDefined();
    expect(savedOrder?.code).toMatch(/^HD/);
    expect(savedOrder?.status).toBe("PAID");
    expect(savedOrder?.items.length).toBe(1);

    const itemSnapshot = savedOrder?.items[0]!;
    // Snapshot tên món
    expect(itemSnapshot.name).toBe(sampleProduct.name);
    // Snapshot biến thể (Size L)
    expect(itemSnapshot.variantName).toBe(sampleVariant.name);
    // Snapshot đơn giá: basePrice (45k) + variantExtra (8k) = 53k
    expect(itemSnapshot.unitPrice).toBe(sampleProduct.basePrice + sampleVariant.extraPrice);
    // Snapshot topping JSON
    const parsedToppings = JSON.parse(itemSnapshot.toppings);
    expect(Array.isArray(parsedToppings)).toBe(true);
    expect(parsedToppings[0].id).toBe(sampleTopping.id);
    expect(parsedToppings[0].name).toBe(sampleTopping.name);
    expect(parsedToppings[0].price).toBe(sampleTopping.price);

    // Thành tiền dòng: (53k + 10k topping) * 2 = 126k
    expect(itemSnapshot.lineTotal).toBe(126000);
    // Tổng đơn: 126k - 10k discount = 116k
    expect(savedOrder?.total).toBe(116000);
    expect(savedOrder?.paidAmount).toBe(200000);
    expect(savedOrder?.changeAmount).toBe(84000);
  });

  it("2.2. Idempotency-Key trùng -> Trả lại đơn cũ thay vì tạo mới (Chỉ tạo 1 đơn)", async () => {
    const fixedKey = `integ-idemp-${Date.now()}`;
    const payload = {
      items: [
        {
          productId: sampleProduct.id,
          variantId: sampleVariant.id,
          quantity: 1,
        },
      ],
      paymentMethod: "CASH",
      paidAmount: 60000,
    };

    const makeRequest = () =>
      new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": fixedKey,
          "x-user-shop-id": shopId,
        },
        body: JSON.stringify(payload),
      });

    // Request 1: Tạo đơn lần đầu
    const res1 = await createOrderHandler(makeRequest());
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    const createdId = json1.data.id;

    // Request 2: Gửi lại cùng Idempotency-Key
    const res2 = await createOrderHandler(makeRequest());
    expect(res2.status).toBe(200);
    const json2 = await res2.json();

    // Phải trả về cùng đơn hàng cũ
    expect(json2.data.id).toBe(createdId);
    expect(res2.headers.get("X-Idempotent-Replay")).toBe("true");

    // Xác nhận trong DB chỉ có duy nhất 1 bản ghi với key này
    const count = await prisma.idempotencyKey.count({
      where: { key: fixedKey },
    });
    expect(count).toBe(1);
  });

  it("2.3. 2 request song song -> Mã hóa đơn không bao giờ trùng nhau (Counter + Atomic)", async () => {
    const payloadA = {
      items: [{ productId: sampleProduct.id, quantity: 1 }],
      paymentMethod: "CASH",
      paidAmount: 50000,
    };
    const payloadB = {
      items: [{ productId: sampleProduct.id, quantity: 1 }],
      paymentMethod: "CASH",
      paidAmount: 50000,
    };

    const reqA = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `concurrent-A-${Date.now()}`,
        "x-user-shop-id": shopId,
      },
      body: JSON.stringify(payloadA),
    });

    const reqB = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `concurrent-B-${Date.now()}`,
        "x-user-shop-id": shopId,
      },
      body: JSON.stringify(payloadB),
    });

    // Chạy đồng thời cả 2 request
    const [resA, resB] = await Promise.all([createOrderHandler(reqA), createOrderHandler(reqB)]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);

    const jsonA = await resA.json();
    const jsonB = await resB.json();

    // Mã đơn hàng bắt buộc phải khác nhau
    expect(jsonA.data.code).not.toBe(jsonB.data.code);
    expect(jsonA.data.id).not.toBe(jsonB.data.id);
  });

  it("2.4. Hủy đơn -> Báo cáo doanh thu tự động loại trừ đơn CANCELLED", async () => {
    // 1. Tạo đơn hàng 100k
    const createReq = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `cancel-integ-${Date.now()}`,
        "x-user-shop-id": shopId,
      },
      body: JSON.stringify({
        items: [{ productId: sampleProduct.id, quantity: 2 }],
        paymentMethod: "CASH",
        paidAmount: 100000,
      }),
    });

    const createRes = await createOrderHandler(createReq);
    expect(createRes.status).toBe(201);
    const createdJson = await createRes.json();
    const orderToCancel = createdJson.data;

    // 2. Lấy báo cáo trước khi hủy
    const repBeforeReq = new NextRequest("http://localhost:3000/api/reports?period=month", {
      headers: { "x-user-shop-id": shopId },
    });
    const repBeforeRes = await getReportsHandler(repBeforeReq);
    const repBeforeJson = await repBeforeRes.json();
    const revBefore = repBeforeJson.data.kpi.totalRevenue;

    // 3. Thực hiện hủy đơn hàng với quyền admin
    const cancelReq = new NextRequest(
      `http://localhost:3000/api/orders/${orderToCancel.id}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": "admin",
          "x-user-shop-id": shopId,
        },
        body: JSON.stringify({ reason: "Khách đổi ý muốn hủy đơn" }),
      }
    );

    const cancelRes = await cancelOrderHandler(cancelReq, {
      params: { id: orderToCancel.id },
    });
    expect(cancelRes.status).toBe(200);

    const cancelledData = await cancelRes.json();
    expect(cancelledData.success).toBe(true);
    expect(cancelledData.data.status).toBe("CANCELLED");
    expect(cancelledData.data.cancelReason).toBe("Khách đổi ý muốn hủy đơn");

    // 4. Lấy báo cáo sau khi hủy
    const repAfterReq = new NextRequest("http://localhost:3000/api/reports?period=month", {
      headers: { "x-user-shop-id": shopId },
    });
    const repAfterRes = await getReportsHandler(repAfterReq);
    const repAfterJson = await repAfterRes.json();
    const revAfter = repAfterJson.data.kpi.totalRevenue;

    // Doanh thu sau khi hủy phải giảm đúng bằng tổng tiền đơn bị hủy
    expect(revAfter).toBe(revBefore - orderToCancel.total);
    // Báo cáo ghi nhận thêm 1 đơn hủy
    expect(repAfterJson.data.kpi.totalCancelledOrders).toBeGreaterThanOrEqual(1);
  });
});
