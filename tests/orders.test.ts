import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST } from "@/app/api/orders/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

describe("API POST /api/orders - Transaction, Idempotency & Server-Side Validation", () => {
  let sampleProduct: any;
  let sampleVariant: any;
  let sampleTopping: any;

  beforeAll(async () => {
    // Lấy 1 sản phẩm mẫu có sẵn trong DB
    sampleProduct = await prisma.product.findFirst({
      where: { isActive: true },
      include: {
        variants: true,
        toppings: { include: { topping: true } },
      },
    });

    if (!sampleProduct) {
      throw new Error("Cần seed database trước khi chạy test");
    }

    sampleVariant = sampleProduct.variants[0];
    sampleTopping = sampleProduct.toppings[0]?.topping;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST 1: 2 REQUEST SONG SONG CÙNG IDEMPOTENCY-KEY CHỈ TẠO 1 ĐƠN HÀNG
  it("2 request song song cùng Idempotency-Key chỉ tạo đúng 1 đơn hàng duy nhất", async () => {
    const sharedKey = `test-idempotency-${randomUUID()}`;

    const orderPayload = {
      items: [
        {
          productId: sampleProduct.id,
          variantId: sampleVariant?.id,
          toppings: sampleTopping ? [{ id: sampleTopping.id }] : [],
          quantity: 2,
          note: "Giao hàng đồng thời",
        },
      ],
      discount: 0,
      paymentMethod: "CASH",
      paidAmount: 500000,
    };

    // Tạo 2 NextRequest đồng thời với cùng Idempotency-Key
    const req1 = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": sharedKey,
      },
      body: JSON.stringify(orderPayload),
    });

    const req2 = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": sharedKey,
      },
      body: JSON.stringify(orderPayload),
    });

    // Bắn 2 request song song cùng một thời điểm
    const [res1, res2] = await Promise.all([POST(req1), POST(req2)]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    // Cả 2 request đều thành công (mã 200 hoặc 201)
    expect([200, 201]).toContain(res1.status);
    expect([200, 201]).toContain(res2.status);
    expect(data1.success).toBe(true);
    expect(data2.success).toBe(true);

    // Cả 2 request phải trả về CÙNG 1 ĐƠN HÀNG (cùng ID và cùng Code)
    expect(data1.data.id).toBe(data2.data.id);
    expect(data1.data.code).toBe(data2.data.code);

    // Kiểm tra trực tiếp trong DB: Chỉ có duy nhất 1 bản ghi IdempotencyKey
    const dbKeyRecords = await prisma.idempotencyKey.findMany({
      where: { key: sharedKey },
    });
    expect(dbKeyRecords.length).toBe(1);

    // Kiểm tra số lượng order thực tế tạo ra cho key này trong DB
    const dbOrder = await prisma.order.findUnique({
      where: { id: data1.data.id },
      include: { items: true },
    });
    expect(dbOrder).not.toBeNull();
    expect(dbOrder?.code).toBe(data1.data.code);
  });

  // TEST 2: SERVER-SIDE PRICE VALIDATION (Bỏ qua giá lậu từ client)
  it("Server tự tính đơn giá từ DB, bỏ qua hoàn toàn giá client gửi", async () => {
    const key = `test-price-tamper-${randomUUID()}`;

    // Client cố tình gửi unitPrice = 1đ và lineTotal = 2đ
    const tamperedPayload = {
      items: [
        {
          productId: sampleProduct.id,
          variantId: sampleVariant?.id,
          toppings: sampleTopping ? [{ id: sampleTopping.id }] : [],
          quantity: 2,
          unitPrice: 1, // LẬU
          lineTotal: 2, // LẬU
        },
      ],
      discount: 0,
      paymentMethod: "CASH",
      paidAmount: 500000,
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(tamperedPayload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);

    // Tính giá thực tế từ DB
    const expectedUnitPrice =
      sampleProduct.basePrice + (sampleVariant?.extraPrice || 0);
    const expectedToppings = sampleTopping ? sampleTopping.price : 0;
    const expectedLineTotal = (expectedUnitPrice + expectedToppings) * 2;

    // Giá đã snapshot trong OrderItem phải là giá thực tế, không phải 1đ
    const orderItem = json.data.items[0];
    expect(orderItem.unitPrice).toBe(expectedUnitPrice);
    expect(orderItem.lineTotal).toBe(expectedLineTotal);
    expect(json.data.total).toBe(expectedLineTotal);
  });

  // TEST 3: VALIDATE QUANTITY PHẢI > 0 VÀ LÀ SỐ NGUYÊN (TRẢ 422 KÈM FIELD)
  it("Trả về lỗi 422 khi quantity <= 0 hoặc không phải số nguyên", async () => {
    const invalidPayload = {
      items: [
        {
          productId: sampleProduct.id,
          quantity: 0, // Không hợp lệ
        },
      ],
      discount: 0,
      paymentMethod: "CASH",
      paidAmount: 100000,
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.field).toBe("items[0].quantity");
  });

  // TEST 4: VALIDATE TIỀN KHÁCH ĐƯA (paidAmount < total TRẢ 422 KÈM FIELD)
  it("Trả về lỗi 422 khi tiền khách đưa nhỏ hơn tổng tiền (paidAmount < total)", async () => {
    const insufficientPayload = {
      items: [
        {
          productId: sampleProduct.id,
          quantity: 1,
        },
      ],
      discount: 0,
      paymentMethod: "CASH",
      paidAmount: 1000, // Quá ít so với ly nước 25k-40k
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(insufficientPayload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.field).toBe("paidAmount");
  });

  // TEST 5: VALIDATE DISCOUNT ÂM HOẶC VƯỢT QUÁ SUBTOTAL (TRẢ 422 KÈM FIELD)
  it("Trả về lỗi 422 khi discount âm hoặc vượt quá subtotal", async () => {
    const invalidDiscountPayload = {
      items: [
        {
          productId: sampleProduct.id,
          quantity: 1,
        },
      ],
      discount: -5000, // Âm
      paymentMethod: "CASH",
      paidAmount: 100000,
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidDiscountPayload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.field).toBe("discount");
  });

  // TEST 6: VALIDATE TOPPING KHÔNG THUỘC SẢN PHẨM (TRẢ 422 KÈM FIELD)
  it("Trả về lỗi 422 khi topping không thuộc sản phẩm", async () => {
    const fakeToppingPayload = {
      items: [
        {
          productId: sampleProduct.id,
          toppings: [{ id: "topping-khong-ton-tai-xyz" }],
          quantity: 1,
        },
      ],
      discount: 0,
      paymentMethod: "CASH",
      paidAmount: 100000,
    };

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeToppingPayload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.field).toBe("items[0].toppings[0]");
  });
});
