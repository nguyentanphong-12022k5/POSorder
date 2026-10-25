import net from "net";
import fs from "fs";
import iconv from "iconv-lite";
import QRCode from "qrcode";
import { formatVND } from "../money";

export type PrinterMode = "tcp" | "usb" | "network";
export type PrinterCodepage = "cp1258" | "utf-8" | "strip_diacritics" | "ascii";
export type PrinterModel = "xprinter" | "epson" | "generic";
export type PaperWidth = "58mm" | "80mm";

export interface PrinterConfig {
  mode: PrinterMode;
  host: string;
  port: number;
  usbPath: string;
  codepage: PrinterCodepage;
  model: PrinterModel;
  paperWidth: PaperWidth;
  enableThermal: boolean;
  maxRetries: number;
  retryBackoffMs: number;
}

export interface PrintOptions {
  isReprint?: boolean;
  printNum?: number;
  simulateError?: boolean;
  appBaseUrl?: string;
  logoRaster?: Buffer | null;
  config?: Partial<PrinterConfig>;
}

export interface EscposPrintResult {
  success: boolean;
  message: string;
  isReprint?: boolean;
  printNum?: number;
  mode?: PrinterMode;
  target?: string;
  retriesUsed?: number;
}

export interface PrinterHealthResult {
  online: boolean;
  status: "ONLINE" | "OFFLINE" | "SIMULATED";
  latencyMs: number;
  message: string;
  error?: string;
  details: {
    mode: PrinterMode;
    target: string;
    codepage: PrinterCodepage;
    model: PrinterModel;
    paperWidth: PaperWidth;
    enableThermal: boolean;
  };
}

/**
 * Lấy cấu hình máy in từ biến môi trường
 */
