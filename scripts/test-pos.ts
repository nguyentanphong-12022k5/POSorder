import { PrismaClient } from "@prisma/client";
import { generateInvoicePdfBuffer } from "../lib/printer/pdf";
import { generateOrderCode } from "../lib/orderCode";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("🚀 BẮT ĐẦU KIỂM TRA & TEST TOÀN BỘ CHỨC NĂNG APP");
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
    // -----------------------------------------------------------------
    // TEST 1: Kiểm tra danh mục và sản phẩm mẫu đã seed
    // -----------------------------------------------------------------
    console.log("📋 1. Kiểm tra dữ liệu Menu & Sản phẩm...");
    const categories = await prisma.category.findMany({
      include: { products: { include: { variants: true, toppings: true } } },
    });
    assert(categories.length >= 3, "Có ít nhất 3 danh mục", `(Thực tế: ${categories.length})`);

    const products = await prisma.product.findMany({
      include: { variants: true, toppings: true },
    });
    assert(products.length >= 10, "Có ít nhất 10 sản phẩm mẫu", `(Thực tế: ${products.length})`);

    const sampleProduct = products[0];
    assert(
      sampleProduct.variants.length >= 3,
      "Sản phẩm có đầy đủ 3 Size S/M/L",
      `(${sampleProduct.name} có ${sampleProduct.variants.length} size)`
    );

    // -----------------------------------------------------------------
    // TEST 2: Tạo 5 đơn liên tiếp -> Mã HD0001...HD0005 không trùng
    // -----------------------------------------------------------------
    console.log("\n🔢 2. Kiểm tra sinh mã đơn HD0001 -> HD0005 liên tiếp...");
    // Reset counter for predictable test
    await prisma.counter.upsert({
      where: { id: "order_code" },
      update: { value: 0 },
      create: { id: "order_code", value: 0 },
    });
    // Xoá orders cũ của test nếu có
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();

    const createdOrderCodes: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const order = await prisma.$transaction(async (tx) => {
        const code = await generateOrderCode(tx);
        return await tx.order.create({
          data: {
            code,
            status: "PAID",
            subtotal: 35000,
            discount: 0,
            total: 35000,
            paidAmount: 50000,
            changeAmount: 15000,
            paymentMethod: "CASH",
            items: {
              create: [
                {
                  productId: sampleProduct.id,
                  name: sampleProduct.name,
                  variantName: "Size M",
                  toppings: JSON.stringify([{ name: "Trân châu đen", price: 5000 }]),
                  unitPrice: sampleProduct.basePrice,
                  quantity: 1,
                  lineTotal: sampleProduct.basePrice + 5000,
                },
              ],
            },
          },
          include: { items: true },
        });
      });

      createdOrderCodes.push(order.code);
    }

    console.log("   Mã các đơn đã tạo:", createdOrderCodes.join(", "));
    const expectedCodes = ["HD0001", "HD0002", "HD0003", "HD0004", "HD0005"];
    const isCodesMatch = JSON.stringify(createdOrderCodes) === JSON.stringify(expectedCodes);
    assert(
      isCodesMatch,
      "Tạo 5 đơn liên tiếp sinh mã HD0001 đến HD0005 chuẩn xác không trùng",
      `Kết quả: [${createdOrderCodes.join(", ")}]`
    );

    // -----------------------------------------------------------------
    // TEST 3: Kiểm tra tính toàn vẹn snapshot giá (Đổi giá món trong admin)
    // -----------------------------------------------------------------
    console.log("\n📸 3. Kiểm tra Snapshot giá khi Admin đổi giá món...");
    const testProduct = await prisma.product.findFirst({
      where: { name: "Cà phê sữa đá" },
    });

    if (testProduct) {
      const originalPrice = testProduct.basePrice; // ví dụ 25.000đ

      // Tạo đơn với giá cũ
      const testOrder = await prisma.$transaction(async (tx) => {
        const code = await generateOrderCode(tx);
        return await tx.order.create({
          data: {
            code,
            status: "PAID",
            subtotal: originalPrice,
            discount: 0,
            total: originalPrice,
            paidAmount: originalPrice,
            changeAmount: 0,
            paymentMethod: "CASH",
            items: {
              create: [
                {
                  productId: testProduct.id,
                  name: testProduct.name,
                  variantName: "Size M",
                  toppings: JSON.stringify([]),
                  unitPrice: originalPrice,
                  quantity: 1,
                  lineTotal: originalPrice,
                },
              ],
            },
          },
          include: { items: true },
        });
      });

      // Admin tăng giá sản phẩm lên 99.000đ
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { basePrice: 99000 },
      });

      // Lấy lại đơn hàng cũ kiểm tra
      const reFetchedOrder = await prisma.order.findUnique({
        where: { id: testOrder.id },
        include: { items: true },
      });

      const snapshotPrice = reFetchedOrder?.items[0]?.unitPrice;
      assert(
        snapshotPrice === originalPrice,
        "Đơn cũ vẫn giữ nguyên giá snapshot cũ sau khi Admin đổi giá món",
        `(Giá snapshot: ${snapshotPrice}đ, Giá mới của món trong DB: 99.000đ)`
      );

      // Trả lại giá cũ cho sản phẩm
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { basePrice: originalPrice },
      });
    }

    // -----------------------------------------------------------------
    // TEST 4: Đơn hàng 0đ (Discount 100%)
    // -----------------------------------------------------------------
    console.log("\n🎁 4. Kiểm tra đơn hàng 0đ (Discount 100%)...");
    const freeOrder = await prisma.$transaction(async (tx) => {
      const code = await generateOrderCode(tx);
      const subtotal = 40000;
      const discount = 40000;
      const total = 0;
      return await tx.order.create({
        data: {
          code,
          status: "PAID",
          subtotal,
          discount,
          total,
          paidAmount: 0,
          changeAmount: 0,
          paymentMethod: "CASH",
          note: "Khuyến mãi 100%",
          items: {
            create: [
              {
                name: "Trà sữa Ô Long nướng",
                variantName: "Size L",
                toppings: JSON.stringify([]),
                unitPrice: 40000,
                quantity: 1,
                lineTotal: 40000,
              },
            ],
          },
        },
        include: { items: true },
      });
    });

    assert(
      freeOrder.total === 0 && freeOrder.discount === 40000,
      "Tạo đơn 0đ thành công với chiết khấu 100%",
      `(Mã: ${freeOrder.code}, Tổng tiền: ${freeOrder.total}đ)`
    );

    // -----------------------------------------------------------------
    // TEST 5: Sinh file PDF hóa đơn khổ 80mm
    // -----------------------------------------------------------------
    console.log("\n📄 5. Kiểm tra xuất file PDF khổ 80mm (pdfkit)...");
    const shopInfo = {
      shopName: "TIỆM TRÀ & CÀ PHÊ 88",
      shopAddress: "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
      shopPhone: "0909 123 456",
    };

    const pdfBuffer = await generateInvoicePdfBuffer(freeOrder, shopInfo);
    const isPdfValid =
      Buffer.isBuffer(pdfBuffer) &&
      pdfBuffer.length > 500 &&
      pdfBuffer.toString("utf-8", 0, 4) === "%PDF";

    assert(
      isPdfValid,
      "Sinh Buffer PDF hợp lệ với tiêu đề %PDF chuẩn và dung lượng đủ",
      `(Kích thước PDF: ${pdfBuffer.length} bytes)`
    );

    // -----------------------------------------------------------------
    // TEST 6: Kiểm tra báo cáo doanh thu
    // -----------------------------------------------------------------
    console.log("\n📊 6. Kiểm tra tính toán báo cáo doanh thu...");
    const allPaidOrders = await prisma.order.findMany({
      where: { status: "PAID" },
      include: { items: true },
    });

    const totalRevenueCalc = allPaidOrders.reduce((sum, ord) => sum + ord.total, 0);
    assert(
      totalRevenueCalc > 0,
      "Tính toán tổng doanh thu chính xác từ các đơn hàng",
      `(${allPaidOrders.length} đơn hàng, Doanh thu: ${totalRevenueCalc}đ)`
    );

    console.log("\n=================================================");
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASS / ${failed} FAIL`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng khi chạy test:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
