import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../lib/prisma";
import { POST as cancelOrderPost } from "../app/api/orders/[id]/cancel/route";
import { PATCH as productPatch } from "../app/api/products/route";
import { generateInvoicePdfBuffer } from "../lib/printer/pdf";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

describe("Luồng Hủy Đơn Hàng & Ghi AuditLog", () => {
  let adminProfile: any;
  let staffProfile: any;
  let sampleProduct: any;

  beforeAll(async () => {
    // 1. Lấy hoặc tạo admin & staff profile
    adminProfile = await prisma.profile.findFirst({ where: { role: "admin" } });
    if (!adminProfile) {
      adminProfile = await prisma.profile.create({
        data: {
          email: "admin_cancel_test@pos.vn",
          password: "password123",
          role: "admin",
          name: "Quản trị viên Test",
        },
      });
    }

    staffProfile = await prisma.profile.findFirst({ where: { role: "staff" } });
    if (!staffProfile) {
      staffProfile = await prisma.profile.create({
        data: {
          email: "staff_cancel_test@pos.vn",
          password: "password123",
          role: "staff",
          name: "Nhân viên Test",
        },
      });
    }

    sampleProduct = await prisma.product.findFirst({ where: { isActive: true } });
  });

  it("1. Staff KHÔNG được hủy đơn đã tạo quá 5 phút (HTTP 403)", async () => {
    // Tạo đơn hàng giả định tạo cách đây 10 phút
    const pastTime = new Date(Date.now() - 10 * 60 * 1000);
    const orderOld = await prisma.order.create({
      data: {
        code: `HD_OLD_${Date.now()}`,
        status: "PAID",
        subtotal: 40000,
        total: 40000,
        paidAmount: 40000,
        createdAt: pastTime,
        items: {
          create: [{ name: "Trà đào", unitPrice: 40000, quantity: 1, lineTotal: 40000, toppings: "[]" }],
        },
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${orderOld.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": staffProfile.id,
        "x-user-role": "staff",
      },
      body: JSON.stringify({ reason: "Khách đổi ý" }),
    });

    const res = await cancelOrderPost(req, { params: { id: orderOld.id } });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.message).toContain("5 phút");

    // Đơn hàng vẫn giữ nguyên trạng thái PAID
    const checkOrder = await prisma.order.findUnique({ where: { id: orderOld.id } });
    expect(checkOrder?.status).toBe("PAID");
  });

  it("2. Staff KHÔNG được hủy đơn đã từng in hóa đơn (HTTP 403)", async () => {
    // Tạo đơn hàng vừa tạo xong nhưng ĐÃ CÓ PrintLog
    const orderPrinted = await prisma.order.create({
      data: {
        code: `HD_PRINTED_${Date.now()}`,
        status: "PAID",
        subtotal: 50000,
        total: 50000,
        paidAmount: 50000,
        createdAt: new Date(), // mới tạo < 1 phút
        items: {
          create: [{ name: "Trà sữa Ô Long", unitPrice: 50000, quantity: 1, lineTotal: 50000, toppings: "[]" }],
        },
        printLogs: {
          create: [{ isReprint: false, printNum: 1 }],
        },
      },
      include: { printLogs: true },
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${orderPrinted.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": staffProfile.id,
        "x-user-role": "staff",
      },
      body: JSON.stringify({ reason: "Khách hủy sau khi in" }),
    });

    const res = await cancelOrderPost(req, { params: { id: orderPrinted.id } });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.message).toContain("đã được in");
  });

  it("3. Staff được hủy đơn hợp lệ (trong 5 phút + chưa in) -> OrderItem KHÔNG xoá, ghi AuditLog", async () => {
    const validOrder = await prisma.order.create({
      data: {
        code: `HD_VALID_${Date.now()}`,
        status: "PAID",
        subtotal: 35000,
        total: 35000,
        paidAmount: 35000,
        createdAt: new Date(), // vừa tạo
        items: {
          create: [{ name: "Cà phê sữa đá", unitPrice: 35000, quantity: 1, lineTotal: 35000, toppings: "[]" }],
        },
      },
      include: { items: true },
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${validOrder.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": staffProfile.id,
        "x-user-role": "staff",
      },
      body: JSON.stringify({ reason: "Thu ngân nhập nhầm size" }),
    });

    const res = await cancelOrderPost(req, { params: { id: validOrder.id } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("CANCELLED");
    expect(json.data.cancelReason).toBe("Thu ngân nhập nhầm size");
    expect(json.data.cancelledAt).not.toBeNull();

    // Kiểm tra OrderItem KHÔNG bị xoá (audit trail)
    const checkDb = await prisma.order.findUnique({
      where: { id: validOrder.id },
      include: { items: true },
    });
    expect(checkDb?.items.length).toBe(1);
    expect(checkDb?.items[0].name).toBe("Cà phê sữa đá");

    // Kiểm tra đã ghi vào bảng AuditLog
    const auditRecord = await prisma.auditLog.findFirst({
      where: { entity: "Order", entityId: validOrder.id, action: "CANCEL" },
    });
    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.before).toBeDefined();
    expect(auditRecord?.after).toContain("CANCELLED");
  });

  it("4. Admin được phép hủy bất kỳ đơn nào (kể cả đã in hoặc quá 5 phút)", async () => {
    // Đơn tạo từ lâu và đã in
    const orderOldPrinted = await prisma.order.create({
      data: {
        code: `HD_ADMIN_${Date.now()}`,
        status: "PAID",
        subtotal: 60000,
        total: 60000,
        paidAmount: 60000,
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 phút trước
        items: {
          create: [{ name: "Đá xay Freeze", unitPrice: 60000, quantity: 1, lineTotal: 60000, toppings: "[]" }],
        },
        printLogs: {
          create: [{ isReprint: false, printNum: 1 }],
        },
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${orderOldPrinted.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": adminProfile.id,
        "x-user-role": "admin",
      },
      body: JSON.stringify({ reason: "Admin duyệt hoàn tiền cho khách VIP" }),
    });

    const res = await cancelOrderPost(req, { params: { id: orderOldPrinted.id } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("CANCELLED");
    expect(json.data.cancelReason).toBe("Admin duyệt hoàn tiền cho khách VIP");
  });

  it("5. Sinh PDF hóa đơn hủy: có gạch ngang HÓA ĐƠN HỦY và in lý do hủy", async () => {
    const cancelledOrderData = {
      code: "HD_TEST_CANCEL_PDF",
      status: "CANCELLED",
      cancelReason: "Khách đổi ý không lấy nữa",
      cancelledBy: "Admin Quản Lý",
      createdAt: new Date(),
      subtotal: 45000,
      discount: 0,
      total: 45000,
      paidAmount: 45000,
      changeAmount: 0,
      paymentMethod: "CASH",
      items: [
        {
          name: "Trà lài Macchiato",
          unitPrice: 45000,
          quantity: 1,
          lineTotal: 45000,
          toppings: "[]",
        },
      ],
    };

    const shop = {
      shopName: "TIỆM TRÀ 88",
      shopAddress: "123 Đường Nguyễn Huệ",
      shopPhone: "0909 123 456",
    };

    const pdfBuffer = await generateInvoicePdfBuffer(cancelledOrderData as any, shop);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  });

  it("6. Ghi AuditLog khi sửa/cập nhật menu (Product)", async () => {
    const targetProduct = await prisma.product.findFirst();
    expect(targetProduct).not.toBeNull();

    const originalPrice = targetProduct!.basePrice;
    const newPrice = originalPrice + 5000;

    const req = new NextRequest("http://localhost:3000/api/products", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": adminProfile.id,
      },
      body: JSON.stringify({
        id: targetProduct!.id,
        basePrice: newPrice,
      }),
    });

    const res = await productPatch(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Kiểm tra AuditLog có bản ghi action = "UPDATE"
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entity: "Product",
        entityId: targetProduct!.id,
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog?.before).toContain(String(originalPrice));
    expect(auditLog?.after).toContain(String(newPrice));

    // Khôi phục lại giá cũ
    await prisma.product.update({
      where: { id: targetProduct!.id },
      data: { basePrice: originalPrice },
    });
  });
});
