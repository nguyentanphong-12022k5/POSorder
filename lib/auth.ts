import { NextRequest, NextResponse } from "next/server";

export interface SessionUser {
  id: string;
  email: string;
  role: "admin" | "staff";
  name: string;
  shopId: string;
}

const JWT_SECRET = process.env.AUTH_SECRET || "pos-drink-order-super-secret-key-2026";
export const AUTH_COOKIE_NAME = "pos_session";

// Chuyển string sang Uint8Array
function strToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Chuyển ArrayBuffer hoặc Uint8Array sang Base64Url
function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Base64Url decode sang Uint8Array (cho chữ ký số và dữ liệu nhị phân)
function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Base64Url decode sang UTF-8 string (cho JSON payload tiếng Việt không lỗi font)
function base64UrlToStr(base64url: string): string {
  const bytes = base64UrlToBytes(base64url);
  return new TextDecoder().decode(bytes);
}

// Lấy CryptoKey HMAC-SHA256
async function getCryptoKey(): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    strToUint8Array(JWT_SECRET) as any,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Tạo token phiên đăng nhập mã hóa ký số HMAC-SHA256 (Tương thích Edge Middleware)
 */
export async function createAuthToken(user: SessionUser): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 ngày
  };

  const headerB64 = bufferToBase64Url(strToUint8Array(JSON.stringify(header)));
  const payloadB64 = bufferToBase64Url(strToUint8Array(JSON.stringify(payload)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign("HMAC", key, strToUint8Array(dataToSign) as any);
  const sigB64 = bufferToBase64Url(signature);

  return `${dataToSign}.${sigB64}`;
}

/**
 * Kiểm tra tính hợp lệ của token phiên
 */
export async function verifyAuthToken(token: string): Promise<SessionUser | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;

    const sigBytes = base64UrlToBytes(sigB64);

    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as any,
      strToUint8Array(dataToVerify) as any
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlToStr(payloadB64));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      shopId: payload.shopId || "shop_default",
    };
  } catch {
    return null;
  }
}

/**
 * Trích xuất người dùng hiện tại từ NextRequest cookies hoặc Authorization Header
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token =
    req.cookies.get(AUTH_COOKIE_NAME)?.value ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    null;

  if (!token) return null;
  return await verifyAuthToken(token);
}
