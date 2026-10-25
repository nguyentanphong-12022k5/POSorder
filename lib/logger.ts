import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// Danh sách các trường nhạy cảm (PII & Credentials) cần tự động che chắn (Redact)
const SENSITIVE_PATHS = [
  "password",
  "*.password",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "jwt",
  "*.jwt",
  "apiKey",
  "*.apiKey",
  "creditCard",
  "*.creditCard",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "user.password",
  "customer.phone",
  "phone",
];

export const baseLogger = pino({
  level: logLevel,
  redact: {
    paths: SENSITIVE_PATHS,
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  base: {
    service: "pos-order",
    env: process.env.NODE_ENV || "development",
  },
});

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => {
    if (meta) {
      baseLogger.info(meta, msg);
    } else {
      baseLogger.info(msg);
    }
  },
  warn: (msg: string, meta?: Record<string, any>) => {
    if (meta) {
      baseLogger.warn(meta, msg);
    } else {
      baseLogger.warn(msg);
    }
  },
  error: (msg: string, err?: any, meta?: Record<string, any>) => {
    const errorDetails =
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack, ...meta }
        : { rawError: err, ...meta };
    baseLogger.error(errorDetails, msg);
  },
  debug: (msg: string, meta?: Record<string, any>) => {
    if (meta) {
      baseLogger.debug(meta, msg);
    } else {
      baseLogger.debug(msg);
    }
  },

  /**
   * Log cấu trúc chuẩn cho API request
   */
  logRequest: (params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    shopId?: string;
    userId?: string;
  }) => {
    const { method, path, statusCode, durationMs, shopId, userId } = params;
    const isError = statusCode >= 400;
    const logFn = isError ? baseLogger.warn.bind(baseLogger) : baseLogger.info.bind(baseLogger);

    logFn(
      {
        http: {
          method,
          path,
          statusCode,
          durationMs,
        },
        context: {
          shopId,
          userId,
        },
      },
      `HTTP ${method} ${path} - ${statusCode} (${durationMs}ms)`
    );
  },
};

export default logger;
