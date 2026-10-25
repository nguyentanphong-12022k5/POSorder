import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { POST as shiftPost, GET as shiftGet } from "../app/api/shifts/route";
import { GET as shiftDetailGet } from "../app/api/shifts/[id]/route";
import { POST as orderPost } from "../app/api/orders/route";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

describe("Module Ca Làm Việc (Shifts Management & Cash Reconciliation)", () => {
  let sampleStaff: any;
  let sampleProduct: any;
  let testShiftId: string;

  beforeAll(async () => {
    // 1. Tạo hoặc lấy nhân viên test
    sampleStaff = await prisma.profile.findFirst({
      where: { role: "staff" },
    });
    if (!sampleStaff) {
      sampleStaff = await prisma.profile.create({
        data: {
          email: `staff_shift_${Date.now()}@pos.vn`,
          password: "password123",
          role: "staff",
          name: "Thu ngân Test",
          shopId: "shop_default",
        },
      });
    }

    // 2. Lấy sản phẩm test
    sampleProduct = await prisma.product.findFirst({
      where: { isActive: true },
    });
  });

  it("1. Mở ca làm việc mới: lưu openingCash, status = 'OPEN'", async () => {
    const req = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sampleStaff.id,
      },
      body: JSON.stringify({
        action: "OPEN",
        staffName: sampleStaff.name,
        openingCash: 500000,
        note: "Tiền lẻ đầu ngày",
      }),
    });

    const res = await shiftPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("OPEN");
    expect(json.data.openingCash).toBe(500000);
    expect(json.data.expectedCash).toBe(500000);

    testShiftId = json.data.id;
  });

  it("2. Mọi đơn hàng tạo trong ca tự động được gắn shiftId của ca đang mở", async () => {
    const idempotencyKey = `order-shift-test-${randomUUID()}`;

    const req = new NextRequest("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "x-user-id": sampleStaff.id,
      },
      body: JSON.stringify({
        items: [
          {
            productId: sampleProduct.id,
            quantity: 2,
          },
        ],
        discount: 0,
        paymentMethod: "CASH",
        paidAmount: 200000,
      }),
    });

    const res = await orderPost(req);
    const json = await res.json();

    expect([200, 201]).toContain(res.status);
    expect(json.success).toBe(true);
    // Đơn hàng PHẢI được tự động gắn shiftId của ca đang mở!
    expect(json.data.shiftId).toBe(testShiftId);

    // Kiểm tra trực tiếp trong DB
    const dbOrder = await prisma.order.findUnique({
      where: { id: json.data.id },
    });
    expect(dbOrder?.shiftId).toBe(testShiftId);
  });

  it("3. Đóng ca làm việc: tổng hợp doanh thu tiền mặt, tính tiền dự kiến và chênh lệch két", async () => {
    // Giả sử thu ngân đếm tiền két thực tế được 600,000đ
    const actualCountedCash = 600000;

    const req = new NextRequest("http://localhost:3000/api/shifts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": sampleStaff.id,
      },
      body: JSON.stringify({
        action: "CLOSE",
        closingCash: actualCountedCash,
        note: "Bàn giao ca 1 cho ca 2",
      }),
    });

    const res = await shiftPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("CLOSED");
    expect(json.data.closedAt).not.toBeNull();
    expect(json.data.closingCash).toBe(actualCountedCash);

    // expectedCash = openingCash + cashRevenue
    expect(json.data.expectedCash).toBe(
      json.data.openingCash + json.data.cashRevenue
    );

    // cashDifference = closingCash - expectedCash
    expect(json.data.cashDifference).toBe(
      actualCountedCash - json.data.expectedCash
    );
  });

  it("4. Chi tiết ca GET /api/shifts/[id]: trả về danh sách đơn và thống kê món", async () => {
    const req = new NextRequest(`http://localhost:3000/api/shifts/${testShiftId}`, {
      method: "GET",
    });

    const res = await shiftDetailGet(req, { params: { id: testShiftId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testShiftId);
    expect(Array.isArray(json.data.orders)).toBe(true);
    expect(json.data.orders.length).toBeGreaterThanOrEqual(1);
    expect(json.data.orders[0].shiftId).toBe(testShiftId);
    expect(Array.isArray(json.data.topItems)).toBe(true);
  });

  it("5. Admin xem danh sách ca và lọc theo trạng thái CLOSED", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/shifts?status=CLOSED",
      { method: "GET" }
    );

    const res = await shiftGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data.shifts)).toBe(true);
    // Tất cả ca trong danh sách lọc phải có status = "CLOSED"
    for (const shift of json.data.shifts) {
      expect(shift.status).toBe("CLOSED");
    }
  });
});
