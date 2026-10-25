/**
 * Định dạng số thành định dạng tiền tệ Việt Nam Đồng (VND).
 * Ví dụ: 12000 -> "12.000 ₫"
 */
export function formatVND(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0 ₫";
  }
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " ₫";
}

/**
 * Chuyển chuỗi tiền tệ hoặc số thành giá trị số nguyên.
 * Ví dụ: "12.000 ₫" -> 12000
 */
export function parseVND(value: string | number): number {
  if (typeof value === "number") {
    return isNaN(value) ? 0 : Math.round(value);
  }
  if (!value) return 0;
  const cleaned = String(value).replace(/[^\d-]/g, "");
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Làm tròn tiền mặt theo mệnh giá quy định (mặc định 500 ₫ hoặc 1.000 ₫)
 * Ví dụ: roundToCashUnit(45200, 500) -> 45500 hoặc 45000
 */
export function roundToCashUnit(amount: number, unit: 500 | 1000 = 1000): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  return Math.round(amount / unit) * unit;
}

export interface OrderCalculationInput {
  subtotal: number;
  discount?: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | string;
}

export interface OrderCalculationResult {
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  isSufficient: boolean;
}

/**
 * Tính toán tiền đơn hàng POS: subtotal, discount, total, paidAmount, changeAmount
 * Đảm bảo:
 * - discount >= 0 và <= subtotal
 * - total không âm
 * - changeAmount >= 0 (tiền thối lại cho khách)
 * - Đối với chuyển khoản TRANSFER: paidAmount = total, changeAmount = 0
 */
export function calculateOrderAmounts(input: OrderCalculationInput): OrderCalculationResult {
  const subtotal = Math.max(0, Math.round(Number(input.subtotal) || 0));
  let discount = Math.max(0, Math.round(Number(input.discount) || 0));

  // Discount không được vượt quá subtotal
  if (discount > subtotal) {
    discount = subtotal;
  }

  const total = subtotal - discount;
  const paymentMethod = input.paymentMethod || "CASH";

  if (paymentMethod === "TRANSFER") {
    return {
      subtotal,
      discount,
      total,
      paidAmount: total,
      changeAmount: 0,
      isSufficient: true,
    };
  }

  const rawPaid = Math.max(0, Math.round(Number(input.paidAmount) || 0));
  const changeAmount = Math.max(0, rawPaid - total);
  const isSufficient = rawPaid >= total;

  return {
    subtotal,
    discount,
    total,
    paidAmount: rawPaid,
    changeAmount,
    isSufficient,
  };
}
