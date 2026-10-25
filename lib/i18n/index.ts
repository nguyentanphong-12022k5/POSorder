import { create } from "zustand";

export type Language = "vi" | "en";

export const translations = {
  vi: {
    // Navigation
    "nav.brand": "POS Tea & Coffee",
    "nav.subtitle": "Hệ thống F&B",
    "nav.pos": "Bán hàng",
    "nav.kitchen": "Bếp / Bar",
    "nav.tables": "Bàn",
    "nav.inventory": "Kho",
    "nav.shifts": "Ca bán",
    "nav.menu": "Menu",
    "nav.reports": "Báo cáo",
    "nav.settings": "Cài đặt",
    "nav.logout": "Đăng xuất",
    "nav.login": "Đăng nhập",

    // POS Screen
    "pos.searchPlaceholder": "Tìm kiếm đồ uống nhanh (Cà phê, Trà sữa, Đá xay...)",
    "pos.allProducts": "Tất cả món",
    "pos.noProducts": "Không tìm thấy đồ uống phù hợp",
    "pos.noProductsDesc": "Thử đổi danh mục hoặc tìm kiếm với từ khoá khác.",
    "pos.clearFilter": "Xóa bộ lọc & Xem tất cả món",
    "pos.cartTitle": "Đơn hàng hiện tại",
    "pos.itemsSelected": "món đã chọn",
    "pos.clearCart": "Xoá giỏ",
    "pos.emptyCartTitle": "Giỏ hàng đang trống",
    "pos.emptyCartDesc": "Chưa có đồ uống nào trong đơn. Vui lòng chọn món từ menu bên trái để bắt đầu tạo đơn!",
    "pos.selectItemCta": "Chọn món ngay",
    "pos.confirmClearCartTitle": "Xác nhận xoá toàn bộ giỏ hàng?",
    "pos.confirmClearCartDesc": "Hành động này sẽ xóa tất cả các món đã chọn trong đơn hàng hiện tại. Bạn sẽ cần chọn lại từ đầu.",
    "pos.confirmClear": "Xoá toàn bộ",
    "pos.keepCart": "Giữ lại",
    "pos.subtotal": "Tạm tính",
    "pos.total": "Tổng thanh toán",
    "pos.checkoutBtn": "Tiến hành thanh toán",
    "pos.size": "Kích cỡ (Size)",
    "pos.topping": "Thêm Topping",
    "pos.note": "Ghi chú đặc biệt",
    "pos.notePlaceholder": "Ví dụ: Ít đá, 50% đường, mang đi...",
    "pos.quantity": "Số lượng",
    "pos.addToCart": "Thêm vào giỏ",
    "pos.shortcutSearch": "Tìm kiếm nhanh",
    "pos.shortcutCheckout": "Thanh toán",

    // Common
    "common.confirm": "Xác nhận",
    "common.cancel": "Hủy bỏ",
    "common.loading": "Đang tải...",
    "common.success": "Thành công",
    "common.error": "Có lỗi xảy ra",
  },
  en: {
    // Navigation
    "nav.brand": "POS Tea & Coffee",
    "nav.subtitle": "F&B System",
    "nav.pos": "POS / Order",
    "nav.kitchen": "Kitchen / KDS",
    "nav.tables": "Tables",
    "nav.inventory": "Inventory",
    "nav.shifts": "Shifts",
    "nav.menu": "Menu",
    "nav.reports": "Reports",
    "nav.settings": "Settings",
    "nav.logout": "Logout",
    "nav.login": "Login",

    // POS Screen
    "pos.searchPlaceholder": "Search drinks (Coffee, Milk Tea, Freeze...)",
    "pos.allProducts": "All Items",
    "pos.noProducts": "No drinks found matching your search",
    "pos.noProductsDesc": "Try switching category or searching with different keywords.",
    "pos.clearFilter": "Reset Filter & Show All",
    "pos.cartTitle": "Current Order",
    "pos.itemsSelected": "items selected",
    "pos.clearCart": "Clear Cart",
    "pos.emptyCartTitle": "Your Cart is Empty",
    "pos.emptyCartDesc": "No drinks selected yet. Pick your favorite drinks from the menu on the left to start!",
    "pos.selectItemCta": "Browse Menu",
    "pos.confirmClearCartTitle": "Clear all items in cart?",
    "pos.confirmClearCartDesc": "This action will remove all selected drinks from the current order. You will need to start over.",
    "pos.confirmClear": "Clear All",
    "pos.keepCart": "Keep Items",
    "pos.subtotal": "Subtotal",
    "pos.total": "Total Amount",
    "pos.checkoutBtn": "Proceed to Checkout",
    "pos.size": "Size Selection",
    "pos.topping": "Add Toppings",
    "pos.note": "Special Notes",
    "pos.notePlaceholder": "e.g. Less ice, 50% sugar, takeaway...",
    "pos.quantity": "Quantity",
    "pos.addToCart": "Add to Cart",
    "pos.shortcutSearch": "Quick Search",
    "pos.shortcutCheckout": "Checkout",

    // Common
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
    "common.success": "Success",
    "common.error": "An error occurred",
  },
} as const;

export type TranslationKey = keyof typeof translations.vi;

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: "vi",

  setLanguage: (lang: Language) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_lang", lang);
    }
    set({ language: lang });
  },

  toggleLanguage: () => {
    const nextLang: Language = get().language === "vi" ? "en" : "vi";
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_lang", nextLang);
    }
    set({ language: nextLang });
  },

  t: (key: TranslationKey) => {
    const currentLang = get().language;
    return translations[currentLang]?.[key] || translations.vi[key] || key;
  },
}));

// Khởi tạo từ localStorage nếu ở client
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("pos_lang") as Language | null;
  if (saved && (saved === "vi" || saved === "en")) {
    useLanguageStore.setState({ language: saved });
  }
}