export function getPrinterConfig(override?: Partial<PrinterConfig>): PrinterConfig {
  const printerInterface = process.env.PRINTER_INTERFACE || "";
  let parsedHost = process.env.PRINTER_HOST || "192.168.1.100";
  let parsedPort = parseInt(process.env.PRINTER_PORT || "9100", 10);

  // Parse từ PRINTER_INTERFACE nếu có (vd: tcp://192.168.1.200:9100)
  if (printerInterface.startsWith("tcp://") || printerInterface.startsWith("network://")) {
    const raw = printerInterface.replace(/^(tcp|network):\/\//, "");
    const parts = raw.split(":");
    parsedHost = parts[0] || parsedHost;
    if (parts[1]) parsedPort = parseInt(parts[1], 10) || parsedPort;
  }

  const rawMode = (process.env.PRINTER_MODE || "").toLowerCase();
  let mode: PrinterMode = "tcp";
  if (rawMode === "usb" || printerInterface.includes("usb") || printerInterface.startsWith("COM")) {
    mode = "usb";
  } else if (rawMode === "network" || printerInterface.startsWith("network://")) {
    mode = "network";
  } else {
    mode = "tcp";
  }

  const codepage = ((process.env.PRINTER_CODEPAGE || "cp1258").toLowerCase() as PrinterCodepage);
  const model = ((process.env.PRINTER_MODEL || "xprinter").toLowerCase() as PrinterModel);
  const paperWidth: PaperWidth = process.env.PRINTER_PAPER_WIDTH === "58mm" ? "58mm" : "80mm";
  const enableThermal = process.env.ENABLE_THERMAL === "true";

  return {
    mode: override?.mode || mode,
    host: override?.host || parsedHost,
    port: override?.port || parsedPort,
    usbPath: override?.usbPath || process.env.PRINTER_USB_PATH || "COM1",
    codepage: override?.codepage || codepage,
    model: override?.model || model,
    paperWidth: override?.paperWidth || paperWidth,
    enableThermal: override?.enableThermal !== undefined ? override.enableThermal : enableThermal,
    maxRetries: override?.maxRetries ?? 3,
    retryBackoffMs: override?.retryBackoffMs ?? 500,
  };
}

/**
 * Chuẩn hóa chuỗi tiếng Việt có dấu thành không dấu (Fallback an toàn cho máy in không hỗ trợ font Việt)
 * Ví dụ: "Cà phê sữa đá" -> "Ca phe sua da", "Đơn hàng" -> "Don hang"
 */
export function stripDiacritics(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * Mã hóa văn bản theo Codepage của máy in (CP1258, UTF-8 hoặc Không dấu)
 */
export function encodeText(text: string, codepage: PrinterCodepage): Buffer {
  if (codepage === "strip_diacritics" || codepage === "ascii") {
    return Buffer.from(stripDiacritics(text), "ascii");
  }

  if (codepage === "utf-8") {
    return Buffer.from(text, "utf8");
  }

  // Mặc định CP1258 (Windows-1258 Vietnamese)
  try {
    return iconv.encode(text, "windows-1258");
  } catch (e) {
    // Nếu iconv lỗi -> fallback tiếng Việt không dấu
    return Buffer.from(stripDiacritics(text), "ascii");
  }
}

/**
 * Tạo mã ESC/POS thiết lập Codepage đầu lệnh
 */
function getCodepageInitSequence(codepage: PrinterCodepage, model: PrinterModel): Buffer {
  if (codepage === "utf-8") {
    // Epson UTF-8 Mode command (FS ( L ...)
    if (model === "epson") {
      return Buffer.from([0x1c, 0x28, 0x4c, 0x02, 0x00, 0x30, 0x01]);
    }
    // Standard UTF-8 ESC/POS sequence
    return Buffer.from([0x1b, 0x74, 0xff]);
  }

  if (codepage === "cp1258") {
    // Lệnh ESC t n: Chọn bảng ký tự Windows-1258 (thường là trang 30 hoặc 49 tùy firmware)
    return Buffer.from([0x1b, 0x74, 30]);
  }

  // ASCII/PC437 mặc định
  return Buffer.from([0x1b, 0x74, 0]);
}

/**
 * Tạo lệnh ESC/POS in mã QR Code (Native ESC/POS 2D Barcode)
 * Tương thích chuẩn Epson & Xprinter: GS ( k
 */
export function buildNativeEscposQrCode(data: string, moduleSize = 6): Buffer {
  const dataBuffer = Buffer.from(data, "utf8");
  const len = dataBuffer.length + 3;
  const pL = len % 256;
  const pH = Math.floor(len / 256);

  return Buffer.concat([
    // 1. Model type (Model 2)
    Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    // 2. Module size (kích thước ô vuông)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, moduleSize))]),
    // 3. Error correction level (M = level 49)
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    // 4. Store data in symbol storage area
    Buffer.from([0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    dataBuffer,
    // 5. Print the symbol data
    Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

/**
 * Sinh lệnh in Logo dạng ESC/POS Raster bit image (GS v 0) từ Bitmap
 */
export function buildRasterImageCommand(width: number, height: number, bitmapData: Buffer): Buffer {
  const bytesPerWidth = Math.ceil(width / 8);
  const xL = bytesPerWidth % 256;
  const xH = Math.floor(bytesPerWidth / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  // GS v 0 m xL xH yL yH d1...dk
  const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([header, bitmapData]);
}

/**
 * Tạo raster QR code từ thư viện 'qrcode' làm fallback nếu máy in không hỗ trợ native QR
 */
export async function buildQrRasterFallback(text: string): Promise<Buffer> {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const scale = 4; // 4 dots mỗi module
  const width = size * scale;
  const height = size * scale;
  const bytesPerRow = Math.ceil(width / 8);
  const buffer = Buffer.alloc(bytesPerRow * height, 0);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        for (let dy = 0; dy < scale; dy++) {
          const y = r * scale + dy;
          for (let dx = 0; dx < scale; dx++) {
            const x = c * scale + dx;
            const byteIndex = y * bytesPerRow + Math.floor(x / 8);
            const bitOffset = 7 - (x % 8);
            buffer[byteIndex] |= 1 << bitOffset;
          }
        }
      }
    }
  }

  return buildRasterImageCommand(width, height, buffer);
}

/**
 * Định dạng dòng 2 cột cách đều (VD: "Tạm tính:                       45.000 ₫")
 */
function formatTwoColumns(left: string, right: string, maxChars: number): string {
  const rightLen = right.length;
  const availableLeft = maxChars - rightLen - 1;
  const safeLeft = left.length > availableLeft ? left.slice(0, availableLeft) : left;
  const spaces = Math.max(1, maxChars - safeLeft.length - rightLen);
  return safeLeft + " ".repeat(spaces) + right;
}

/**
 * Xây dựng toàn bộ Buffer nhị phân hóa đơn ESC/POS chuẩn
 */
export async function buildEscposReceiptBuffer(
  order: any,
  options: PrintOptions = {}
): Promise<Buffer> {
  const config = getPrinterConfig(options.config);
  const maxChars = config.paperWidth === "58mm" ? 32 : 48;
  const divider = "-".repeat(maxChars);
  const doubleDivider = "=".repeat(maxChars);

  const buffers: Buffer[] = [];
  const append = (buf: Buffer) => buffers.push(buf);
  const printLine = (text: string) => {
    append(encodeText(text + "\n", config.codepage));
  };

  // 1. Khởi tạo máy in (ESC @) + Set Codepage
  append(Buffer.from([0x1b, 0x40])); // Reset máy in
  append(getCodepageInitSequence(config.codepage, config.model));

  // 2. In Logo (Nếu có raster hoặc in logo NV trong bộ nhớ máy in)
  if (options.logoRaster && options.logoRaster.length > 0) {
    append(Buffer.from([0x1b, 0x61, 0x01])); // Căn giữa
    append(options.logoRaster);
    append(Buffer.from([0x1b, 0x64, 0x01])); // Feed 1 dòng
  } else {
    // In ký hiệu logo mẫu chữ nghệ thuật
    append(Buffer.from([0x1b, 0x61, 0x01]));
    append(encodeText("☕  POS TEA & COFFEE  ☕\n", config.codepage));
  }

  // 3. Header thông tin quán
  append(Buffer.from([0x1b, 0x61, 0x01])); // Căn giữa
  append(Buffer.from([0x1b, 0x45, 0x01])); // In đậm
  printLine(process.env.SHOP_NAME || "TIỆM TRÀ & CÀ PHÊ 88");
  append(Buffer.from([0x1b, 0x45, 0x00])); // Tắt in đậm

  printLine(process.env.SHOP_ADDRESS || "123 Nguyễn Huệ, Quận 1, TP.HCM");
  printLine(`Hotline: ${process.env.SHOP_PHONE || "0909 123 456"}`);
  printLine(divider);

  // 4. Tiêu đề Hóa đơn (Chữ to x2 + In đậm)
  const isCancelled = order.status === "CANCELLED";
  const title = isCancelled
    ? "*** HÓA ĐƠN HỦY ***"
    : options.isReprint
    ? `*** IN LẠI LẦN ${options.printNum || 2} ***`
    : "HÓA ĐƠN THANH TOÁN";

  append(Buffer.from([0x1d, 0x21, 0x11])); // Double Height & Width
  append(Buffer.from([0x1b, 0x45, 0x01])); // Bold
  printLine(title);
  append(Buffer.from([0x1d, 0x21, 0x00])); // Reset kích thước
  append(Buffer.from([0x1b, 0x45, 0x00])); // Reset bold

  if (isCancelled && order.cancelReason) {
    printLine(`Lý do hủy: ${order.cancelReason}`);
  }

  // 5. Thông tin đơn hàng
  append(Buffer.from([0x1b, 0x61, 0x00])); // Căn trái
  printLine(`Số HĐ: ${order.code}`);
  const timeStr = new Date(order.createdAt || Date.now()).toLocaleString("vi-VN");
  printLine(`Thời gian: ${timeStr}`);
  printLine(`Hình thức: ${order.orderType === "DINE_IN" ? `Tại bàn (${order.tableNumber || "01"})` : "Mang về"}`);
  if (order.customerName || order.customerPhone) {
    printLine(`Khách hàng: ${order.customerName || "Khách"} (${order.customerPhone || ""})`);
  }
  printLine(doubleDivider);

  // 6. Bảng danh sách món
  printLine(formatTwoColumns("Tên món (SL x Đơn giá)", "Thành tiền", maxChars));
  printLine(divider);

  const items = order.items || [];
  for (const item of items) {
    const itemName = item.productName || item.name || "Món nước";
    const variant = item.variantName ? ` (${item.variantName})` : "";
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const totalLine = Number(item.lineTotal) || qty * price;

    printLine(`${itemName}${variant}`);

    // In topping nếu có
    if (item.toppings) {
      try {
        const topList = typeof item.toppings === "string" ? JSON.parse(item.toppings) : item.toppings;
        if (Array.isArray(topList) && topList.length > 0) {
          const topStr = topList.map((t: any) => `+ ${t.name}`).join(", ");
          printLine(`  ${topStr}`);
        }
      } catch (e) {}
    }

    const calcStr = `  ${qty} x ${formatVND(price)}`;
    printLine(formatTwoColumns(calcStr, formatVND(totalLine), maxChars));
  }
  printLine(divider);

  // 7. Tổng kết thanh toán
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const total = Number(order.total) || Math.max(0, subtotal - discount);
  const paid = Number(order.paidAmount) || total;
  const change = Math.max(0, paid - total);

  printLine(formatTwoColumns("Tạm tính:", formatVND(subtotal), maxChars));
  if (discount > 0) {
    printLine(formatTwoColumns("Giảm giá:", `-${formatVND(discount)}`, maxChars));
  }

  append(Buffer.from([0x1b, 0x45, 0x01])); // In đậm
  printLine(formatTwoColumns("TỔNG CỘNG:", formatVND(total), maxChars));
  append(Buffer.from([0x1b, 0x45, 0x00]));

  const methodText = order.paymentMethod === "TRANSFER" ? "Chuyển khoản VietQR" : "Tiền mặt";
  printLine(formatTwoColumns("Phương thức:", methodText, maxChars));
  printLine(formatTwoColumns("Tiền khách đưa:", formatVND(paid), maxChars));
  if (order.paymentMethod !== "TRANSFER") {
    printLine(formatTwoColumns("Tiền thối lại:", formatVND(change), maxChars));
  }
  printLine(divider);

  // 8. In Mã QR Code tra cứu hóa đơn
  const baseUrl = options.appBaseUrl || process.env.APP_URL || "http://localhost:3000";
  const trackingUrl = `${baseUrl}/orders/${order.id || order.code}`;

  append(Buffer.from([0x1b, 0x61, 0x01])); // Căn giữa
  printLine("Quét mã QR để tra cứu hóa đơn điện tử:");

  try {
    // 8a. Thử lệnh Native QR của máy in
    append(buildNativeEscposQrCode(trackingUrl, 6));
  } catch (e) {
    // 8b. Fallback sang Raster QR bằng thư viện 'qrcode'
    const qrRaster = await buildQrRasterFallback(trackingUrl);
    append(qrRaster);
  }

  printLine(trackingUrl);
  printLine("");
  printLine("Cảm ơn quý khách! Hẹn gặp lại 🌸");
  printLine("Wifi: CaPhe88 | Mật khẩu: 88888888");

  // 9. Lùi giấy, Beep 1 tiếng và Cắt giấy tự động
  append(Buffer.from([0x1b, 0x64, 0x04])); // Feed 4 dòng
  append(Buffer.from([0x1b, 0x42, 0x01, 0x02])); // Beep buzzer 1 lần (100ms)
  append(Buffer.from([0x07])); // BEL tone
  append(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // GS V 66 0: Cắt giấy (Partial cut)

  return Buffer.concat(buffers);
}

/**
 * Gửi dữ liệu thô tới máy in qua TCP Socket với cơ chế Retry & Backoff
 */
async function sendToTcpSocket(
  data: Buffer,
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let isFinished = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(data, () => {
        socket.end();
      });
    });

    socket.on("close", () => {
      if (!isFinished) {
        isFinished = true;
        resolve();
      }
    });

    socket.on("timeout", () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        reject(new Error(`Timeout kết nối tới máy in tại ${host}:${port} (${timeoutMs}ms)`));
      }
    });

    socket.on("error", (err) => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        reject(err);
      }
    });
  });
}

