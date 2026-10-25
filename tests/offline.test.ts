import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  savePendingOrder,
  getPendingOrders,
  getPendingOrdersCount,
  updatePendingOrderStatus,
  removePendingOrder,
  cacheMenuOffline,
  getCachedMenuOffline,
} from "@/lib/offline/db";
import { offlineManager } from "@/lib/offline/offlineManager";

describe("Nâng cấp POS Chạy Khi Mất Mạng (Offline-First)", () => {
  beforeEach(async () => {
    // Xóa toàn bộ pending orders trước mỗi test
    const orders = await getPendingOrders();
    for (const ord of orders) {
      await removePendingOrder(ord.id);
    }
  });

  it("1. Lưu đơn ngoại tuyến vào IndexedDB (bảng pendingOrders) với Idempotency-Key", async () => {
    const idempotencyKey = "uuid-test-123456";
    const samplePayload = {
      items: [
        {
          productId: "prod_01",
          quantity: 2,
          unitPrice: 30000,
          toppings: [],
        },
      ],
      paymentMethod: "CASH",
      paidAmount: 60000,
      total: 60000,
      orderType: "TAKEAWAY",
    };

    const saved = await savePendingOrder(samplePayload, idempotencyKey);

    expect(saved).toBeDefined();
    expect(saved.id).toContain("OFFLINE-");
    expect(saved.idempotencyKey).toBe(idempotencyKey);
    expect(saved.syncStatus).toBe("PENDING");
    expect(saved.orderData.total).toBe(60000);

    // Kiểm tra đọc lại từ IndexedDB
    const list = await getPendingOrders();
    expect(list.length).toBe(1);
    expect(list[0].idempotencyKey).toBe(idempotencyKey);

    const count = await getPendingOrdersCount();
    expect(count).toBe(1);
  });

  it("2. Cập nhật trạng thái đơn: PENDING -> SYNCING -> SYNCED", async () => {
    const idempotencyKey = "uuid-test-sync-status";
    const saved = await savePendingOrder({ total: 50000 }, idempotencyKey);

    // Cập nhật SYNCING
    await updatePendingOrderStatus(saved.id, "SYNCING");
    let orders = await getPendingOrders();
    // getPendingOrders chỉ lấy PENDING nên orders phải rỗng
    expect(orders.length).toBe(0);

    // Cập nhật SYNCED kèm server response
    const mockServerOrder = { id: "server_ord_01", code: "HD0099" };
    await updatePendingOrderStatus(saved.id, "SYNCED", mockServerOrder);

    // Xóa đơn sau khi đồng bộ
    await removePendingOrder(saved.id);
    const count = await getPendingOrdersCount();
    expect(count).toBe(0);
  });

  it("3. Xung đột 409: Đánh dấu 'đã đồng bộ' an toàn thay vì báo lỗi", async () => {
    const idempotencyKey = "uuid-conflict-409";
    const saved = await savePendingOrder({ total: 45000 }, idempotencyKey);

    // Mock fetch trả về status 409 (đã có đơn với idempotencyKey này trên server)
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "CONFLICT", message: "Đã tồn tại đơn hàng với Idempotency-Key này" },
      }),
    });

    try {
      const syncResult = await offlineManager.replayPendingOrders();
      expect(syncResult.synced).toBe(1);
      expect(syncResult.failed).toBe(0);

      // Đơn đã được đánh dấu đồng bộ và dọn dẹp khỏi pendingOrders
      const remainingCount = await getPendingOrdersCount();
      expect(remainingCount).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("4. Cache và khôi phục thực đơn ngoại tuyến (offline menu)", async () => {
    const mockCategories = [
      {
        id: "cat_coffee",
        name: "Cà phê truyền thống",
        products: [
          { id: "p1", name: "Cà phê đen đá", basePrice: 20000 },
          { id: "p2", name: "Cà phê sữa đá", basePrice: 25000 },
        ],
      },
    ];

    await cacheMenuOffline(mockCategories);

    const cached = await getCachedMenuOffline();
    expect(cached).toBeDefined();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].name).toBe("Cà phê truyền thống");
    expect(cached?.[0].products.length).toBe(2);
  });

  it("5. Trạng thái mạng: Chip chuyển đổi ONLINE / OFFLINE / SYNCING", () => {
    offlineManager.setStatus("ONLINE");
    expect(offlineManager.getStatus()).toBe("ONLINE");

    offlineManager.setStatus("OFFLINE");
    expect(offlineManager.getStatus()).toBe("OFFLINE");

    offlineManager.setStatus("SYNCING");
    expect(offlineManager.getStatus()).toBe("SYNCING");
  });
});
