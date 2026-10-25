import { NextRequest, NextResponse } from "next/server";
import {
  checkPrinterHealth,
  buildTestPrintBuffer,
  getPrinterConfig,
  sendWithRetry,
} from "@/lib/printer/escpos";

export const dynamic = "force-dynamic";

/**
 * GET /api/print/health
 * Kiểm tra trạng thái kết nối tới máy in nhiệt (TCP / Network / USB)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") as any;
    const host = searchParams.get("host") || undefined;
    const port = searchParams.get("port") ? parseInt(searchParams.get("port")!, 10) : undefined;

    const health = await checkPrinterHealth({
      mode: mode || undefined,
      host,
      port,
    });

    return NextResponse.json({
      success: health.online,
      data: health,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Lỗi kiểm tra trạng thái máy in",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/print/health
 * Kiểm tra kết nối và tùy chọn gửi lệnh in thử mẫu test slip ra máy in
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const { testPrint = false, config: customConfig } = body;
    const config = getPrinterConfig(customConfig);
    const health = await checkPrinterHealth(config);

    let testPrinted = false;
    let testPrintMessage = "";

    if (testPrint) {
      if (!config.enableThermal) {
        testPrinted = true;
        testPrintMessage = "Đã gửi lệnh in thử mô phỏng thành công (ENABLE_THERMAL=false)";
      } else if (health.online) {
        const testBuffer = buildTestPrintBuffer(config);
        await sendWithRetry(testBuffer, config);
        testPrinted = true;
        testPrintMessage = `Đã in thử nghiệm thành công tới ${health.details.target}`;
      } else {
        testPrintMessage = `Không thể in thử vì máy in đang Offline: ${health.error || "Mất kết nối"}`;
      }
    }

    return NextResponse.json({
      success: health.online,
      data: {
        ...health,
        testPrinted,
        testPrintMessage,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Lỗi xử lý kiểm tra máy in",
      },
      { status: 500 }
    );
  }
}
