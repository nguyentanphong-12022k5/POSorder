import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";
import { createAuthToken, verifyAuthToken } from "@/lib/auth";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as orderByIdGET } from "@/app/api/orders/[id]/route";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

describe("Lớp Bảo Mật Hệ Thống - Auth, Rate Limit, Anti-IDOR", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // TEST 1: RATE LIMIT TỐI ĐA 30 REQUEST / PHÚT / IP
  it("Rate limit: Chặn request thứ 31 từ cùng 1 IP trong vòng 1 phút (HTTP 429)", () => {
    const testIp = `192.168.1.${Math.floor(Math.random() * 250) + 1}`;

    // Gửi 30 request đầu tiên -> Được phép
    for (let i = 1; i <= 30; i++) {
      const result = checkRateLimit(testIp, 30, 60000);
      expect(result.allowed).toBe(true);
    }

    // Request thứ 31 -> Bị từ chối
    const blockedResult = checkRateLimit(testIp, 30, 60000);
    expect(blockedResult.allowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
    expect(blockedResult.resetSeconds).toBeGreaterThan(0);
  });

  // TEST 2: KÝ VÀ XÁC THỰC TOKEN PHIÊN ĐĂNG NHẬP
  it("Ký và xác thực HMAC-SHA256 Token cho phiên đăng nhập", async () => {
    const userPayload = {
      id: "user_test_123",
      email: "staff@pos.vn",
      role: "staff" as const,
      name: "Thu ngân Test",
      shopId: "shop_alpha",
    };

    const token = await createAuthToken(userPayload);
    expect(token).toBeDefined();
    expect(token.split(".").length).toBe(3);

    const verifiedUser = await verifyAuthToken(token);
    expect(verifiedUser).not.toBeNull();
    expect(verifiedUser?.email).toBe(userPayload.email);
    expect(verifiedUser?.role).toBe("staff");
    expect(verifiedUser?.shopId).toBe("shop_alpha");

    // Token bị sửa chữ ký -> Bị từ chối
    const tamperedToken = token.slice(0, -4) + "XXXX";
    const invalidUser = await verifyAuthToken(tamperedToken);
    expect(invalidUser).toBeNull();
  });

  // TEST 3: API ĐĂNG NHẬP VỚI PROFILE CSDL
  it("Đăng nhập thành công với admin@pos.vn / admin123", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@pos.vn", password: "admin123" }),
    });

    const res = await loginPOST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.role).toBe("admin");
    expect(res.cookies.get("pos_session")?.value).toBeDefined();
  });

  it("Từ chối đăng nhập khi sai mật khẩu (HTTP 401)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@pos.vn", password: "wrong_password" }),
    });

    const res = await loginPOST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  // TEST 4: CHỐNG IDOR KHI TRUY VẤN ORDER THEO SHOP_ID
  it("Chống IDOR: Không thể đọc đơn hàng thuộc chi nhánh/shopId khác", async () => {
    // Tạo 1 đơn thuộc shop_other
    const foreignOrder = await prisma.order.create({
      data: {
        code: `HD_TEST_${Date.now()}`,
        shopId: "shop_other",
        status: "PAID",
        subtotal: 30000,
        total: 30000,
        paidAmount: 30000,
        items: {
          create: [
            {
              name: "Cà phê đen",
              unitPrice: 30000,
              quantity: 1,
              lineTotal: 30000,
              toppings: "[]",
            },
          ],
        },
      },
    });

    // Tạo request từ nhân viên thuộc shop_default (không phải shop_other)
    const staffToken = await createAuthToken({
      id: "staff_1",
      email: "staff@pos.vn",
      role: "staff",
      name: "Thu ngân",
      shopId: "shop_default",
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${foreignOrder.id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${staffToken}`,
      },
    });

    const res = await orderByIdGET(req, { params: { id: foreignOrder.id } });
    const json = await res.json();

    // Phải trả về 404 chống rò rỉ IDOR
    expect(res.status).toBe(404);
    expect(json.success).toBe(false);

    // Xoá đơn test
    await prisma.orderItem.deleteMany({ where: { orderId: foreignOrder.id } });
    await prisma.order.delete({ where: { id: foreignOrder.id } });
  });
});