/**
 * Gửi dữ liệu qua cổng USB (Device file hoặc COM port)
 */
async function sendToUsbPort(data: Buffer, usbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Hỗ trợ ghi vào file descriptor / cổng COM (Windows: COM1, COM3; Linux: /dev/usb/lp0)
      fs.writeFile(usbPath, data, (err) => {
        if (err) {
          reject(new Error(`Lỗi giao tiếp cổng USB/COM (${usbPath}): ${err.message}`));
        } else {
          resolve();
        }
      });
    } catch (err: any) {
      reject(new Error(`Không thể mở cổng USB (${usbPath}): ${err.message}`));
    }
  });
}

/**
 * Hàm điều phối gửi lệnh in hỗ trợ 3 Mode (tcp, network, usb) kèm Retry 3 lần & Backoff 500ms
 */
export async function sendWithRetry(
  data: Buffer,
  config: PrinterConfig
): Promise<{ retriesUsed: number }> {
  const maxRetries = config.maxRetries || 3;
  const backoffMs = config.retryBackoffMs || 500;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (config.mode === "usb") {
        await sendToUsbPort(data, config.usbPath);
      } else {
        // Cả 'tcp' và 'network' đều truyền gói raw ESC/POS qua TCP socket JetDirect port
        await sendToTcpSocket(data, config.host, config.port, 4000);
      }
      return { retriesUsed: attempt - 1 };
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[ESC/POS Warning] Lần in ${attempt}/${maxRetries} thất bại (${config.mode}://${config.host}:${config.port}): ${err.message}`
      );

      if (attempt < maxRetries) {
        const sleepMs = backoffMs * attempt;
        await new Promise((res) => setTimeout(res, sleepMs));
      }
    }
  }

  throw new Error(
    `Không thể kết nối máy in sau ${maxRetries} lần thử (${config.mode}://${config.host}:${config.port}): ${lastError?.message || "Mất kết nối phần cứng"}`
  );
}

