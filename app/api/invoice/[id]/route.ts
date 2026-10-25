import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdfBuffer } from "@/lib/printer/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: id }, { code: id }],
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy hóa đơn" },
        { status: 404 }
      );
    }

    const setting = await prisma.setting.findFirst({
      where: { id: "default" },
    });

    const shopInfo = {
      shopName: setting?.shopName || process.env.SHOP_NAME || "TIỆM TRÀ & CÀ PHÊ 88",
      shopAddress: setting?.shopAddress || process.env.SHOP_ADDRESS || "123 Đường Nguyễn Huệ, Q.1, TP.HCM",
      shopPhone: setting?.shopPhone || process.env.SHOP_PHONE || "0909 123 456",
    };

    // Kiểm tra lịch sử in để quyết định gắn nhãn IN LẠI LẦN N
    const printLogsCount = await prisma.printLog.count({
      where: { orderId: order.id },
    });

    const qIsReprint = req.nextUrl.searchParams.get("reprint");
    const qPrintNum = req.nextUrl.searchParams.get("printNum");

    const isReprint =
      qIsReprint === "true" || qIsReprint === "1" || printLogsCount > 1;
    const printNum = qPrintNum
      ? parseInt(qPrintNum, 10)
      : Math.max(printLogsCount, 1);

    const pdfBuffer = await generateInvoicePdfBuffer(order, shopInfo, {
      isReprint,
      printNum,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="HoaDon_${order.code}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Lỗi xuất PDF hóa đơn:", error);
    return NextResponse.json(
      { success: false, message: "Không thể tạo file PDF hóa đơn" },
      { status: 500 }
    );
  }
}
