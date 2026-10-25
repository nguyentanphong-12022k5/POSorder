"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { formatFriendlyErrorMessage } from "@/lib/errors";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: any, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (error: any, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: any, title?: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      // Đảm bảo thông điệp lỗi luôn thân thiện tiếng Việt và không lộ raw error
      const friendlyMessage =
        type === "error" ? formatFriendlyErrorMessage(message) : String(message);

      const newToast: ToastItem = {
        id,
        type,
        message: friendlyMessage,
        title: title || (type === "error" ? "Có lỗi xảy ra" : type === "success" ? "Thành công" : "Thông báo"),
      };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast("success", message, title),
    [showToast]
  );

  const showError = useCallback(
    (error: any, title?: string) => showToast("error", error, title),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => showToast("warning", message, title),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, removeToast }}
    >
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((toast) => {
          let bg = "bg-white border-slate-200 text-slate-800";
          let icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;

          if (toast.type === "success") {
            bg = "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-emerald-500/10";
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          } else if (toast.type === "error") {
            bg = "bg-red-50 border-red-300 text-red-950 shadow-red-500/10";
            icon = <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
          } else if (toast.type === "warning") {
            bg = "bg-amber-50 border-amber-300 text-amber-950 shadow-amber-500/10";
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg transition-all transform duration-200 animate-in slide-in-from-top-2 fade-in ${bg}`}
            >
              {icon}
              <div className="flex-1 text-xs">
                {toast.title && (
                  <p className="font-bold text-xs mb-0.5 tracking-tight">
                    {toast.title}
                  </p>
                )}
                <p className="leading-relaxed opacity-90">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-50 hover:opacity-100 p-0.5 rounded-md transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