/**
 * Xử lý in hóa đơn hoàn chỉnh
 */
export async function printReceipt(
  order: any,
  options: PrintOptions = {}
): Promise<EscposPrintResult> {
  const { isReprint = false, printNum = 1, simulateError = false } = options;
  const config = getPrinterConfig(options.config);

  // 1. Cho phép kiểm thử trường hợp máy in throw lỗi
  if (simulateError) {
    throw new Error(
      "Lỗi phần cứng máy in ESC/POS: Máy in không phản hồi (Printer Offline / Out of Paper)"
    );
  }

  const isCancelled = order.status === "CANCELLED";
  const titleHeader = isCancelled
    ? `*** HOA DON HUY (LY DO: ${order.cancelReason || "KHACH HUY"}) ***`
    : isReprint
    ? `*** IN LẠI LẦN ${printNum} ***`
    : `HÓA ĐƠN THANH TOÁN`;

  const targetStr =
    config.mode === "usb"
      ? `usb://${config.usbPath}`
      : `${config.mode}://${config.host}:${config.port}`;

  console.log(`[ESC/POS] Chuẩn bị in đơn ${order.code} [${titleHeader}] tới ${targetStr}...`);

  // 2. Chế độ mô phỏng khi chưa bật máy in vật lý
  if (!config.enableThermal) {
    return {
      success: true,
      message: `[Mô phỏng] Đã gửi lệnh in đơn ${order.code} (${titleHeader}) thành công`,
      isReprint,
      printNum,
      mode: config.mode,
      target: targetStr,
      retriesUsed: 0,
    };
  }

  // 3. Tạo Buffer dữ liệu hóa đơn ESC/POS
  const printBuffer = await buildEscposReceiptBuffer(order, options);

  // 4. Gửi tới máy in với cơ chế Retry 3 lần
  try {
    const { retriesUsed } = await sendWithRetry(printBuffer, config);

    return {
      success: true,
      message: `Đã in thành công đơn ${order.code} (${titleHeader}) qua ${targetStr}`,
      isReprint,
      printNum,
      mode: config.mode,
      target: targetStr,
      retriesUsed,
    };
  } catch (error: any) {
    console.error("[ESC/POS Hardware Error]:", error);
    throw new Error(`Lỗi giao tiếp máy in ESC/POS (${targetStr}): ${error.message}`);
  }
}

