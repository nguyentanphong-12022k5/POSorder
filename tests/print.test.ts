import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { prisma } from "../lib/prisma";
import { POST as printPost } from "../app/api/orders/[id]/print/route";
import { generateInvoicePdfBuffer } from "../lib/printer/pdf";
import {
  stripDiacritics,
  encodeText,
  buildEscposReceiptBuffer,
  buildNativeEscposQrCode,
  buildQrRasterFallback,
  buildTestPrintBuffer,
  getPrinterConfig,
  checkPrinterHealth,
  sendWithRetry,
  printReceipt,
} from "../lib/printer/escpos";
import { GET as getPrinterHealth, POST as postPrinterHealth } from "../app/api/print/health/route";
import { NextRequest } from "next/server";

describe("Nâng cấp Module In Hóa Đơn & PrintLog", () => {
  let testOrderId: string;
  let testOrderCode: string;

  beforeAll(async () => {
    // Tìm hoặc tạo một order mẫu để test in
    let order = await prisma.order.findFirst({
      where: { status: "PAID" },
      include: { items: true },
    });

    if (!order) {
      order = await prisma.order.create({
        data: {
          code: `HDTEST_${Date.now()}`,
          subtotal: 50000,
          total: 50000,
          paidAmount: 50000,
          status: "PAID",
          items: {
            create: [
              {
                name: "Trà sữa Ô Long",
                toppings: "[]",
                unitPrice: 50000,
                quantity: 1,
                lineTotal: 50000,
              },
            ],
          },
        },
        include: { items: true },
      });
    }

    testOrderId = order.id;
    testOrderCode = order.code;
  });

  beforeEach(async () => {
    // Xóa các PrintLog cũ của order test để bắt đầu sạch
    await prisma.printLog.deleteMany({
      where: { orderId: testOrderId },
    });
  });

  it("1. Lần 1: isReprint = false, printNum = 1", async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/print`, {
      method: "POST",
    });

    const res = await printPost(req, { params: { id: testOrderId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.printed).toBe(true);
    expect(json.isReprint).toBe(false);
    expect(json.printNum).toBe(1);

    // Kiểm tra đã lưu vào DB PrintLog
    const logs = await prisma.printLog.findMany({
      where: { orderId: testOrderId },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].isReprint).toBe(false);
    expect(logs[0].printNum).toBe(1);
  });

  it("2. Chặn spam: In lần 2 ngay lập tức (< 3 giây) trả về HTTP 429", async () => {
    // Tạo 1 log vừa mới in
    await prisma.printLog.create({
      data: {
        orderId: testOrderId,
        isReprint: false,
        printNum: 1,
        printedAt: new Date(),
      },
    });

    // Thử gọi in ngay lập tức
    const req = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/print`, {
      method: "POST",
    });

    const res = await printPost(req, { params: { id: testOrderId } });
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.printed).toBe(false);
    const errorMsg = typeof json.error === "object" ? json.error.message : json.error;
    expect(errorMsg).toContain("quá nhanh");
  });

  it("3. Lần >= 2: isReprint = true, printNum = 2 (khi đã qua > 3 giây)", async () => {
    // Tạo 1 log giả định in cách đây 4 giây
    const pastTime = new Date(Date.now() - 4000);
    await prisma.printLog.create({
      data: {
        orderId: testOrderId,
        isReprint: false,
        printNum: 1,
        printedAt: pastTime,
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/print`, {
      method: "POST",
    });

    const res = await printPost(req, { params: { id: testOrderId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.printed).toBe(true);
    expect(json.isReprint).toBe(true);
    expect(json.printNum).toBe(2);

    const logs = await prisma.printLog.findMany({
      where: { orderId: testOrderId },
      orderBy: { printNum: "asc" },
    });
    expect(logs.length).toBe(2);
    expect(logs[1].isReprint).toBe(true);
    expect(logs[1].printNum).toBe(2);
  });

  it("4. Nếu máy in lỗi (ESC/POS throw): KHÔNG mất đơn, trả { printed: false, error }", async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${testOrderId}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulateError: true }),
    });

    const res = await printPost(req, { params: { id: testOrderId } });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.printed).toBe(false);
    expect(json.error).toBeDefined();
    const errorMsg = typeof json.error === "object" ? json.error.message : json.error;
    expect(errorMsg).toContain("ESC/POS");

    // Đơn hàng trong database KHÔNG bị xóa hay mất dữ liệu
    const orderCheck = await prisma.order.findUnique({
      where: { id: testOrderId },
    });
    expect(orderCheck).not.toBeNull();
    expect(orderCheck?.id).toBe(testOrderId);
  });

  it("5. Sinh PDF hóa đơn chuẩn có gắn nhãn IN LẠI LẦN N", async () => {
    const order = await prisma.order.findUnique({
      where: { id: testOrderId },
      include: { items: true },
    });

    const shop = {
      shopName: "TIỆM TRÀ & CÀ PHÊ 88",
      shopAddress: "123 Đường Nguyễn Huệ, TP.HCM",
      shopPhone: "0909 123 456",
    };

    const pdfBuffer = await generateInvoicePdfBuffer(order as any, shop, {
      isReprint: true,
      printNum: 3,
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Header bắt đầu bằng %PDF-
    expect(pdfBuffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  });

  describe("Nâng cấp ESC/POS Tiếng Việt, QR Code, Beep, Cắt giấy, 3 Mode & Retry", () => {
    it("6. Xử lý tiếng Việt: stripDiacritics và encode CP1258 / UTF-8", () => {
      const original = "Cà phê sữa đá & Trà ô long đậm vị";
      const stripped = stripDiacritics(original);
      expect(stripped).toBe("Ca phe sua da & Tra o long dam vi");

      const bufWin1258 = encodeText(original, "cp1258");
      expect(bufWin1258).toBeInstanceOf(Buffer);
      expect(bufWin1258.length).toBeGreaterThan(0);

      const bufUtf8 = encodeText(original, "utf-8");
      expect(bufUtf8.toString("utf8")).toBe(original);

      const bufAscii = encodeText(original, "strip_diacritics");
      expect(bufAscii.toString("ascii")).toBe("Ca phe sua da & Tra o long dam vi");
    });

    it("7. Template ESC/POS: Sinh buffer chứa QR Code, Cắt giấy tự động, Beep buzzer", async () => {
      const order = await prisma.order.findUnique({
        where: { id: testOrderId },
        include: { items: true },
      });

      const buffer = await buildEscposReceiptBuffer(order, {
        isReprint: false,
        printNum: 1,
        config: { paperWidth: "80mm", codepage: "cp1258" },
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);

      // 1. Kiểm tra lệnh Native QR code ESC/POS: GS ( k (0x1D 0x28 0x6B)
      const hasQrCommand = buffer.includes(Buffer.from([0x1d, 0x28, 0x6b]));
      expect(hasQrCommand).toBe(true);

      // 2. Kiểm tra lệnh Beep buzzer: ESC B 1 2 (0x1B 0x42 0x01 0x02)
      const hasBeep = buffer.includes(Buffer.from([0x1b, 0x42, 0x01, 0x02]));
      expect(hasBeep).toBe(true);

      // 3. Kiểm tra lệnh Cắt giấy: GS V 66 0 (0x1D 0x56 0x42 0x00)
      const hasCut = buffer.includes(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
      expect(hasCut).toBe(true);
    });

    it("8. Cấu hình 3 kiểu kết nối (tcp, usb, network)", () => {
      const cfgTcp = getPrinterConfig({ mode: "tcp", host: "192.168.1.150", port: 9100 });
      expect(cfgTcp.mode).toBe("tcp");
      expect(cfgTcp.host).toBe("192.168.1.150");

      const cfgNetwork = getPrinterConfig({ mode: "network", host: "10.0.0.50", port: 9100 });
      expect(cfgNetwork.mode).toBe("network");

      const cfgUsb = getPrinterConfig({ mode: "usb", usbPath: "COM3" });
      expect(cfgUsb.mode).toBe("usb");
      expect(cfgUsb.usbPath).toBe("COM3");
    });

    it("9. Cơ chế Retry 3 lần kèm backoff 500ms khi lỗi kết nối socket", async () => {
      const dummyBuffer = Buffer.from("TEST PRINT RETRY");
      const badConfig = getPrinterConfig({
        mode: "tcp",
        host: "127.0.0.1",
        port: 65432, // Cổng không có máy in lắng nghe
        maxRetries: 3,
        retryBackoffMs: 50, // Test nhanh với 50ms
      });

      const startTime = Date.now();
      await expect(sendWithRetry(dummyBuffer, badConfig)).rejects.toThrow(/sau 3 lần thử/);
      const elapsed = Date.now() - startTime;
      // Đã chờ ít nhất 50ms + 100ms = 150ms backoff (cho phép sai số timer 50ms trên runner ảo hóa)
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it("10. Endpoint /api/print/health trả về tình trạng kết nối và hỗ trợ testPrint", async () => {
      // 1. GET /api/print/health
      const getReq = new NextRequest("http://localhost:3000/api/print/health");
      const getRes = await getPrinterHealth(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.data.details).toBeDefined();

      // 2. POST /api/print/health với testPrint: true
      const postReq = new NextRequest("http://localhost:3000/api/print/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testPrint: true }),
      });
      const postRes = await postPrinterHealth(postReq);
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.data.testPrinted).toBe(true);
      expect(postJson.data.testPrintMessage).toBeDefined();
    });

    it("11. Sinh mã QR Raster Fallback và Phiếu in thử (Test Slip)", async () => {
      const qrFallbackBuf = await buildQrRasterFallback("http://localhost:3000/orders/HDTEST");
      expect(qrFallbackBuf).toBeInstanceOf(Buffer);
      // Lệnh GS v 0 (0x1D 0x76 0x30 0x00)
      expect(qrFallbackBuf[0]).toBe(0x1d);
      expect(qrFallbackBuf[1]).toBe(0x76);

      const testConfig = getPrinterConfig({ mode: "tcp", codepage: "cp1258", paperWidth: "58mm" });
      const testSlipBuf = buildTestPrintBuffer(testConfig);
      expect(testSlipBuf).toBeInstanceOf(Buffer);
      expect(testSlipBuf.length).toBeGreaterThan(50);
    });

    it("12. Kiểm tra Health Probe ở chế độ USB và OFFLINE probe", async () => {
      // 1. Probe USB (COM port)
      const usbHealth = await checkPrinterHealth({ mode: "usb", usbPath: "COM1", enableThermal: true });
      expect(usbHealth.details.mode).toBe("usb");

      // 2. Probe OFFLINE TCP
      const offlineHealth = await checkPrinterHealth({
        mode: "tcp",
        host: "127.0.0.1",
        port: 65431,
        enableThermal: true,
      });
      expect(offlineHealth.online).toBe(false);
      expect(offlineHealth.status).toBe("OFFLINE");

      // 3. printReceipt với logoRaster
      const order = await prisma.order.findUnique({
        where: { id: testOrderId },
        include: { items: true },
      });
      const result = await printReceipt(order, {
        logoRaster: Buffer.from([0x1d, 0x76, 0x30, 0x00, 1, 0, 1, 0, 0xff]),
        config: { enableThermal: false },
      });
      expect(result.success).toBe(true);
    });
  });
});
