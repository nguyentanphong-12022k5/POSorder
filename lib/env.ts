import { z } from "zod";

/**
 * Zod Schema định nghĩa và kiểm tra toàn bộ biến môi trường của hệ thống POS
 */
const serverEnvSchema = z.object({
  // Cơ sở dữ liệu PostgreSQL
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL là bắt buộc (ví dụ: postgresql://user:pass@localhost:5432/posdb)"),

  // Môi trường & Cổng
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Bảo mật Authentication
  JWT_SECRET: z.string().min(8, "JWT_SECRET tối thiểu 8 ký tự").default("pos-production-secret-change-me"),

  // Cấu hình máy in hóa đơn ESC/POS
  PRINTER_MODE: z.enum(["tcp", "usb", "network"]).default("tcp"),
  PRINTER_IP: z.string().default("192.168.1.100"),
  PRINTER_PORT: z.coerce.number().default(9100),
  PRINTER_MODEL: z.string().default("Xprinter XP-58 / Epson TM-T82"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Giám sát lỗi Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("1.0.0"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const fullEnvSchema = serverEnvSchema.merge(clientEnvSchema);

export type Env = z.infer<typeof fullEnvSchema>;

/**
 * Hàm validate biến môi trường khi hệ thống khởi động
 */
export function validateEnv(): Env {
  const isServer = typeof window === "undefined";
  const targetSchema = isServer ? fullEnvSchema : clientEnvSchema;

  const rawEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET,
    PRINTER_MODE: process.env.PRINTER_MODE,
    PRINTER_IP: process.env.PRINTER_IP,
    PRINTER_PORT: process.env.PRINTER_PORT,
    PRINTER_MODEL: process.env.PRINTER_MODEL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };

  const parsed = targetSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error("❌ [ENV Validation Error] Phát hiện biến môi trường không hợp lệ hoặc bị thiếu:");
    const errors = parsed.error.flatten().fieldErrors;
    for (const [key, msgs] of Object.entries(errors)) {
      console.error(`  - ${key}: ${msgs?.join(", ")}`);
    }

    if (process.env.NODE_ENV === "production" && isServer) {
      throw new Error(`[CRITICAL] Biến môi trường không hợp lệ: ${Object.keys(errors).join(", ")}`);
    }
  }

  return (parsed.success ? parsed.data : rawEnv) as Env;
}

export const env = validateEnv();
export default env;
