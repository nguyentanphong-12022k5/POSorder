import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const setting = await prisma.setting.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        shopName: process.env.SHOP_NAME || "TIỆM TRÀ & CÀ PHÊ 88",
        shopAddress: process.env.SHOP_ADDRESS || "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
        shopPhone: process.env.SHOP_PHONE || "0909 123 456",
        printerInterface: process.env.PRINTER_INTERFACE || "tcp://192.168.1.100:9100",
        enableThermal: process.env.ENABLE_THERMAL === "true",
        bankCode: "MB",
        bankAccountNumber: "888899998888",
        bankAccountName: "TIEM TRA VA CA PHE 88",
        adminPin: "1234",
      },
    });

    return NextResponse.json({ success: true, data: setting });
  } catch (error) {
    console.error("Lỗi lấy thông tin cài đặt:", error);
    return NextResponse.json(
      { success: false, message: "Không thể lấy thông tin cấu hình" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shopName,
      shopAddress,
      shopPhone,
      printerInterface,
      enableThermal,
      bankCode,
      bankAccountNumber,
      bankAccountName,
      adminPin,
    } = body;

    const updated = await prisma.setting.upsert({
      where: { id: "default" },
      update: {
        shopName,
        shopAddress,
        shopPhone,
        printerInterface,
        enableThermal: Boolean(enableThermal),
        bankCode: bankCode || "MB",
        bankAccountNumber: bankAccountNumber || "888899998888",
        bankAccountName: bankAccountName || "TIEM TRA VA CA PHE 88",
        adminPin: adminPin || "1234",
      },
      create: {
        id: "default",
        shopName,
        shopAddress,
        shopPhone,
        printerInterface,
        enableThermal: Boolean(enableThermal),
        bankCode: bankCode || "MB",
        bankAccountNumber: bankAccountNumber || "888899998888",
        bankAccountName: bankAccountName || "TIEM TRA VA CA PHE 88",
        adminPin: adminPin || "1234",
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Lỗi lưu cấu hình:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Lỗi lưu cấu hình" },
      { status: 500 }
    );
  }
}
