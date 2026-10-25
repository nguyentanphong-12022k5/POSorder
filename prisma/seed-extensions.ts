import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedExtensions() {
  console.log("🌱 Khởi tạo dữ liệu mở rộng cho Bàn, Kho nguyên liệu, Khách hàng & Ca làm việc...");

  // 1. Tạo 10 Bàn ăn
  const existingTables = await prisma.restaurantTable.count();
  if (existingTables === 0) {
    for (let i = 1; i <= 10; i++) {
      const tableName = `Bàn ${i < 10 ? "0" + i : i}`;
      await prisma.restaurantTable.create({
        data: { name: tableName, status: "EMPTY" },
      });
    }
    console.log("✅ Đã tạo 10 bàn phục vụ.");
  }

  // 2. Tạo Nguyên vật liệu mẫu
  const existingInventory = await prisma.inventoryItem.count();
  if (existingInventory === 0) {
    const rawMaterials = [
      { name: "Cà phê hạt Blend Arabica/Robusta", unit: "g", quantity: 5000, minQuantity: 1000, costPrice: 200 },
      { name: "Sữa đặc Ông Thọ xanh lá", unit: "lon", quantity: 24, minQuantity: 6, costPrice: 22000 },
      { name: "Trà đen Ô Long nướng", unit: "g", quantity: 2000, minQuantity: 500, costPrice: 350 },
      { name: "Trà xanh hoa lài thượng hạng", unit: "g", quantity: 1500, minQuantity: 400, costPrice: 300 },
      { name: "Sữa tươi thanh trùng DalatMilk", unit: "ml", quantity: 8000, minQuantity: 2000, costPrice: 40 },
      { name: "Trân châu đen cao cấp", unit: "g", quantity: 4000, minQuantity: 1000, costPrice: 50 },
      { name: "Bột Matcha Nhật Bản", unit: "g", quantity: 800, minQuantity: 200, costPrice: 600 },
      { name: "Ly nhựa 500ml (Size M)", unit: "cái", quantity: 350, minQuantity: 100, costPrice: 800 },
      { name: "Ly nhựa 700ml (Size L)", unit: "cái", quantity: 280, minQuantity: 100, costPrice: 950 },
    ];
    for (const item of rawMaterials) {
      await prisma.inventoryItem.create({ data: item });
    }
    console.log("✅ Đã tạo 9 nguyên vật liệu kho ban đầu.");
  }

  // 3. Tạo Khách hàng mẫu
  const existingCustomers = await prisma.customer.count();
  if (existingCustomers === 0) {
    await prisma.customer.createMany({
      data: [
        { phone: "0912345678", name: "Nguyễn Văn An", points: 45 },
        { phone: "0987654321", name: "Trần Thị Bình", points: 20 },
      ],
    });
    console.log("✅ Đã tạo 2 khách hàng thân thiết mẫu.");
  }

  // 4. Tạo ca làm việc mở hiện tại nếu chưa có
  const openShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
  if (!openShift) {
    await prisma.shift.create({
      data: {
        staffName: "Thu ngân 1",
        openingCash: 500000,
        expectedCash: 500000,
        status: "OPEN",
        note: "Tiền lẻ đầu ca sáng",
      },
    });
    console.log("✅ Đã mở Ca làm việc mẫu số 1.");
  }

  console.log("✨ Khởi tạo dữ liệu mở rộng hoàn tất!");
}

seedExtensions()
  .catch((e) => {
    console.error("Lỗi:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
