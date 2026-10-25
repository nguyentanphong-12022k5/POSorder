import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    environment: process.env.NODE_ENV || "development",
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],
  });
}
