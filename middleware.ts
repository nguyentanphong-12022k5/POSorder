import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, AUTH_COOKIE_NAME } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bỏ qua các file tĩnh, service worker PWA và tài nguyên hệ thống
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname === "/sw.js" ||
    pathname.startsWith("/swe-worker") ||
    pathname.startsWith("/workbox-") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Route đăng nhập, API auth và health check luôn công khai
  if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname === "/api/health") {
    return NextResponse.next();
  }

  // 1. Kiểm tra session phiên đăng nhập từ cookie hoặc Authorization header
  const token =
    req.cookies.get(AUTH_COOKIE_NAME)?.value ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    null;

  const session = token ? await verifyAuthToken(token) : null;

  // 2. Kiểm tra bảo vệ các Route API nhạy cảm (/api/orders, /api/print/*, /api/reports)
  if (
    pathname.startsWith("/api/orders") ||
    pathname.startsWith("/api/print") ||
    pathname.startsWith("/api/reports") ||
    pathname.startsWith("/api/products") ||
    pathname.startsWith("/api/settings") ||
    pathname.startsWith("/api/inventory") ||
    pathname.startsWith("/api/shifts") ||
    pathname.startsWith("/api/kds") ||
    pathname.startsWith("/api/kitchen")
  ) {
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Yêu cầu đăng nhập để truy cập tài nguyên này",
        },
        { status: 401 }
      );
    }

    // Các API chỉ dành riêng cho Admin
    if (
      (pathname.startsWith("/api/reports") ||
        pathname.startsWith("/api/settings") ||
        (pathname.startsWith("/api/products") && req.method !== "GET")) &&
      session.role !== "admin"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Tài khoản của bạn không có quyền Quản trị viên (Admin)",
        },
        { status: 403 }
      );
    }

    // Gắn thông tin session vào request headers để Route Handler sử dụng chống IDOR
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", session.id);
    requestHeaders.set("x-user-email", session.email);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-user-shop-id", session.shopId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 3. Chặn các trang giao diện nếu chưa login
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Chặn các trang Admin (/(admin): /menu, /reports, /settings) nếu role !== 'admin'
  const adminPaths = ["/menu", "/reports", "/settings"];
  const isAdminPath = adminPaths.some((p) => pathname.startsWith(p));

  if (isAdminPath && session.role !== "admin") {
    // Thu ngân cố vào trang Admin -> Chuyển hướng về trang POS bán hàng
    const posHomeUrl = new URL("/?error=forbidden", req.url);
    return NextResponse.redirect(posHomeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Áp dụng middleware cho tất cả các request ngoại trừ assets tĩnh
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