/**
 * Kiểm tra tình trạng kết nối máy in (Health Check Probe)
 */
export async function checkPrinterHealth(
  overrideConfig?: Partial<PrinterConfig>
): Promise<PrinterHealthResult> {
  const config = getPrinterConfig(overrideConfig);
  const target =
    config.mode === "usb"
      ? `usb://${config.usbPath}`
      : `${config.mode}://${config.host}:${config.port}`;

  if (!config.enableThermal) {
    return {
      online: true,
      status: "SIMULATED",
      latencyMs: 1,
      message: "Chế độ mô phỏng máy in đang kích hoạt (ENABLE_THERMAL=false)",
      details: {
        mode: config.mode,
        target,
        codepage: config.codepage,
        model: config.model,
        paperWidth: config.paperWidth,
        enableThermal: false,
      },
    };
  }

  const startTime = Date.now();

  try {
    if (config.mode === "usb") {
      // Kiểm tra cổng USB / COM có tồn tại
      const exists = fs.existsSync(config.usbPath);
      const latencyMs = Date.now() - startTime;
      if (!exists && !config.usbPath.startsWith("COM")) {
        return {
          online: false,
          status: "OFFLINE",
          latencyMs,
          message: `Không tìm thấy thiết bị USB tại ${config.usbPath}`,
          error: "Device not found",
          details: { ...config, target },
        };
      }
      return {
        online: true,
        status: "ONLINE",
        latencyMs,
        message: `Cổng USB ${config.usbPath} sẵn sàng hoạt động`,
        details: { ...config, target },
      };
    }

    // Kiểm tra kết nối TCP socket (Probe với timeout 3000ms)
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(3000);

      socket.connect(config.port, config.host, () => {
        // Gửi lệnh DLE EOT 1: Truy vấn trạng thái máy in
        socket.write(Buffer.from([0x10, 0x04, 0x01]));
        socket.end();
      });

      socket.on("close", () => resolve());
      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error(`Timeout sau 3000ms khi kết nối tới ${config.host}:${config.port}`));
      });
      socket.on("error", (err) => {
        socket.destroy();
        reject(err);
      });
    });

    const latencyMs = Date.now() - startTime;
    return {
      online: true,
      status: "ONLINE",
      latencyMs,
      message: `Kết nối máy in ${target} thành công (${latencyMs}ms)`,
      details: { ...config, target },
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      online: false,
      status: "OFFLINE",
      latencyMs,
      message: `Không thể kết nối máy in tại ${target}`,
      error: err.message,
      details: { ...config, target },
    };
  }
}

