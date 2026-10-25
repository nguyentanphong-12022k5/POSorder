import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu mẫu...");

  // Xoá dữ liệu cũ
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.toppingOnProduct.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.setting.deleteMany();

  // Khởi tạo Setting
  await prisma.setting.create({
    data: {
      id: "default",
      shopName: "TIỆM TRÀ & CÀ PHÊ 88",
      shopAddress: "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
      shopPhone: "0909 123 456",
      printerInterface: "tcp://192.168.1.100:9100",
      enableThermal: false,
    },
  });

  // Khởi tạo Counter mã hoá đơn
  await prisma.counter.create({
    data: {
      id: "order_code",
      value: 0,
    },
  });

  // 1. Tạo 5 Topping
  const toppingsData = [
    { name: "Trân châu đen dẻo", price: 5000 },
    { name: "Thạch dừa non", price: 5000 },
    { name: "Pudding trứng", price: 7000 },
    { name: "Kem Cheese Macchiato", price: 10000 },
    { name: "Shot Espresso đậm đà", price: 8000 },
  ];

  const createdToppings = [];
  for (const t of toppingsData) {
    const topping = await prisma.topping.create({ data: t });
    createdToppings.push(topping);
  }
  console.log(`✅ Đã tạo ${createdToppings.length} toppings.`);

  // 2. Tạo 3 Categories
  const catCoffee = await prisma.category.create({
    data: { name: "Cà phê Việt Nam", sort: 1 },
  });
  const catTea = await prisma.category.create({
    data: { name: "Trà sữa & Trà trái cây", sort: 2 },
  });
  const catIce = await prisma.category.create({
    data: { name: "Đá xay Freeze", sort: 3 },
  });

  console.log("✅ Đã tạo 3 categories.");

  // 3. 10 Sản phẩm mẫu
  const products = [
    // Cà phê
    {
      categoryId: catCoffee.id,
      name: "Cà phê đen đá",
      basePrice: 20000,
      imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80",
    },
    {
      categoryId: catCoffee.id,
      name: "Cà phê sữa đá",
      basePrice: 25000,
      imageUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&q=80",
    },
    {
      categoryId: catCoffee.id,
      name: "Bạc xỉu 3 tầng",
      basePrice: 29000,
      imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80",
    },
    {
      categoryId: catCoffee.id,
      name: "Cà phê muối béo ngậy",
      basePrice: 32000,
      imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400&q=80",
    },
    // Trà sữa & Trà trái cây
    {
      categoryId: catTea.id,
      name: "Trà sữa truyền thống",
      basePrice: 28000,
      imageUrl: "https://images.unsplash.com/photo-1558857563-b37cf5bc8993?w=400&q=80",
    },
    {
      categoryId: catTea.id,
      name: "Trà sữa Ô Long nướng",
      basePrice: 35000,
      imageUrl: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=400&q=80",
    },
    {
      categoryId: catTea.id,
      name: "Trà lài sữa thơm lừng",
      basePrice: 32000,
      imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80",
    },
    {
      categoryId: catTea.id,
      name: "Trà đào cam sả thanh mát",
      basePrice: 35000,
      imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80",
    },
    // Đá xay
    {
      categoryId: catIce.id,
      name: "Matcha đá xay cốt dừa",
      basePrice: 42000,
      imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=400&q=80",
    },
    {
      categoryId: catIce.id,
      name: "Cà phê đá xay Socola",
      basePrice: 45000,
      imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80",
    },
  ];

  for (const item of products) {
    const product = await prisma.product.create({
      data: {
        name: item.name,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        imageUrl: item.imageUrl,
        isActive: true,
        variants: {
          create: [
            { name: "Size S", extraPrice: 0 },
            { name: "Size M", extraPrice: 0 },
            { name: "Size L", extraPrice: 6000 },
          ],
        },
      },
    });

    // Gán tất cả toppings cho mỗi sản phẩm
    for (const topping of createdToppings) {
      await prisma.toppingOnProduct.create({
        data: {
          productId: product.id,
          toppingId: topping.id,
        },
      });
    }
  }

  console.log(`✅ Đã tạo 10 sản phẩm với đầy đủ Size S/M/L và Toppings.`);

  // Khởi tạo tài khoản mẫu Admin và Staff
  await prisma.profile.upsert({
    where: { email: "admin@pos.vn" },
    update: {},
    create: {
      email: "admin@pos.vn",
      password: "admin123",
      role: "admin",
      name: "Chủ quán Admin",
      shopId: "shop_default",
    },
  });

  await prisma.profile.upsert({
    where: { email: "staff@pos.vn" },
    update: {},
    create: {
      email: "staff@pos.vn",
      password: "staff123",
      role: "staff",
      name: "Thu ngân 1",
      shopId: "shop_default",
    },
  });
  console.log("✅ Đã khởi tạo tài khoản mẫu (admin@pos.vn & staff@pos.vn).");

  console.log("✨ Seed hoàn tất thành công!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi khi seed dữ liệu:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
