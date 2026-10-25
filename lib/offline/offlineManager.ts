/**
 * Offline Synchronization Manager
 * Xử lý phát hiện trạng thái mạng, tự động replay các đơn hàng ngoại tuyến (Idempotency-Key),
 * xử lý 409 Conflict an toàn và đồng bộ dữ liệu.
 */

import {
  getPendingOrders,
  getPendingOrdersCount,
  updatePendingOrderStatus,
  removePendingOrder,
  PendingOrder,
} from "./db";

export type NetworkStatus = "ONLINE" | "OFFLINE" | "SYNCING";

type StatusListener = (status: NetworkStatus, pendingCount: number) => void;

class OfflineManager {
  private status: NetworkStatus = "ONLINE";
  private pendingCount: number = 0;
  private listeners: Set<StatusListener> = new Set();
  private isSyncRunning: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.status =
        typeof navigator !== "undefined" && navigator.onLine === false ? "OFFLINE" : "ONLINE";
      this.initEvents();
      this.refreshPendingCount();
    }
  }

  private initEvents() {
    window.addEventListener("online", () => {
      console.log("[OfflineManager] Phát hiện mạng đã kết nối trở lại 🟢");
      this.setStatus("ONLINE");
      this.replayPendingOrders();
    });

    window.addEventListener("offline", () => {
      console.log("[OfflineManager] Phát hiện mất kết nối mạng 🔴");
      this.setStatus("OFFLINE");
    });
  }

  public subscribe(listener: StatusListener) {
    this.listeners.add(listener);
    listener(this.status, this.pendingCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener(this.status, this.pendingCount);
    });
  }

  public setStatus(newStatus: NetworkStatus) {
    this.status = newStatus;
    this.notify();
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      this.pendingCount = await getPendingOrdersCount();
      this.notify();
      return this.pendingCount;
    } catch {
      return 0;
    }
  }

  public getStatus(): NetworkStatus {
    return this.status;
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  /**
   * Replay toàn bộ đơn hàng đang chờ đồng bộ lên máy chủ
   */
  public async replayPendingOrders(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncRunning) {
      console.log("[OfflineManager] Tiến trình đồng bộ đang chạy, bỏ qua gọi trùng...");
      return { synced: 0, failed: 0 };
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("OFFLINE");
      return { synced: 0, failed: 0 };
    }

    const pendingList = await getPendingOrders();
    if (pendingList.length === 0) {
      this.pendingCount = 0;
      this.setStatus("ONLINE");
      return { synced: 0, failed: 0 };
    }

    this.isSyncRunning = true;
    this.setStatus("SYNCING");

    let syncedCount = 0;
    let failedCount = 0;

    console.log(`[OfflineManager] Bắt đầu đồng bộ ${pendingList.length} đơn ngoại tuyến...`);

    for (const order of pendingList) {
      try {
        await updatePendingOrderStatus(order.id, "SYNCING");

        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": order.idempotencyKey,
            "X-Offline-Replay": "true",
          },
          body: JSON.stringify(order.orderData),
        });

        // 5. Xử lý xung đột: nếu server trả 409 (đã có đơn) -> Đánh dấu "đã đồng bộ"
        if (response.status === 409) {
          console.warn(
            `[OfflineManager] Đơn ${order.id} nhận mã 409 (Idempotency conflict/đã tồn tại đơn). Đánh dấu ĐÃ ĐỒNG BỘ an toàn.`
          );
          await updatePendingOrderStatus(order.id, "SYNCED", null);
          await removePendingOrder(order.id);
          syncedCount++;
          await this.refreshPendingCount();
          continue;
        }

        let result: any = {};
        try {
          result = await response.json();
        } catch {
          result = {};
        }

        if (response.ok && (result.success || result.data)) {
          console.log(
            `[OfflineManager] Đồng bộ thành công đơn ${order.id} -> Mã server: ${result.data?.code}`
          );
          await updatePendingOrderStatus(order.id, "SYNCED", result.data);
          await removePendingOrder(order.id);
          syncedCount++;
        } else {
          // Lỗi từ server (422 validation, hết nguyên liệu...)
          console.error(`[OfflineManager] Lỗi nghiệp vụ từ server cho đơn ${order.id}:`, result);
          const errorMsg = result.error?.message || result.message || "Lỗi xử lý server";
          await updatePendingOrderStatus(order.id, "FAILED", null, errorMsg);
          failedCount++;
        }
      } catch (networkErr: any) {
        console.warn(`[OfflineManager] Mất kết nối khi đang gửi đơn ${order.id}:`, networkErr);
        await updatePendingOrderStatus(order.id, "PENDING");
        this.setStatus("OFFLINE");
        break; // Dừng lại chờ kết nối mạng phục hồi
      }

      await this.refreshPendingCount();
    }

    this.isSyncRunning = false;
    const remaining = await this.refreshPendingCount();

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("OFFLINE");
    } else {
      this.setStatus("ONLINE");
    }

    // Phát sự kiện toàn cục để các component (Menu, Reports, v.v.) cập nhật nếu cần
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("pos-sync-completed", {
          detail: { synced: syncedCount, remaining },
        })
      );
    }

    return { synced: syncedCount, failed: failedCount };
  }
}

// Singleton instance
export const offlineManager = new OfflineManager();
