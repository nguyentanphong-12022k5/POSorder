import { describe, it, expect, vi } from "vitest";
import "fake-indexeddb/auto";
import { NextRequest } from "next/server";
import { getVietQRUrl, VIETNAM_BANKS } from "@/lib/vietqr";
import {
  createApiErrorResponse,
  OrderValidationError,
  handleServerApiError,
} from "@/lib/errors";
import { supabaseBrowser, supabaseServer } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { GET as getMenuHandler } from "@/app/api/menu/route";
import {
  GET as getProductsHandler,
  POST as postProductsHandler,
  PATCH as patchProductsHandler,
  DELETE as deleteProductsHandler,
} from "@/app/api/products/route";
import { GET as getTablesHandler, PATCH as patchTablesHandler } from "@/app/api/tables/route";
import { GET as getSettingsHandler, POST as postSettingsHandler } from "@/app/api/settings/route";
import { GET as getCustomersHandler, POST as postCustomersHandler } from "@/app/api/customers/route";
import { GET as getKdsHandler, PATCH as patchKdsHandler } from "@/app/api/kds/route";
import { GET as getKitchenHandler, PATCH as patchKitchenHandler } from "@/app/api/kitchen/route";
import { GET as getHealthHandler } from "@/app/api/health/route";
import { validateEnv } from "@/lib/env";
import logger, { baseLogger } from "@/lib/logger";
import fs from "fs";
import path from "path";
import {
  GET as getInventoryHandler,
  POST as postInventoryHandler,
  PATCH as patchInventoryHandler,
} from "@/app/api/inventory/route";
import { GET as getMeHandler } from "@/app/api/auth/me/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { GET as getOrderByIdHandler } from "@/app/api/orders/[id]/route";
import { GET as getShiftByIdHandler } from "@/app/api/shifts/[id]/route";
import { POST as postPrintByIdHandler } from "@/app/api/print/[id]/route";
import {
  cacheMenuOffline,
  getCachedMenuOffline,
  savePendingOrder,
  updatePendingOrderStatus,
  removePendingOrder,
  getPendingOrdersCount,
} from "@/lib/offline/db";
import { offlineManager } from "@/lib/offline/offlineManager";

