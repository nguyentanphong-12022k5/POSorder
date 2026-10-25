import { Prisma } from "@prisma/client";

/**
 * Sinh mã đơn hàng HD0001, HD0002... bằng bảng Counter và SELECT ... FOR UPDATE trong transaction
 */
export async function generateOrderCode(tx: Prisma.TransactionClient): Promise<string> {
  const counterName = "order_code";

  // 1. Đảm bảo bản ghi Counter tồn tại
  await tx.counter.upsert({
    where: { name: counterName },
    update: {},
    create: { name: counterName, value: 0 },
  });

  // 2. Khóa dòng với SELECT ... FOR UPDATE khi chạy trên PostgreSQL / MySQL (Production)
  // Ngăn chặn race condition tuyệt đối giữa nhiều connection song song
  const dbUrl = process.env.DATABASE_URL || "";
  const supportsRowLocking = dbUrl.startsWith("postgres") || dbUrl.startsWith("mysql");

  if (supportsRowLocking) {
    await tx.$queryRaw`SELECT * FROM "Counter" WHERE "name" = ${counterName} FOR UPDATE`;
  }

  // 3. Tăng giá trị nguyên tử (Atomic increment)
  const updatedCounter = await tx.counter.update({
    where: { name: counterName },
    data: { value: { increment: 1 } },
  });

  const num = updatedCounter.value;
  return `HD${num.toString().padStart(4, "0")}`;
}
