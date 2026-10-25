import { describe, it, expect } from "vitest";
import { CreateOrderSchema, ProductSchema, formatZodError } from "../lib/validations/schemas";
import { formatFriendlyErrorMessage, createApiErrorResponse } from "../lib/errors";
import { POST as createOrderPost } from "../app/api/orders/route";
import { NextRequest } from "next/server";

describe("Độ Bền Vững Hệ Thống (Resilience, Zod, Error Handling)", () => {
  // 1. Kiểm tra Zod CreateOrderSchema
  describe("1. Zod Schema dùng chung Client + Server", () => {
    it("Bắt lỗi khi giỏ hàng rỗng (items = [])", () => {
      const result = CreateOrderSchema.safeParse({
        items: [],
        paymentMethod: "CASH",
        paidAmount: 50000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const { firstMessage } = formatZodError(result.error);
        expect(firstMessage).toContain("ít nhất 1 món");
      }
    });

    it("Bắt lỗi khi chọn DINE_IN nhưng không nhập số bàn", () => {
      const result = CreateOrderSchema.safeParse({
        items: [
          {
            name: "Trà đào cam sả",
            unitPrice: 35000,
            quantity: 1,
            lineTotal: 35000,
          },
        ],
        orderType: "DINE_IN",
        tableNumber: "", // Thiếu bàn
        paymentMethod: "CASH",
        paidAmount: 35000,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const { firstMessage } = formatZodError(result.error);
        expect(firstMessage).toContain("số bàn");
      }
    });

    it("Bắt lỗi ProductSchema khi giá cơ bản <= 0", () => {
      const result = ProductSchema.safeParse({
        name: "Cà phê đen",
        categoryId: "cat_1",
        basePrice: -5000, // Giá âm
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const { firstMessage } = formatZodError(result.error);
        expect(firstMessage).toContain("lớn hơn 0");
      }
    });
  });

  // 2. Kiểm tra chuẩn format lỗi API: { error: { code, message, fields } }
  describe("2. Chuẩn hóa format lỗi API: { error: { code, message, fields? } }", () => {
    it("Trả về cấu trúc { error: { code, message, fields } } chuẩn mực", async () => {
      const res = createApiErrorResponse(
        "VALIDATION_ERROR",
        "Số lượng món không hợp lệ",
        422,
        { "items.0.quantity": "Phải lớn hơn 0" }
      );

      const json = await res.json();
      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toBe("Số lượng món không hợp lệ");
      expect(json.error.fields).toEqual({ "items.0.quantity": "Phải lớn hơn 0" });
    });

    it("API POST /api/orders trả về lỗi chuẩn khi dữ liệu không qua được Zod", async () => {
      const req = new NextRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [], // Trống
          paymentMethod: "CASH",
          paidAmount: 0,
        }),
      });

      const res = await createOrderPost(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("ít nhất 1 món");
      expect(json.error.fields).toBeDefined();
    });
  });

  // 3. Toast lỗi thân thiện tiếng Việt (chống show raw technical errors)
  describe("3. Format lỗi thân thiện tiếng Việt, che giấu raw error", () => {
    it("Chuyển TypeError: Failed to fetch thành thông báo mạng tiếng Việt", () => {
      const friendly = formatFriendlyErrorMessage(new TypeError("Failed to fetch"));
      expect(friendly).toContain("mạng");
      expect(friendly).not.toContain("TypeError");
    });

    it("Chuyển lỗi Prisma thành thông báo xung đột dễ hiểu", () => {
      const friendly = formatFriendlyErrorMessage(
        new Error("PrismaClientKnownRequestError: Unique constraint failed")
      );
      expect(friendly).toContain("xung đột");
      expect(friendly).not.toContain("PrismaClientKnownRequestError");
    });

    it("Trích xuất thông điệp từ response chuẩn { error: { message } }", () => {
      const friendly = formatFriendlyErrorMessage({
        error: {
          code: "VALIDATION_ERROR",
          message: "Số tiền khách đưa chưa đủ",
        },
      });
      expect(friendly).toBe("Số tiền khách đưa chưa đủ");
    });
  });
});
