import { z } from "zod";

/**
 * Schema Topping đính kèm từng ly
 */
export const ToppingItemSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  price: z.number().int().nonnegative("Giá topping không được âm").optional(),
});

/**
 * Schema từng món trong giỏ hàng / hóa đơn
 * Hỗ trợ cả client gửi đầy đủ snapshot lẫn client chỉ gửi ID để server tự tính
 */
export const CreateOrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().nullable().optional(),
  name: z.string().optional(),
  variantId: z.string().nullable().optional(),
  variantName: z.string().nullable().optional(),
  unitPrice: z.number().int().nonnegative("Đơn giá không được âm").optional(),
  quantity: z
    .number()
    .int("Số lượng phải là số nguyên")
    .positive("Số lượng phải lớn hơn 0")
    .optional(),
  lineTotal: z.number().int().nonnegative("Thành tiền không được âm").optional(),
  toppings: z
    .union([z.array(z.any()), z.string()])
    .optional()
    .default([]),
  note: z.string().max(255, "Ghi chú món tối đa 255 ký tự").nullable().optional(),
});

/**
 * Schema tạo đơn hàng mới (POST /api/orders)
 * Dùng chung cho Client kiểm tra trước khi gửi và Server xác thực 100%
 */
export const CreateOrderSchema = z
  .object({
    items: z
      .array(CreateOrderItemSchema)
      .min(1, "Đơn hàng phải có ít nhất 1 món đồ uống"),
    subtotal: z.number().int().nonnegative("Tạm tính không được âm").optional(),
    discount: z.number().int().default(0),
    total: z.number().int().nonnegative("Tổng tiền không được âm").optional(),
    paidAmount: z.number().int().nonnegative("Tiền khách đưa không được âm").optional().default(0),
    paymentMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
    orderType: z.enum(["TAKEAWAY", "DINE_IN"]).default("TAKEAWAY"),
    tableNumber: z.string().max(50, "Số bàn tối đa 50 ký tự").nullable().optional(),
    customerPhone: z
      .string()
      .max(15, "Số điện thoại không hợp lệ")
      .nullable()
      .optional(),
    customerName: z.string().max(100, "Tên khách tối đa 100 ký tự").nullable().optional(),
    note: z.string().max(500, "Ghi chú tối đa 500 ký tự").nullable().optional(),
    pointsUsed: z.number().int().nonnegative("Điểm sử dụng không được âm").default(0),
    shiftId: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.orderType === "DINE_IN" && !data.tableNumber?.trim()) {
        return false;
      }
      return true;
    },
    {
      message: "Vui lòng chọn hoặc nhập số bàn cho đơn tại quán",
      path: ["tableNumber"],
    }
  );

/**
 * Schema quản lý món nước (Product)
 */
export const ProductSchema = z.object({
  name: z.string().min(1, "Tên món không được để trống").max(100, "Tên món quá dài"),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục cho món"),
  basePrice: z.number().int().positive("Giá cơ bản phải lớn hơn 0 ₫"),
  imageUrl: z.string().url("Đường dẫn hình ảnh không hợp lệ").nullable().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, "Tên size/biến thể không được để trống"),
        extraPrice: z.number().int().nonnegative("Giá cộng thêm không được âm"),
      })
    )
    .optional()
    .default([]),
  toppingIds: z.array(z.string()).optional().default([]),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>;
export type ProductInput = z.infer<typeof ProductSchema>;

/**
 * Tiện ích định dạng lỗi Zod thành dictionary và chuỗi mô tả thân thiện
 * Chuyển ["items", 0, "quantity"] thành "items[0].quantity"
 */
export function formatZodError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  const messages: string[] = [];

  for (const issue of error.issues) {
    let fieldPath = "";
    for (let i = 0; i < issue.path.length; i++) {
      const part = issue.path[i];
      if (typeof part === "number") {
        fieldPath += `[${part}]`;
      } else {
        const strPart = String(part);
        fieldPath += fieldPath ? `.${strPart}` : strPart;
      }
    }
    if (!fieldPath) fieldPath = "general";

    if (!fields[fieldPath]) {
      fields[fieldPath] = issue.message;
      messages.push(issue.message);
    }
  }

  return {
    fields,
    firstMessage: messages[0] || "Dữ liệu nhập không hợp lệ",
    allMessages: messages,
  };
}
