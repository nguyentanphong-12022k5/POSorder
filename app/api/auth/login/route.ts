import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập đầy đủ Email và Mật khẩu" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Tìm kiếm trong bảng Profile
    const profile = await prisma.profile.findUnique({
      where: { email: cleanEmail },
    });

    if (!profile || profile.password !== password) {
      return NextResponse.json(
        { success: false, error: "Tài khoản hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    // Tạo token bảo mật
    const sessionUser = {
      id: profile.id,
      email: profile.email,
      role: profile.role as "admin" | "staff",
      name: profile.name,
      shopId: profile.shopId || "shop_default",
    };

    const token = await createAuthToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      message: "Đăng nhập thành công!",
      data: sessionUser,
    });

    // Thiết lập cookie HTTP-Only an toàn chống XSS
    const isLocalhost = req.headers.get("host")?.includes("localhost") || req.headers.get("host")?.includes("127.0.0.1");
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocalhost,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 ngày
    });

    return response;
  } catch (error: any) {
    console.error("Lỗi đăng nhập:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi đăng nhập" },
      { status: 500 }
    );
  }
}
