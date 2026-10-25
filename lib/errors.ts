import { NextResponse } from "next/server";
import { ZodError } from "zod";
import * as Sentry from "@sentry/nextjs";
import { formatZodError } from "./validations/schemas";
import logger from "./logger";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "PRINTER_ERROR"
  | "INTERNAL_SERVER_ERROR";

export interface StandardApiErrorPayload {
  code: AppErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: StandardApiErrorPayload;
  message?: string;
}

/**
 * Lớp lỗi Validation tuỳ biến cho ứng dụng POS
 */
export class OrderValidationError extends Error {
  status: number;
  field: string;
  code: AppErrorCode;

  constructor(field: string, message: string, status: number = 422, code: AppErrorCode = "VALIDATION_ERROR") {
    super(message);
    this.name = "OrderValidationError";
    this.field = field;
    this.status = status;
    this.code = code;
  }
}

/**
 * Helper tạo NextResponse lỗi theo chuẩn { error: { code, message, fields? } }
 */
export function createApiErrorResponse(
  code: AppErrorCode,
  message: string,
  status: number = 400,
  fields?: Record<string, string>
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
      },
      message, // Fallback tương thích
    },
    { status }
  );
}

/**
 * Xử lý lỗi tự động cho API route (bắt Zod, OrderValidationError, Prisma, v.v.)
 */
export function handleServerApiError(error: any) {
  console.error("[API Error Handler]:", error);

  // 1. Zod Validation Error
  if (error instanceof ZodError) {
    const { fields, firstMessage } = formatZodError(error);
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      `Dữ liệu không hợp lệ: ${firstMessage}`,
      422,
      fields
    );
  }

  // 2. Custom OrderValidationError
  if (error instanceof OrderValidationError) {
    return createApiErrorResponse(
      error.code,
      error.message,
      error.status,
      error.field ? { [error.field]: error.message } : undefined
    );
  }

  // 3. Prisma Client Errors
  if (error?.code === "P2002") {
    return createApiErrorResponse(
      "CONFLICT",
      "Dữ liệu đã tồn tại trong hệ thống (trùng lặp mã hoặc khóa duy nhất)",
      409
    );
  }
  if (error?.code === "P2025") {
    return createApiErrorResponse("NOT_FOUND", "Không tìm thấy bản ghi yêu cầu trong hệ thống", 404);
  }

  // 4. Lỗi máy in ESC/POS
  if (error?.name === "PrinterError" || error?.message?.includes("ESC/POS")) {
    return createApiErrorResponse(
      "PRINTER_ERROR",
      "Không thể kết nối máy in hóa đơn. Vui lòng kiểm tra cáp mạng hoặc giấy in",
      500
    );
  }

  // 5. Lỗi chung khác (Gửi về Sentry & log JSON)
  const msg = error?.message || "Đã xảy ra lỗi không xác định từ máy chủ";
  try {
    Sentry.captureException(error);
  } catch {}
  logger.error(msg, error);
  return createApiErrorResponse("INTERNAL_SERVER_ERROR", msg, 500);
}

/**
 * Hàm chuyển đổi lỗi thành thông báo thân thiện tiếng Việt cho Client / Toast
 * Đảm bảo KHÔNG hiển thị raw stack trace hay lỗi cơ sở dữ liệu kỹ thuật
 */
export function formatFriendlyErrorMessage(error: any): string {
  if (!error) return "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại!";

  // Nếu là response từ API chuẩn { error: { message, code } }
  if (typeof error === "object") {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      // Làm sạch các lỗi raw kỹ thuật
      const msg = String(error.message);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("fetch failed")) {
        return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng Wi-Fi của quán!";
      }
      if (msg.includes("SyntaxError") || msg.includes("JSON")) {
        return "Phản hồi từ máy chủ không đúng định dạng. Vui lòng thử lại sau!";
      }
      if (msg.includes("Prisma") || msg.includes("UNIQUE constraint") || msg.includes("foreign key")) {
        return "Dữ liệu bị xung đột hoặc đang được xử lý ở một máy khác. Vui lòng kiểm tra lại!";
      }
      return msg;
    }
  }

  if (typeof error === "string") {
    if (error.includes("Failed to fetch") || error.includes("NetworkError")) {
      return "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng Wi-Fi!";
    }
    return error;
  }

  return "Hệ thống gặp sự cố tạm thời. Vui lòng bấm thử lại hoặc liên hệ quản lý!";
}
