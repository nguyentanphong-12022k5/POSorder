import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import OfflineSyncBanner from "@/components/pos/OfflineSyncBanner";

export const viewport: Viewport = {
  themeColor: "#d97706",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "POS Order Đồ Uống - Quản lý & In Hóa Đơn",
  description: "Hệ thống POS bán hàng nước uống, in hóa đơn 80mm & màn hình bếp KDS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "POS Order",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-100/70 text-slate-900 antialiased selection:bg-amber-100 selection:text-amber-900 touch-manipulation">
        <ToastProvider>
          <Navbar />
          <OfflineSyncBanner />
          <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
