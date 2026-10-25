import { describe, it, expect } from "vitest";
import {
  formatVND,
  parseVND,
  roundToCashUnit,
  calculateOrderAmounts,
} from "@/lib/money";

describe("1. Unit Tests: lib/money", () => {
  describe("formatVND", () => {
    it("Định dạng số nguyên dương thành tiền tệ Việt Nam", () => {
      expect(formatVND(10000)).toMatch(/10[.,]000\s?₫/);
      expect(formatVND(1500000)).toMatch(/1[.,]500[.,]000\s?₫/);
      expect(formatVND(50000)).toMatch(/50[.,]000\s?₫/);
    });

    it("Định dạng giá trị 0", () => {
      expect(formatVND(0)).toMatch(/0\s?₫/);
    });

    it("Xử lý an toàn null, undefined, NaN", () => {
      expect(formatVND(null)).toBe("0 ₫");
      expect(formatVND(undefined)).toBe("0 ₫");
      expect(formatVND(NaN)).toBe("0 ₫");
    });

    it("Làm tròn số thập phân trước khi định dạng", () => {
      expect(formatVND(12345.6)).toMatch(/12[.,]346\s?₫/);
      expect(formatVND(12345.4)).toMatch(/12[.,]345\s?₫/);
    });
  });

  describe("parseVND", () => {
    it("Chuyển chuỗi tiền tệ tiếng Việt thành số nguyên", () => {
      expect(parseVND("12.000 ₫")).toBe(12000);
      expect(parseVND("1,500,000 ₫")).toBe(1500000);
      expect(parseVND("50.000")).toBe(50000);
    });

    it("Xử lý kiểu number đầu vào", () => {
      expect(parseVND(12345)).toBe(12345);
      expect(parseVND(12345.7)).toBe(12346);
      expect(parseVND(NaN)).toBe(0);
    });

    it("Xử lý chuỗi rỗng và chuỗi không hợp lệ", () => {
      expect(parseVND("")).toBe(0);
      expect(parseVND("abc")).toBe(0);
      expect(parseVND(null as any)).toBe(0);
    });
  });

  describe("roundToCashUnit (Làm tròn tiền mặt)", () => {
    it("Làm tròn về mệnh giá 1.000 ₫ gần nhất", () => {
      expect(roundToCashUnit(45200, 1000)).toBe(45000);
      expect(roundToCashUnit(45600, 1000)).toBe(46000);
      expect(roundToCashUnit(45500, 1000)).toBe(46000);
    });

    it("Làm tròn về mệnh giá 500 ₫ gần nhất", () => {
      expect(roundToCashUnit(45200, 500)).toBe(45000);
      expect(roundToCashUnit(45300, 500)).toBe(45500);
      expect(roundToCashUnit(45700, 500)).toBe(45500);
      expect(roundToCashUnit(45800, 500)).toBe(46000);
    });

    it("Xử lý số <= 0", () => {
      expect(roundToCashUnit(0)).toBe(0);
      expect(roundToCashUnit(-500)).toBe(0);
    });
  });

  describe("calculateOrderAmounts (Tính total, discount, change)", () => {
    it("Tính đúng tổng tiền và tiền thối khi khách đưa đủ tiền mặt", () => {
      const result = calculateOrderAmounts({
        subtotal: 100000,
        discount: 20000,
        paidAmount: 100000,
        paymentMethod: "CASH",
      });

      expect(result.subtotal).toBe(100000);
      expect(result.discount).toBe(20000);
      expect(result.total).toBe(80000);
      expect(result.paidAmount).toBe(100000);
      expect(result.changeAmount).toBe(20000); // 100k - 80k = 20k
      expect(result.isSufficient).toBe(true);
    });

    it("Khách đưa thiếu tiền mặt -> isSufficient = false, changeAmount = 0", () => {
      const result = calculateOrderAmounts({
        subtotal: 100000,
        discount: 10000,
        paidAmount: 50000,
        paymentMethod: "CASH",
      });

      expect(result.total).toBe(90000);
      expect(result.paidAmount).toBe(50000);
      expect(result.changeAmount).toBe(0);
      expect(result.isSufficient).toBe(false);
    });

    it("Clamp discount nếu discount âm hoặc discount > subtotal", () => {
      // Giảm giá âm -> clamp về 0
      const negativeDiscount = calculateOrderAmounts({
        subtotal: 50000,
        discount: -10000,
        paidAmount: 50000,
      });
      expect(negativeDiscount.discount).toBe(0);
      expect(negativeDiscount.total).toBe(50000);

      // Giảm giá vượt quá subtotal -> clamp về subtotal (total = 0, không âm)
      const excessDiscount = calculateOrderAmounts({
        subtotal: 50000,
        discount: 80000,
        paidAmount: 0,
      });
      expect(excessDiscount.discount).toBe(50000);
      expect(excessDiscount.total).toBe(0);
      expect(excessDiscount.changeAmount).toBe(0);
      expect(excessDiscount.isSufficient).toBe(true);
    });

    it("Phương thức Chuyển khoản QR (TRANSFER) tự động gán paidAmount = total, change = 0", () => {
      const result = calculateOrderAmounts({
        subtotal: 120000,
        discount: 20000,
        paidAmount: 0,
        paymentMethod: "TRANSFER",
      });

      expect(result.total).toBe(100000);
      expect(result.paidAmount).toBe(100000);
      expect(result.changeAmount).toBe(0);
      expect(result.isSufficient).toBe(true);
    });
  });
});
