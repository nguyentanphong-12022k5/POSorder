import { create } from "zustand";
import { CartItem, CartItemTopping } from "@/types";

interface CartState {
  items: CartItem[];
  previousItems: CartItem[] | null;
  addItem: (item: {
    productId: string;
    name: string;
    imageUrl?: string | null;
    variantId?: string;
    variantName?: string;
    variantExtra: number;
    toppings: CartItemTopping[];
    basePrice: number;
    quantity: number;
    note?: string;
  }) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  rollback: () => void;
  snapshot: () => void;
  getSubtotal: () => number;
  getTotalItems: () => number;
}

// Hàm sinh hash key duy nhất cho 1 biến thể sản phẩm đã chọn
function generateCartItemId(
  productId: string,
  variantId?: string,
  toppings: CartItemTopping[] = [],
  note: string = ""
): string {
  const sortedToppingIds = toppings
    .map((t) => t.id)
    .sort()
    .join("-");
  return `${productId}_${variantId || "standard"}_${sortedToppingIds}_${note.trim().toLowerCase()}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  previousItems: null,

  snapshot: () => {
    set((state) => ({ previousItems: [...state.items] }));
  },

  rollback: () => {
    set((state) => {
      if (state.previousItems !== null) {
        return { items: [...state.previousItems], previousItems: null };
      }
      return state;
    });
  },

  addItem: (params) => {
    const toppingsTotal = params.toppings.reduce((sum, t) => sum + t.price, 0);
    const unitPrice = params.basePrice + params.variantExtra;
    const cleanNote = params.note?.trim() || "";
    const cartItemId = generateCartItemId(
      params.productId,
      params.variantId,
      params.toppings,
      cleanNote
    );

    set((state) => {
      // Lưu snapshot trước khi cập nhật Optimistic
      const prev = [...state.items];
      const existingIndex = state.items.findIndex((item) => item.id === cartItemId);

      if (existingIndex > -1) {
        // Món đã có trong giỏ với cùng size, topping, ghi chú -> tăng số lượng ngay tức thì
        const updatedItems = [...state.items];
        const existing = updatedItems[existingIndex];
        const newQty = existing.quantity + params.quantity;
        updatedItems[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal: (unitPrice + toppingsTotal) * newQty,
        };
        return { items: updatedItems, previousItems: prev };
      }

      // Món mới
      const newItem: CartItem = {
        id: cartItemId,
        productId: params.productId,
        name: params.name,
        imageUrl: params.imageUrl,
        variantId: params.variantId,
        variantName: params.variantName,
        variantExtra: params.variantExtra,
        toppings: params.toppings,
        unitPrice,
        quantity: params.quantity,
        lineTotal: (unitPrice + toppingsTotal) * params.quantity,
        note: cleanNote || undefined,
      };

      return { items: [...state.items, newItem], previousItems: prev };
    });
  },

  updateQuantity: (id, delta) => {
    set((state) => {
      const prev = [...state.items];
      const updatedItems = state.items
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            const toppingsTotal = item.toppings.reduce((sum, t) => sum + t.price, 0);
            return {
              ...item,
              quantity: newQty,
              lineTotal: (item.unitPrice + toppingsTotal) * newQty,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);

      return { items: updatedItems, previousItems: prev };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      previousItems: [...state.items],
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  clearCart: () => {
    set((state) => ({
      previousItems: [...state.items],
      items: [],
    }));
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.lineTotal, 0);
  },

  getTotalItems: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
