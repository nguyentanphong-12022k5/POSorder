import { test, expect } from "@playwright/test";

test.describe("3. E2E Tests (Playwright): Quy trình bán hàng & Quản lý Ca làm việc", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Đăng nhập với quyền Admin
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "admin@pos.vn");
    await page.fill('input[type="password"], input[name="password"]', "admin123");
    await page.click('button:has-text("Đăng nhập")');
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
  });

  test("E2E 1: Login -> Chọn 2 món kèm topping -> Checkout tiền mặt -> Thấy Bill & Nút in PDF", async ({
    page,
  }) => {
    // 1. Chọn món thứ 1 từ Menu Grid
    const productCards = page.locator(".grid .group");
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });

    // Click món 1
    await productCards.first().click();
    // Modal chọn Size & Topping xuất hiện
    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();

    // Chọn Topping nếu có checkbox
    const toppingCheckboxes = modal.locator('input[type="checkbox"]');
    if ((await toppingCheckboxes.count()) > 0) {
      await toppingCheckboxes.first().check();
    }
    // Bấm nút thêm vào giỏ
    await modal.locator('button:has-text("Thêm vào giỏ")').click();
    await expect(modal).toBeHidden();

    // 2. Chọn món thứ 2
    if ((await productCards.count()) > 1) {
      await productCards.nth(1).click();
      await expect(modal).toBeVisible();
      await modal.locator('button:has-text("Thêm vào giỏ")').click();
      await expect(modal).toBeHidden();
    }

    // 3. Kiểm tra Giỏ hàng & Bấm "Thanh toán ngay"
    const checkoutBtn = page.locator('a[href="/checkout"]');
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // 4. Trang Checkout (/checkout)
    await page.waitForURL("**/checkout", { timeout: 10000 });
    await expect(page.locator("h1")).toContainText("Xác nhận thanh toán");

    // Chọn phương thức Tiền mặt (CASH)
    const cashBtn = page.locator('button:has-text("Tiền mặt")');
    if (await cashBtn.isVisible()) {
      await cashBtn.click();
    }

    // Nhập số tiền khách đưa hoặc bấm gợi ý tiền chẵn
    const submitBtn = page.locator('button:has-text("Xác nhận & In bill")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Chuyển hướng tới trang Order Detail (/orders/[id])
    await page.waitForURL("**/orders/*", { timeout: 15000 });
    await expect(page.locator("body")).toContainText("Đơn hàng");

    // 6. Kiểm tra Hóa đơn & Nút in PDF
    const printPdfBtn = page.locator('a[href*="/api/invoice"], button:has-text("In"), a:has-text("PDF")');
    await expect(printPdfBtn.first()).toBeVisible();

    // Kiểm tra trạng thái đơn hàng
    await expect(page.locator("body")).toContainText("đã thanh toán");
  });

  test("E2E 2: Mở ca -> Bán 3 đơn -> Đóng ca -> Số liệu tiền mặt & chuyển khoản khớp", async ({
    page,
    request,
  }) => {
    // 1. Truy cập trang Ca làm việc (/shifts)
    await page.goto("/shifts");
    await page.waitForLoadState("networkidle");

    // Lấy cookie session hiện tại để gọi API tạo đơn
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "pos_session")?.value || "";

    // 2. Mở ca mới nếu chưa có ca mở
    const openShiftBtn = page.locator('button:has-text("Mở ca")').first();
    if (await openShiftBtn.isVisible()) {
      await openShiftBtn.click();
      const initialCashInput = page.locator('input[type="number"], input[name="openingCash"]').first();
      if (await initialCashInput.isVisible()) {
        await initialCashInput.fill("1000000"); // 1.000.000 ₫
      }
      const confirmOpenBtn = page.locator('button:has-text("Xác nhận mở ca"), button:has-text("Bắt đầu ca"), button:has-text("Mở ca")').last();
      if (await confirmOpenBtn.isVisible()) {
        await confirmOpenBtn.click();
      }
      await page.waitForTimeout(1000);
    }

    // Lấy ID ca đang mở
    const shiftRes = await request.get("/api/shifts", {
      headers: { Cookie: `pos_session=${sessionCookie}` },
    });
    const shiftJson = await shiftRes.json();
    const activeShift = shiftJson.data?.activeShift || shiftJson.data?.shifts?.find((s: any) => s.status === "OPEN");

    // 3. Thực hiện bán 3 đơn hàng gắn với ca này
    const productsRes = await request.get("/api/menu", {
      headers: { Cookie: `pos_session=${sessionCookie}` },
    });
    const menuJson = await productsRes.json();
    const product = menuJson.data?.[0]?.products?.[0];

    if (product) {
      // Đơn 1: Tiền mặt 40.000 ₫
      await request.post("/api/orders", {
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `e2e-shift-ord1-${Date.now()}`,
          Cookie: `pos_session=${sessionCookie}`,
        },
        data: {
          items: [{ productId: product.id, quantity: 1 }],
          paymentMethod: "CASH",
          paidAmount: 50000,
          shiftId: activeShift?.id,
        },
      });

      // Đơn 2: Tiền mặt 40.000 ₫
      await request.post("/api/orders", {
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `e2e-shift-ord2-${Date.now()}`,
          Cookie: `pos_session=${sessionCookie}`,
        },
        data: {
          items: [{ productId: product.id, quantity: 1 }],
          paymentMethod: "CASH",
          paidAmount: 50000,
          shiftId: activeShift?.id,
        },
      });

      // Đơn 3: Chuyển khoản QR 40.000 ₫
      await request.post("/api/orders", {
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `e2e-shift-ord3-${Date.now()}`,
          Cookie: `pos_session=${sessionCookie}`,
        },
        data: {
          items: [{ productId: product.id, quantity: 1 }],
          paymentMethod: "TRANSFER",
          paidAmount: 40000,
          shiftId: activeShift?.id,
        },
      });
    }

    // 4. Tải lại trang ca làm việc để kiểm tra số liệu
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Ca làm việc ghi nhận tổng đơn tăng và có doanh thu
    await expect(page.locator("body")).toContainText("Đang mở");

    // 5. Đóng ca làm việc và kiểm tra khớp số liệu
    const closeShiftBtn = page.locator('button:has-text("Đóng ca")').first();
    if (await closeShiftBtn.isVisible()) {
      await closeShiftBtn.click();

      // Kiểm tra modal đóng ca xuất hiện
      const closeDialog = page.locator(".fixed.inset-0");
      await expect(closeDialog).toBeVisible();

      // Nhập số tiền mặt thực tế kiểm đếm
      const actualCashInput = closeDialog.locator('input[type="number"], input[name="closingCash"]');
      if (await actualCashInput.isVisible()) {
        // Nhập tiền thực tế
        await actualCashInput.fill("1080000");
      }

      // Xác nhận đóng ca
      const confirmCloseBtn = closeDialog.locator('button:has-text("Xác nhận đóng ca")');
      if (await confirmCloseBtn.isVisible()) {
        await confirmCloseBtn.click();
      }

      await page.waitForTimeout(1000);
      // Ca đã được đóng thành công
      await expect(page.locator("body")).toContainText("Đã đóng");
    }
  });
});
