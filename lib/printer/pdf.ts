import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { formatVND } from "@/lib/money";

interface ReceiptOrder {
  code: string;
  createdAt: Date | string;
  status?: string;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: Date | string | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  note?: string | null;
  items: Array<{
    name: string;
    variantName?: string | null;
    toppings: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    note?: string | null;
  }>;
}

interface ShopInfo {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
}

export interface PdfPrintOptions {
  isReprint?: boolean;
  printNum?: number;
}

export function generateInvoicePdfBuffer(
  order: ReceiptOrder,
  shop: ShopInfo,
  options: PdfPrintOptions = {}
): Promise<Buffer> {
  const { isReprint = false, printNum = 1 } = options;
  return new Promise((resolve, reject) => {
    try {
      // Chiều rộng 80mm ~ 226.77 pt
      const pageWidth = 226;
      // Chiều cao tự co giãn dựa theo số lượng món
      const estimatedHeight = 350 + order.items.length * 50 + (isReprint ? 30 : 0);

      const doc = new PDFDocument({
        size: [pageWidth, estimatedHeight],
        margins: { top: 12, bottom: 12, left: 10, right: 10 },
      });

      const fontRegularPath = path.join(process.cwd(), "public", "fonts", "Arial.ttf");
      const fontBoldPath = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");

      if (fs.existsSync(fontRegularPath)) {
        doc.registerFont("Regular", fontRegularPath);
      } else {
        doc.registerFont("Regular", "Helvetica");
      }

      if (fs.existsSync(fontBoldPath)) {
        doc.registerFont("Bold", fontBoldPath);
      } else {
        doc.registerFont("Bold", "Helvetica-Bold");
      }

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const contentWidth = pageWidth - 20;

      // 1. Tên Quán
      doc.font("Bold").fontSize(11).text(shop.shopName, { align: "center", width: contentWidth });
      doc.font("Regular").fontSize(8).text(shop.shopAddress, { align: "center", width: contentWidth });
      doc.text(`SĐT: ${shop.shopPhone}`, { align: "center", width: contentWidth });

      doc.moveDown(0.3);
      doc.fontSize(8).text("----------------------------------------------------------------", { align: "center" });

      // 2. Tiêu đề hoá đơn & Mã đơn
      if (order.status === "CANCELLED") {
        doc.font("Bold").fontSize(12).fillColor("#DC2626").text("--- HÓA ĐƠN HỦY ---", { align: "center", width: contentWidth, strike: true });
        doc.font("Regular").fontSize(8).fillColor("#B91C1C");
        doc.text(`* LÝ DO HỦY: ${order.cancelReason || "Khách hủy đơn"}`, { align: "center", width: contentWidth });
        if (order.cancelledBy) {
          doc.text(`Người hủy: ${order.cancelledBy}`, { align: "center", width: contentWidth });
        }
        doc.fillColor("#000000");
      } else if (isReprint) {
        doc.font("Bold").fontSize(10).fillColor("#DC2626").text(`*** IN LẠI LẦN ${printNum} ***`, { align: "center", width: contentWidth });
        doc.fillColor("#000000");
        doc.moveDown(0.2);
        doc.font("Bold").fontSize(11).text("HÓA ĐƠN THANH TOÁN", { align: "center", width: contentWidth });
      } else {
        doc.font("Bold").fontSize(11).text("HÓA ĐƠN", { align: "center", width: contentWidth });
      }
      
      const dateStr = new Date(order.createdAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      doc.font("Regular").fontSize(8);
      doc.text(`Mã đơn: ${order.code}`, { align: "left" });
      doc.text(`Thời gian: ${dateStr}`, { align: "left" });

      doc.text("----------------------------------------------------------------", { align: "center" });

      // 3. Header bảng
      doc.font("Bold").fontSize(8);
      const colX = {
        name: 10,
        qty: 110,
        price: 135,
        total: 175,
      };

      doc.text("Tên món", colX.name, doc.y, { width: 95, continued: false });
      const rowY = doc.y - 10;
      doc.text("SL", colX.qty, rowY, { width: 20, align: "center" });
      doc.text("Đ.Giá", colX.price, rowY, { width: 35, align: "right" });
      doc.text("T.Tiền", colX.total, rowY, { width: 40, align: "right" });

      doc.font("Regular").fontSize(8);
      doc.moveDown(0.2);
      doc.text("----------------------------------------------------------------", 10, doc.y, { align: "center" });

      // 4. Danh sách các món snapshot
      order.items.forEach((item) => {
        let toppingsList: Array<{ name: string; price: number }> = [];
        try {
          if (item.toppings) {
            toppingsList = JSON.parse(item.toppings);
          }
        } catch (e) {
          toppingsList = [];
        }

        const fullName = item.variantName ? `${item.name} (${item.variantName})` : item.name;

        const currentY = doc.y;
        doc.font("Bold").fontSize(8).text(fullName, colX.name, currentY, { width: 95 });
        const nameBottomY = doc.y;

        doc.font("Regular").fontSize(8);
        doc.text(item.quantity.toString(), colX.qty, currentY, { width: 20, align: "center" });
        doc.text(formatVND(item.unitPrice).replace(" ₫", ""), colX.price, currentY, { width: 35, align: "right" });
        doc.text(formatVND(item.lineTotal).replace(" ₫", ""), colX.total, currentY, { width: 40, align: "right" });

        // In toppings nếu có
        doc.y = nameBottomY;
        if (toppingsList.length > 0) {
          toppingsList.forEach((t) => {
            doc.font("Regular").fontSize(7).fillColor("#555555");
            doc.text(`+ ${t.name} (${formatVND(t.price)})`, colX.name + 4, doc.y, { width: 140 });
          });
          doc.fillColor("#000000");
        }

        if (item.note) {
          doc.font("Regular").fontSize(7).fillColor("#666666");
          doc.text(`* Lưu ý: ${item.note}`, colX.name + 4, doc.y, { width: 140 });
          doc.fillColor("#000000");
        }

        doc.moveDown(0.3);
      });

      doc.fontSize(8).text("----------------------------------------------------------------", 10, doc.y, { align: "center" });

      // 5. Phần tổng tiền
      const drawSummaryRow = (label: string, value: string, isBold: boolean = false, fontSize: number = 8) => {
        const y = doc.y;
        doc.font(isBold ? "Bold" : "Regular").fontSize(fontSize);
        doc.text(label, 10, y, { width: 100, align: "left" });
        doc.text(value, 110, y, { width: 105, align: "right" });
        doc.moveDown(0.2);
      };

      drawSummaryRow("Tạm tính:", formatVND(order.subtotal));
      if (order.discount > 0) {
        drawSummaryRow("Giảm giá:", `-${formatVND(order.discount)}`);
      }
      
      doc.moveDown(0.1);
      drawSummaryRow("TỔNG CỘNG:", formatVND(order.total), true, 10);
      doc.moveDown(0.2);

      const methodLabel = order.paymentMethod === "TRANSFER" ? "Chuyển khoản QR" : "Tiền mặt";
      drawSummaryRow("Hình thức:", methodLabel);
      if (order.paymentMethod === "CASH") {
        drawSummaryRow("Tiền khách đưa:", formatVND(order.paidAmount));
        drawSummaryRow("Tiền thối lại:", formatVND(order.changeAmount));
      }

      if (order.note) {
        doc.moveDown(0.2);
        doc.font("Regular").fontSize(7).text(`Ghi chú đơn: ${order.note}`, 10, doc.y, { width: contentWidth });
      }

      doc.moveDown(0.3);
      doc.fontSize(8).text("----------------------------------------------------------------", 10, doc.y, { align: "center" });

      // 6. Lời cảm ơn
      doc.moveDown(0.2);
      doc.font("Bold").fontSize(8).text("Cảm ơn quý khách! Hẹn gặp lại!", { align: "center", width: contentWidth });
      doc.font("Regular").fontSize(7).text("Wifi: CaPhe88 | Pass: 88888888", { align: "center", width: contentWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
