import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/lib/store/cart";
import { useLanguageStore } from "@/lib/i18n";

describe("Unit Tests: lib/store/cart", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it("Thêm món vào giỏ hàng và tính subtotal đúng", () => {
    const store = useCartStore.getState();

    store.addItem({
      productId: "prod_01",
      name: "Trà sữa Ô Long",
      variantId: "var_L",
      variantName: "Size L",
      variantExtra: 5000,
      basePrice: 40000,
      quantity: 2,
      toppings: [{ id: "top_1", name: "Trân châu", price: 5000 }],
      note: "Ít đường",
    });

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(2);
    expect(items[0].unitPrice).toBe(45000); // 40k + 5k
    expect(items[0].lineTotal).toBe(100000); // (45k + 5k) * 2 = 100k

    expect(useCartStore.getState().getSubtotal()).toBe(100000);
    expect(useCartStore.getState().getTotalItems()).toBe(2);
  });

  it("Thêm cùng món với cùng size và topping -> Cộng dồn số lượng", () => {
    const store = useCartStore.getState();

    store.addItem({
      productId: "prod_01",
      name: "Trà sữa Ô Long",
      variantExtra: 0,
      basePrice: 40000,
      quantity: 1,
      toppings: [],
    });

    store.addItem({
      productId: "prod_01",
      name: "Trà sữa Ô Long",
      variantExtra: 0,
      basePrice: 40000,
      quantity: 3,
      toppings: [],
    });

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(4);
    expect(items[0].lineTotal).toBe(160000);
  });

  it("Tăng giảm số lượng và xóa món khi quantity <= 0", () => {
    const store = useCartStore.getState();

    store.addItem({
      productId: "prod_02",
      name: "Cà phê sữa đá",
      variantExtra: 0,
      basePrice: 25000,
      quantity: 2,
      toppings: [],
    });

    const itemId = useCartStore.getState().items[0].id;

    // Tăng 1
    useCartStore.getState().updateQuantity(itemId, 1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);

    // Giảm 2
    useCartStore.getState().updateQuantity(itemId, -2);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    // Giảm tiếp 1 -> Tự động xóa khỏi giỏ
    useCartStore.getState().updateQuantity(itemId, -1);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it("Xóa món trực tiếp và xóa sạch toàn bộ giỏ hàng", () => {
    const store = useCartStore.getState();

    store.addItem({
      productId: "p1",
      name: "Món 1",
      variantExtra: 0,
      basePrice: 30000,
      quantity: 1,
      toppings: [],
    });
    store.addItem({
      productId: "p2",
      name: "Món 2",
      variantExtra: 0,
      basePrice: 40000,
      quantity: 1,
      toppings: [],
    });

    expect(useCartStore.getState().items.length).toBe(2);

    const firstId = useCartStore.getState().items[0].id;
    useCartStore.getState().removeItem(firstId);
    expect(useCartStore.getState().items.length).toBe(1);

    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items.length).toBe(0);
    expect(useCartStore.getState().getSubtotal()).toBe(0);
    expect(useCartStore.getState().getTotalItems()).toBe(0);
  });

  it("Optimistic UI: Rollback giỏ hàng về trạng thái trước đó nếu có lỗi", () => {
    const store = useCartStore.getState();

    // 1. Thêm món ban đầu
    store.addItem({
      productId: "p1",
      name: "Trà Đào Cam Sả",
      variantExtra: 0,
      basePrice: 35000,
      quantity: 1,
      toppings: [],
    });
    expect(useCartStore.getState().items.length).toBe(1);

    // 2. Thao tác tiếp theo gây lỗi (ví dụ: thêm món hết nguyên liệu kho)
    store.addItem({
      productId: "p2_out_of_stock",
      name: "Bơ dầm kem",
      variantExtra: 0,
      basePrice: 45000,
      quantity: 1,
      toppings: [],
    });
    expect(useCartStore.getState().items.length).toBe(2);

    // 3. Rollback
    useCartStore.getState().rollback();
    expect(useCartStore.getState().items.length).toBe(1);
    expect(useCartStore.getState().items[0].name).toBe("Trà Đào Cam Sả");
  });
});

describe("Unit Tests: lib/i18n (Đa ngôn ngữ vi/en)", () => {
  it("Hỗ trợ dịch chuẩn cho tiếng Việt mặc định và chuyển đổi sang tiếng Anh", () => {
    const i18n = useLanguageStore.getState();

    // Mặc định tiếng Việt
    i18n.setLanguage("vi");
    expect(useLanguageStore.getState().language).toBe("vi");
    expect(i18n.t("pos.cartTitle")).toBe("Đơn hàng hiện tại");
    expect(i18n.t("pos.checkoutBtn")).toBe("Tiến hành thanh toán");

    // Toggle sang tiếng Anh
    i18n.toggleLanguage();
    expect(useLanguageStore.getState().language).toBe("en");
    expect(i18n.t("pos.cartTitle")).toBe("Current Order");
    expect(i18n.t("pos.checkoutBtn")).toBe("Proceed to Checkout");

    // Trở về tiếng Việt
    i18n.setLanguage("vi");
    expect(useLanguageStore.getState().language).toBe("vi");
  });
});
