import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs/config";

const withPWA = withPWAInit({
  dest: "public",
  disable: false,
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\/api\/menu/,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pos-menu-cache",
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 24 * 60 * 60, // 24 giờ
          },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "pos-static-assets",
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 ngày
          },
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "pino", "pino-pretty"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG || "pos-order",
  project: process.env.SENTRY_PROJECT || "pos-drink-order",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default withSentryConfig(withPWA(nextConfig), sentryWebpackPluginOptions);