/**
 * Sinh Buffer phiếu in thử (Test Print Slip)
 */
export function buildTestPrintBuffer(config: PrinterConfig): Buffer {
  const buffers: Buffer[] = [];
  const append = (buf: Buffer) => buffers.push(buf);
  const printLine = (text: string) => {
    append(encodeText(text + "\n", config.codepage));
  };

  append(Buffer.from([0x1b, 0x40])); // Reset
  append(getCodepageInitSequence(config.codepage, config.model));

  append(Buffer.from([0x1b, 0x61, 0x01])); // Căn giữa
  append(Buffer.from([0x1d, 0x21, 0x11])); // Double
  printLine("KIỂM TRA MÁY IN");
  append(Buffer.from([0x1d, 0x21, 0x00])); // Reset

  printLine("--------------------------------");
  append(Buffer.from([0x1b, 0x61, 0x00])); // Căn trái
  printLine(`Chế độ kết nối: ${config.mode.toUpperCase()}`);
  printLine(`Giao thức: ${config.mode === "usb" ? config.usbPath : `${config.host}:${config.port}`}`);
  printLine(`Mã hóa (Codepage): ${config.codepage.toUpperCase()}`);
  printLine(`Khổ giấy: ${config.paperWidth}`);
  printLine(`Thời gian: ${new Date().toLocaleString("vi-VN")}`);
  printLine("--------------------------------");
  printLine("Tiếng Việt có dấu: Cà phê sữa đá, Trà sen Tây Hồ 100%");
  printLine("Kết nối ổn định! Sẵn sàng bán hàng.");

  // Feed, Beep & Cut
  append(Buffer.from([0x1b, 0x64, 0x04]));
  append(Buffer.from([0x1b, 0x42, 0x01, 0x02]));
  append(Buffer.from([0x1d, 0x56, 0x42, 0x00]));

  return Buffer.concat(buffers);
}
