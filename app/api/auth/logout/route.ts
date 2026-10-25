import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req?: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "Đăng xuất thành công",
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
