"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, X, Check, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  reasonValue?: string;
  onReasonChange?: (val: string) => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy bỏ",
  isDanger = true,
  requireReason = false,
  reasonPlaceholder = "Nhập lý do...",
  reasonValue = "",
  onReasonChange,
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Xử lý phím tắt Escape để đóng dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Tự động focus vào nút xác nhận khi mở
    confirmBtnRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const isConfirmDisabled = isLoading || (requireReason && !reasonValue.trim());

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Dialog */}
        <div className="p-6 text-center space-y-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
              isDanger
                ? "bg-red-50 text-red-600 ring-8 ring-red-50/60"
                : "bg-amber-50 text-amber-600 ring-8 ring-amber-50/60"
            }`}
          >
            {isDanger ? (
              <Trash2 className="w-7 h-7" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3
              id="confirm-dialog-title"
              className="text-lg font-black text-slate-800"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-desc"
              className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto"
            >
              {description}
            </p>
          </div>

          {/* Ô nhập lý do nếu yêu cầu (ví dụ: Hủy đơn hàng) */}
          {requireReason && (
            <div className="text-left space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 block">
                Lý do xác nhận <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reasonValue}
                onChange={(e) => onReasonChange?.(e.target.value)}
                placeholder={reasonPlaceholder}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Buttons (Touch target >= 44px) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isDanger
                ? "bg-red-600 hover:bg-red-700 shadow-red-600/30 focus-visible:ring-red-500"
                : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30 focus-visible:ring-amber-500"
            } ${isConfirmDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
