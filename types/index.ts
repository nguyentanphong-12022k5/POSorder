export interface Variant {
  id: string;
  productId: string;
  name: string; // Size S, Size M, Size L
  extraPrice: number;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
}

export interface ToppingOnProduct {
  productId: string;
  toppingId: string;
  topping?: Topping;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  basePrice: number;
  imageUrl?: string | null;
  isActive: boolean;
  outOfStock?: boolean;
  category?: Category;
  variants: Variant[];
  toppings: (ToppingOnProduct & { topping: Topping })[];
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  products?: Product[];
}

export interface CartItemTopping {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // unique hash based on product + variant + toppings + note
  productId: string;
  name: string;
  imageUrl?: string | null;
  variantId?: string;
  variantName?: string;
  variantExtra: number;
  toppings: CartItemTopping[];
  unitPrice: number; // basePrice + variantExtra
  quantity: number;
  lineTotal: number; // (unitPrice + toppingsSum) * quantity
  note?: string;
}

export type PaymentMethod = "CASH" | "TRANSFER" | "CARD";
export type OrderStatus = "PAID" | "CANCELLED";

export interface OrderItemSnapshot {
  id: string;
  orderId: string;
  productId?: string | null;
  name: string;
  variantName?: string | null;
  toppings: string; // JSON string of CartItemTopping[]
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string | null;
}

export interface Order {
  id: string;
  code: string;
  createdAt: string | Date;
  status: OrderStatus | string;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: PaymentMethod | string;
  note?: string | null;
  staffId?: string | null;
  items: OrderItemSnapshot[];
}

export interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  printerInterface: string;
  enableThermal: boolean;
}

export interface ReportStats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topSellingProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
  orders: Order[];
}
