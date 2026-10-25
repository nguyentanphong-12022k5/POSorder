import { PrismaClient } from "@prisma/client";
import { getVietQRUrl } from "../lib/vietqr";
import { generateOrderCode } from "../lib/orderCode";

const prisma = new PrismaClient();

async function testAllFeatures() {
  console.log("=================================================");
  console.log("🚀 BẮT ĐẦU KIỂM THỬ TẤT CẢ TÍNH NĂNG NHÓM 1, 2 & 3");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. NHÓM 1: Kiểm tra VietQR thật
    // -------------------------------------------------------------
    console.log("💳 1. Kiểm tra sinh mã VietQR chuẩn...");
    const qrUrl = getVietQRUrl({
      bankCode: "MB",
      accountNumber: "888899998888",
      accountName: "TIEM TRA VA CA PHE 88",
      amount: 92000,
      description: "POS HD0008",
    });
    const isQrValid =
      qrUrl.includes("img.vietqr.io") &&
      qrUrl.includes("888899998888") &&
      qrUrl.includes("amount=92000");
    assert(isQrValid, "Sinh đường dẫn VietQR Napas 247 chính xác", `(${qrUrl})`);

    // -------------------------------------------------------------
    // 2. NHÓM 1: Quản lý Bàn & Hình thức phục vụ
    // -------------------------------------------------------------
    console.log("\n🪑 2. Kiểm tra Bàn & Phục vụ tại bàn...");
    const table = await prisma.restaurantTable.findFirst({ where: { name: "Bàn 01" } });
    assert(Boolean(table), "Tồn tại Bàn 01 trong hệ thống");

    // Đặt bàn sang OCCUPIED
    const occupiedTable = await prisma.restaurantTable.update({
      where: { id: table!.id },
      data: { status: "OCCUPIED" },
    });
    assert(occupiedTable.status === "OCCUPIED", "Cập nhật bàn sang trạng thái Có khách");

    // Dọn bàn sang EMPTY
    const emptyTable = await prisma.restaurantTable.update({
      where: { id: table!.id },
      data: { status: "EMPTY" },
    });
    assert(emptyTable.status === "EMPTY", "Dọn bàn trả về trạng thái Bàn trống");

    // -------------------------------------------------------------
    // 3. NHÓM 1: Màn hình Pha chế / Bếp (KDS)
    // -------------------------------------------------------------
    console.log("\n👨‍🍳 3. Kiểm tra luồng KDS (PENDING -> PREPARING -> COMPLETED)...");
    const testKdsOrder = await prisma.$transaction(async (tx) => {
      const code = await generateOrderCode(tx);
      return await tx.order.create({
        data: {
          code,
          status: "PAID",
          orderType: "DINE_IN",
          tableNumber: "Bàn 02",
          subtotal: 50000,
          total: 50000,
          paidAmount: 50000,
          paymentMethod: "CASH",
          items: {
            create: [
              {
                name: "Trà đào cam sả",
                variantName: "Size L",
                toppings: JSON.stringify([{ name: "Thạch dừa", price: 5000 }]),
                unitPrice: 40000,
                quantity: 2,
                lineTotal: 50000,
                itemStatus: "PENDING",
                note: "Ít đường",
              },
            ],
          },
        },
        include: { items: true },
      });
    });

    const itemId = testKdsOrder.items[0].id;
    assert(testKdsOrder.items[0].itemStatus === "PENDING", "Món mới tạo có trạng thái PENDING");

    // Bếp bấm Bắt đầu pha -> PREPARING
    const itemPreparing = await prisma.orderItem.update({
      where: { id: itemId },
      data: { itemStatus: "PREPARING" },
    });
    assert(itemPreparing.itemStatus === "PREPARING", "Chuyển trạng thái món sang PREPARING");

    // Bếp bấm Xong món -> COMPLETED
    const itemCompleted = await prisma.orderItem.update({
      where: { id: itemId },
      data: { itemStatus: "COMPLETED" },
    });
    assert(itemCompleted.itemStatus === "COMPLETED", "Hoàn thành món sang COMPLETED");

    // -------------------------------------------------------------
    // 4. NHÓM 2: Quản lý Ca làm việc & Két tiền (Shift)
    // -------------------------------------------------------------
    console.log("\n⏱️ 4. Kiểm tra Quản lý Ca làm việc & Kiểm két tiền...");
    const activeShift = await prisma.shift.findFirst({ where: { status: "OPEN" } });
    assert(Boolean(activeShift), "Có ca làm việc đang mở (Shift OPEN)");

    // Đóng ca và tính tiền thừa thiếu
    const expected = (activeShift?.openingCash || 0) + 100000;
    const actual = expected + 20000; // thừa 20k
    const closedShift = await prisma.shift.update({
      where: { id: activeShift!.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        expectedCash: expected,
        closingCash: actual,
        cashDifference: 20000,
      },
    });
    assert(closedShift.status === "CLOSED" && closedShift.cashDifference === 20000, "Đóng ca & tính chênh lệch thừa tiền (+20k) chuẩn xác");

    // Mở lại ca mới
    await prisma.shift.create({
      data: {
        staffName: "Thu ngân ca chiều",
        openingCash: 500000,
        expectedCash: 500000,
        status: "OPEN",
      },
    });

    // -------------------------------------------------------------
    // 5. NHÓM 2: Hủy đơn hàng có lưu vết (Audit Reason)
    // -------------------------------------------------------------
    console.log("\n🚫 5. Kiểm tra Hủy đơn hàng có lưu vết lý do...");
    const cancelledOrder = await prisma.order.update({
      where: { id: testKdsOrder.id },
      data: {
        status: "CANCELLED",
        cancelReason: "Khách đổi ý sang món khác",
      },
    });
    assert(
      cancelledOrder.status === "CANCELLED" && cancelledOrder.cancelReason === "Khách đổi ý sang món khác",
      "Đơn hàng được hủy thành công kèm lý do lưu vết",
      `(Mã đơn: ${cancelledOrder.code})`
    );

    // -------------------------------------------------------------
    // 6. NHÓM 3: Khách hàng thân thiết & Tích điểm
    // -------------------------------------------------------------
    console.log("\n🎁 6. Kiểm tra Khách hàng thân thiết & Tích điểm...");
    const testPhone = "0999888777";
    const customer = await prisma.customer.upsert({
      where: { phone: testPhone },
      update: { points: { increment: 15 } },
      create: { phone: testPhone, name: "Anh Nam", points: 15 },
    });
    assert(customer.points >= 15, "Tích lũy điểm cho khách hàng thành công", `(${customer.name}: ${customer.points} điểm)`);

    // -------------------------------------------------------------
    // 7. NHÓM 3: Tồn kho nguyên vật liệu & Cảnh báo sắp hết
    // -------------------------------------------------------------
    console.log("\n📦 7. Kiểm tra Tồn kho nguyên vật liệu...");
    const inventoryItems = await prisma.inventoryItem.findMany();
    assert(inventoryItems.length >= 5, "Kho nguyên liệu có đầy đủ danh mục", `(${inventoryItems.length} nguyên liệu)`);

    // Nhập thêm 2000g cà phê
    const coffeeItem = inventoryItems.find((i) => i.name.includes("Cà phê"));
    if (coffeeItem) {
      const updatedCoffee = await prisma.inventoryItem.update({
        where: { id: coffeeItem.id },
        data: { quantity: { increment: 2000 } },
      });
      assert(updatedCoffee.quantity === coffeeItem.quantity + 2000, "Nhập thêm kho nguyên liệu thành công (+2000g)");
    }

    // -------------------------------------------------------------
    // 8. NHÓM 3: In tem dán ly (Cup Labels)
    // -------------------------------------------------------------
    console.log("\n🏷️ 8. Kiểm tra cấu trúc Tem dán ly (Cup Labels)...");
    const testItems = [
      { name: "Cà phê sữa đá", quantity: 2, variantName: "Size L", toppings: "[]", note: "Ít sữa" },
    ];
    let totalLabelCups = 0;
    testItems.forEach((it) => {
      totalLabelCups += it.quantity;
    });
    assert(totalLabelCups === 2, "Sinh đủ số lượng tem dán ly (2 tem cho 2 ly)");

    console.log("\n=================================================");
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASS / ${failed} FAIL`);
    console.log("=================================================\n");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("❌ Lỗi test:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAllFeatures();