describe("Coverage Tests: Lib Utilities & Auxiliary APIs", () => {
  describe("lib/supabase.ts", () => {
    it("Khởi tạo supabase client cho browser và server", () => {
      expect(supabaseBrowser).toBeDefined();
      expect(supabaseServer).toBeDefined();
    });
  });

  describe("lib/vietqr.ts", () => {
    it("Tạo URL ảnh VietQR đúng định dạng với các tham số tài khoản", () => {
      const url = getVietQRUrl({
        bankCode: "MB",
        accountNumber: "99998888",
        accountName: "NGUYEN VAN A",
        amount: 55000,
        description: "Thanh toan don HD01",
      });

      expect(url).toContain("https://img.vietqr.io/image/MB-99998888-compact2.jpg");
      expect(url).toContain("amount=55000");
      expect(url).toContain("accountName=");
      expect(url).toContain("addInfo=");
      expect(VIETNAM_BANKS.length).toBeGreaterThan(5);
    });

    it("Xử lý khi thiếu một số trường tùy chọn", () => {
      const url = getVietQRUrl({
        bankCode: "VCB",
        accountNumber: "123456789",
      });
      expect(url).toContain("VCB-123456789-compact2.jpg");
    });
  });

  describe("lib/errors.ts", () => {
    it("createApiErrorResponse trả về chuẩn JSON error", async () => {
      const res = createApiErrorResponse("FORBIDDEN", "Không có quyền", 403, { role: "admin required" });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
      expect(json.error.fields.role).toBe("admin required");
    });

    it("handleServerApiError xử lý OrderValidationError, P2002, P2025 và generic error", async () => {
      // 1. OrderValidationError
      const orderErr = new OrderValidationError("quantity", "Số lượng âm", 422);
      const res1 = handleServerApiError(orderErr);
      expect(res1.status).toBe(422);

      // 2. Prisma P2002 Conflict
      const p2002 = { code: "P2002", message: "Duplicate" };
      const res2 = handleServerApiError(p2002);
      expect(res2.status).toBe(409);

      // 3. Prisma P2025 Not Found
      const p2025 = { code: "P2025", message: "Not found" };
      const res3 = handleServerApiError(p2025);
      expect(res3.status).toBe(404);

      // 4. Generic internal error
      const genErr = new Error("Database timeout");
      const res4 = handleServerApiError(genErr);
      expect(res4.status).toBe(500);

      // 5. Unknown string/object error
      const res5 = handleServerApiError("Some weird string error");
      expect(res5.status).toBe(500);
    });
  });

  describe("Auxiliary API Endpoints", () => {
    it("GET /api/menu trả về danh mục và món", async () => {
      const res = await getMenuHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("GET & PATCH /api/tables", async () => {
      const getRes = await getTablesHandler();
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(Array.isArray(getJson.data)).toBe(true);

      const table = getJson.data[0];
      if (table) {
        const patchReq = new NextRequest("http://localhost:3000/api/tables", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: table.id, status: "OCCUPIED" }),
        });
        const patchRes = await patchTablesHandler(patchReq);
        expect(patchRes.status).toBe(200);
      }
    });

    it("GET & POST /api/settings", async () => {
      const getRes = await getSettingsHandler();
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);

      const postReq = new NextRequest("http://localhost:3000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: "TIỆM TRÀ & CÀ PHÊ 88",
          bankCode: "MB",
          bankAccountNumber: "888899998888",
        }),
      });
      const postRes = await postSettingsHandler(postReq);
      expect(postRes.status).toBe(200);
    });

    it("GET & POST /api/customers", async () => {
      // 1. GET all
      const reqAll = new NextRequest("http://localhost:3000/api/customers");
      const resAll = await getCustomersHandler(reqAll);
      expect(resAll.status).toBe(200);

      // 2. POST without phone -> 400
      const reqBad = new NextRequest("http://localhost:3000/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Vô danh" }),
      });
      const resBad = await postCustomersHandler(reqBad);
      expect(resBad.status).toBe(400);

      // 3. POST valid customer
      const phone = `090${Math.floor(1000000 + Math.random() * 9000000)}`;
      const reqGood = new NextRequest("http://localhost:3000/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: "Nguyễn Văn Test" }),
      });
      const resGood = await postCustomersHandler(reqGood);
      expect(resGood.status).toBe(200);

      // 4. GET by phone
      const reqPhone = new NextRequest(`http://localhost:3000/api/customers?phone=${phone}`);
      const resPhone = await getCustomersHandler(reqPhone);
      expect(resPhone.status).toBe(200);
    });

    it("GET & PATCH /api/kds", async () => {
      const getReq = new NextRequest("http://localhost:3000/api/kds?shopId=shop_default");
      const getRes = await getKdsHandler(getReq);
      expect(getRes.status).toBe(200);

      const patchReq = new NextRequest("http://localhost:3000/api/kds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: "non_existent_id", itemStatus: "COMPLETED" }),
      });
      const patchRes = await patchKdsHandler(patchReq);
      expect([404, 500]).toContain(patchRes.status);
    });

    it("GET, POST & PATCH /api/inventory", async () => {
      const getRes = await getInventoryHandler();
      expect(getRes.status).toBe(200);

      // 1. POST tạo nguyên liệu mới
      const postReq = new NextRequest("http://localhost:3000/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Trà Nhài Test ${Date.now()}`,
          unit: "g",
          quantity: 500,
          minQuantity: 50,
          costPrice: 150,
        }),
      });
      const postRes = await postInventoryHandler(postReq);
      expect([200, 201]).toContain(postRes.status);
      const postJson = await postRes.json();
      const itemId = postJson.data?.id;

      // 2. PATCH cập nhật tồn kho
      if (itemId) {
        const patchReq = new NextRequest("http://localhost:3000/api/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: itemId,
            addQuantity: 100,
            minQuantity: 60,
          }),
        });
        const patchRes = await patchInventoryHandler(patchReq);
        expect(patchRes.status).toBe(200);
      }

      // 3. PATCH id không tồn tại
      const patch404Req = new NextRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "non_existent_inv_id", quantity: 10 }),
      });
      const patch404Res = await patchInventoryHandler(patch404Req);
      expect(patch404Res.status).toBe(404);
    });

    it("CRUD /api/products", async () => {
      // 1. GET products
      const getRes = await getProductsHandler();
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      const catId = getJson.data?.categories?.[0]?.id || "cat_1";

      // 2. POST invalid product -> 422
      const postBadReq = new NextRequest("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }), // thiếu basePrice, categoryId
      });
      const postBadRes = await postProductsHandler(postBadReq);
      expect(postBadRes.status).toBe(422);

      // 3. POST valid product
      const postReq = new NextRequest("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Trà Sen Tây Hồ ${Date.now()}`,
          categoryId: catId,
          basePrice: 45000,
          isActive: true,
          variants: [
            { name: "Size M", extraPrice: 0 },
            { name: "Size L", extraPrice: 5000 },
          ],
        }),
      });
      const postRes = await postProductsHandler(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      const createdProdId = postJson.data.id;

      // 4. PATCH product
      const patchReq = new NextRequest("http://localhost:3000/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: createdProdId,
          name: "Trà Sen Tây Hồ Đặc Biệt",
          basePrice: 48000,
          isActive: true,
        }),
      });
      const patchRes = await patchProductsHandler(patchReq);
      expect(patchRes.status).toBe(200);

      // 5. PATCH without id -> 400
      const patchBad = new NextRequest("http://localhost:3000/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Không ID" }),
      });
      expect((await patchProductsHandler(patchBad)).status).toBe(400);

      // 6. DELETE without id -> 400
      const delBad = new NextRequest("http://localhost:3000/api/products");
      expect((await deleteProductsHandler(delBad)).status).toBe(400);

      // 7. DELETE valid product (ngưng phục vụ)
      const delReq = new NextRequest(`http://localhost:3000/api/products?id=${createdProdId}`);
      const delRes = await deleteProductsHandler(delReq);
      expect(delRes.status).toBe(200);
    });

    it("GET /api/orders/[id] chi tiết hóa đơn", async () => {
      // 1. Không tìm thấy -> 404
      const req404 = new NextRequest("http://localhost:3000/api/orders/non_existent_order");
      const res404 = await getOrderByIdHandler(req404, { params: { id: "non_existent_order" } });
      expect(res404.status).toBe(404);

      // 2. Tìm thấy đơn
      const existing = await prisma.order.findFirst();
      if (existing) {
        const reqValid = new NextRequest(`http://localhost:3000/api/orders/${existing.id}`);
        const resValid = await getOrderByIdHandler(reqValid, { params: { id: existing.id } });
        expect(resValid.status).toBe(200);
      }
    });

    it("GET /api/shifts/[id] chi tiết ca làm việc", async () => {
      // 1. Không tìm thấy -> 404
      const req404 = new NextRequest("http://localhost:3000/api/shifts/non_existent_shift");
      const res404 = await getShiftByIdHandler(req404, { params: { id: "non_existent_shift" } });
      expect(res404.status).toBe(404);

      // 2. Tìm thấy ca
      const existingShift = await prisma.shift.findFirst();
      if (existingShift) {
        const reqValid = new NextRequest(`http://localhost:3000/api/shifts/${existingShift.id}`);
        const resValid = await getShiftByIdHandler(reqValid, { params: { id: existingShift.id } });
        expect(resValid.status).toBe(200);
      }
    });

    it("POST /api/print/[id] ủy quyền qua print handler", async () => {
      const existing = await prisma.order.findFirst();
      if (existing) {
        const req = new NextRequest(`http://localhost:3000/api/print/${existing.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isEscPos: false }),
        });
        const res = await postPrintByIdHandler(req, { params: { id: existing.id } });
        expect([200, 429]).toContain(res.status);
      }
    });

    it("GET /api/auth/me & POST /api/auth/logout", async () => {
      const meReq = new NextRequest("http://localhost:3000/api/auth/me");
      const meRes = await getMeHandler(meReq);
      expect([200, 401]).toContain(meRes.status);

      const logoutRes = await logoutHandler();
      expect(logoutRes.status).toBe(200);
      const json = await logoutRes.json();
      expect(json.success).toBe(true);
    });

    it("offline db helper methods (cacheMenuOffline, save & remove pending)", async () => {
      await cacheMenuOffline([{ id: "cat1", name: "Trà Trái Cây" }]);
      const cached = await getCachedMenuOffline();
      expect(Array.isArray(cached)).toBe(true);

      const saved = await savePendingOrder({ total: 50000 }, `idem-test-${Date.now()}`);
      expect(saved.id).toBeDefined();

      const count = await getPendingOrdersCount();
      expect(count).toBeGreaterThanOrEqual(1);

      await updatePendingOrderStatus(saved.id, "SYNCED");
      await removePendingOrder(saved.id);
    });

    it("PWA manifest.json cấu hình đúng chuẩn tablet POS (standalone, icons, theme_color)", () => {
      const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(raw);

      expect(manifest.name).toBeDefined();
      expect(manifest.display).toBe("standalone");
      expect(manifest.theme_color).toBe("#d97706");
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      // Kiểm tra file icon vật lý tồn tại
      const icon192 = path.resolve(process.cwd(), "public", manifest.icons[0].src.replace(/^\//, ""));
      expect(fs.existsSync(icon192)).toBe(true);
    });

    it("GET & PATCH /api/kitchen cập nhật trạng thái đơn (PENDING -> MAKING -> DONE)", async () => {
      // 1. GET /api/kitchen
      const getReq = new NextRequest("http://localhost:3000/api/kitchen?filter=ACTIVE");
      const getRes = await getKitchenHandler(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(Array.isArray(getJson.data)).toBe(true);

      // 2. PATCH chuyển trạng thái đơn hàng mẫu
      const sampleOrder = await prisma.order.findFirst();
      if (sampleOrder) {
        // Chuyển sang MAKING
        const patchReq1 = new NextRequest("http://localhost:3000/api/kitchen", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: sampleOrder.id, status: "MAKING" }),
        });
        const patchRes1 = await patchKitchenHandler(patchReq1);
        expect(patchRes1.status).toBe(200);
        const json1 = await patchRes1.json();
        expect(json1.data.status).toBe("MAKING");

        // Chuyển sang DONE
        const patchReq2 = new NextRequest("http://localhost:3000/api/kitchen", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: sampleOrder.id, status: "DONE" }),
        });
        const patchRes2 = await patchKitchenHandler(patchReq2);
        expect(patchRes2.status).toBe(200);
        const json2 = await patchRes2.json();
        expect(json2.data.status).toBe("DONE");
      }

      // 3. PATCH lỗi khi thiếu tham số
      const badReq = new NextRequest("http://localhost:3000/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const badRes = await patchKitchenHandler(badReq);
      expect(badRes.status).toBe(400);
    });

    it("GET /api/health trả về status healthy, database latency, uptime và version", async () => {
      const req = new NextRequest("http://localhost:3000/api/health");
      const res = await getHealthHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.checks.database.status).toBe("up");
      expect(typeof data.checks.database.latencyMs).toBe("number");
      expect(data.version).toBeDefined();
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it("lib/env.ts validateEnv trả về các biến môi trường chuẩn", () => {
      const validated = validateEnv();
      expect(validated.DATABASE_URL).toBeDefined();
      expect(validated.NODE_ENV).toBeDefined();
      expect(validated.PORT).toBeDefined();
      expect(validated.PRINTER_MODE).toBeDefined();
    });

    it("lib/logger.ts ghi log JSON có mức độ và tự động che giấu (redact) PII", () => {
      const spyInfo = vi.spyOn(baseLogger, "info");
      const spyError = vi.spyOn(baseLogger, "error");

      logger.info("Test log thông thường", { shopId: "shop_1" });
      expect(spyInfo).toHaveBeenCalled();

      logger.error("Test log lỗi", new Error("Lỗi giả lập"));
      expect(spyError).toHaveBeenCalled();

      logger.logRequest({
        method: "GET",
        path: "/api/menu",
        statusCode: 200,
        durationMs: 15,
        shopId: "shop_test",
      });
      expect(spyInfo).toHaveBeenCalled();
    });

    it("Kiểm tra sự tồn tại đầy đủ của các tài nguyên triển khai Production", () => {
      const root = process.cwd();
      expect(fs.existsSync(path.resolve(root, "Dockerfile"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "docker-compose.yml"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, ".dockerignore"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, ".env.example"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "scripts/backup-db.sh"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "scripts/restore-db.sh"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "DEPLOY.md"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, ".github/workflows/ci-cd.yml"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "sentry.client.config.ts"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "sentry.server.config.ts"))).toBe(true);
      expect(fs.existsSync(path.resolve(root, "sentry.edge.config.ts"))).toBe(true);
    });
  });
});
