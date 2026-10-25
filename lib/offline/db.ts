/**
 * IndexedDB Database Client for Offline-First POS System
 * Lưu trữ đơn hàng ngoại tuyến (pendingOrders) và cache thực đơn/cài đặt.
 */

export interface PendingOrder {
  id: string; // Tạm thời dạng OFFLINE-[timestamp]-[uuid]
  idempotencyKey: string;
  orderData: {
    items: any[];
    discount?: number;
    paymentMethod?: "CASH" | "TRANSFER";
    paidAmount?: number;
    note?: string;
    orderType?: "TAKEAWAY" | "DINE_IN";
    tableNumber?: string | null;
    customerPhone?: string | null;
    customerName?: string | null;
    pointsUsed?: number;
    shiftId?: string | null;
    [key: string]: any;
  };
  createdAt: string;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  syncAttempts: number;
  syncedAt?: string;
  error?: string;
  serverOrder?: any;
}

const DB_NAME = "POS_OFFLINE_DB";
const DB_VERSION = 1;
const STORE_PENDING_ORDERS = "pendingOrders";
const STORE_CACHED_MENU = "cachedMenu";
const STORE_CACHED_SETTINGS = "cachedSettings";

let dbInstance: IDBDatabase | null = null;

/**
 * Lấy đối tượng IndexedDB khả dụng (hỗ trợ cả Browser và Node/Vitest test runner)
 */
function getIDBFactory(): IDBFactory | null {
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof window !== "undefined" && "indexedDB" in window) return window.indexedDB;
  return null;
}

/**
 * Khởi tạo hoặc kết nối tới IndexedDB
 */
export async function getDB(): Promise<IDBDatabase | null> {
  const factory = getIDBFactory();
  if (!factory) {
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Object store: pendingOrders
      if (!db.objectStoreNames.contains(STORE_PENDING_ORDERS)) {
        const orderStore = db.createObjectStore(STORE_PENDING_ORDERS, {
          keyPath: "id",
        });
        orderStore.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
        orderStore.createIndex("syncStatus", "syncStatus", { unique: false });
        orderStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // 2. Object store: cachedMenu
      if (!db.objectStoreNames.contains(STORE_CACHED_MENU)) {
        db.createObjectStore(STORE_CACHED_MENU, { keyPath: "id" });
      }

      // 3. Object store: cachedSettings
      if (!db.objectStoreNames.contains(STORE_CACHED_SETTINGS)) {
        db.createObjectStore(STORE_CACHED_SETTINGS, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("Lỗi khởi tạo IndexedDB:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Lưu đơn hàng ngoại tuyến vào bảng pendingOrders
 */
export async function savePendingOrder(
  orderPayload: any,
  idempotencyKey: string
): Promise<PendingOrder> {
  const db = await getDB();
  const id = `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newPending: PendingOrder = {
    id,
    idempotencyKey,
    orderData: orderPayload,
    createdAt: now,
    syncStatus: "PENDING",
    syncAttempts: 0,
  };

  if (!db) {
    // Fallback sang localStorage nếu IndexedDB không khả dụng
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("POS_PENDING_ORDERS") || "[]";
      const list = JSON.parse(raw);
      list.push(newPending);
      localStorage.setItem("POS_PENDING_ORDERS", JSON.stringify(list));
    }
    return newPending;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ORDERS, "readwrite");
    const store = tx.objectStore(STORE_PENDING_ORDERS);
    const req = store.put(newPending);

    req.onsuccess = () => resolve(newPending);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lấy toàn bộ đơn hàng đang chờ đồng bộ (syncStatus = 'PENDING')
 */
export async function getPendingOrders(): Promise<PendingOrder[]> {
  const db = await getDB();
  if (!db) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("POS_PENDING_ORDERS") || "[]";
      return JSON.parse(raw).filter((o: PendingOrder) => o.syncStatus === "PENDING");
    }
    return [];
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ORDERS, "readonly");
    const store = tx.objectStore(STORE_PENDING_ORDERS);
    const index = store.index("syncStatus");
    const req = index.getAll("PENDING");

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Đếm số lượng đơn hàng ngoại tuyến đang chờ đồng bộ
 */
export async function getPendingOrdersCount(): Promise<number> {
  const list = await getPendingOrders();
  return list.length;
}

/**
 * Cập nhật trạng thái của đơn hàng trong IndexedDB
 */
export async function updatePendingOrderStatus(
  id: string,
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED",
  serverOrder?: any,
  error?: string
): Promise<void> {
  const db = await getDB();
  if (!db) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("POS_PENDING_ORDERS") || "[]";
      const list = JSON.parse(raw).map((o: PendingOrder) => {
        if (o.id === id) {
          return {
            ...o,
            syncStatus: status,
            serverOrder: serverOrder || o.serverOrder,
            error: error || o.error,
            syncedAt: status === "SYNCED" ? new Date().toISOString() : o.syncedAt,
            syncAttempts: (o.syncAttempts || 0) + 1,
          };
        }
        return o;
      });
      localStorage.setItem("POS_PENDING_ORDERS", JSON.stringify(list));
    }
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ORDERS, "readwrite");
    const store = tx.objectStore(STORE_PENDING_ORDERS);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item: PendingOrder = getReq.result;
      if (!item) return resolve();

      item.syncStatus = status;
      item.syncAttempts = (item.syncAttempts || 0) + 1;
      if (serverOrder) item.serverOrder = serverOrder;
      if (error) item.error = error;
      if (status === "SYNCED") item.syncedAt = new Date().toISOString();

      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Xóa đơn khỏi hàng đợi sau khi đã đồng bộ hoàn tất
 */
export async function removePendingOrder(id: string): Promise<void> {
  const db = await getDB();
  if (!db) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("POS_PENDING_ORDERS") || "[]";
      const list = JSON.parse(raw).filter((o: PendingOrder) => o.id !== id);
      localStorage.setItem("POS_PENDING_ORDERS", JSON.stringify(list));
    }
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ORDERS, "readwrite");
    const store = tx.objectStore(STORE_PENDING_ORDERS);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cache thực đơn để phục vụ offline
 */
export async function cacheMenuOffline(categories: any[]): Promise<void> {
  const db = await getDB();
  const payload = {
    id: "default",
    categories,
    updatedAt: new Date().toISOString(),
  };

  if (!db) {
    if (typeof window !== "undefined") {
      localStorage.setItem("POS_CACHED_MENU", JSON.stringify(payload));
    }
    return;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHED_MENU, "readwrite");
    const store = tx.objectStore(STORE_CACHED_MENU);
    const req = store.put(payload);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lấy thực đơn offline từ cache
 */
export async function getCachedMenuOffline(): Promise<any[] | null> {
  const db = await getDB();
  if (!db) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("POS_CACHED_MENU");
      if (raw) return JSON.parse(raw).categories;
    }
    return null;
  }

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_CACHED_MENU, "readonly");
    const store = tx.objectStore(STORE_CACHED_MENU);
    const req = store.get("default");

    req.onsuccess = () => {
      resolve(req.result ? req.result.categories : null);
    };
    req.onerror = () => resolve(null);
  });
}
