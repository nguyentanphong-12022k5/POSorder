#!/bin/sh
set -e

echo "🚀 [POS Order] Khởi động container..."

# Kiểm tra nếu có cờ chạy migration tự động
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "📦 Đang đồng bộ cấu trúc cơ sở dữ liệu (Prisma)..."
  npx prisma db push --skip-generate || echo "⚠️ Cảnh báo migration, tiếp tục chạy..."
fi

# Chạy lệnh CMD mặc định (node server.js)
exec "$@"
