#!/usr/bin/env bash
# ==============================================================================
# Script Khôi Phục Cơ Sở Dữ Liệu PostgreSQL (pg_restore / psql)
# Sử dụng: ./scripts/restore-db.sh <đường_dẫn_file_backup.sql.gz>
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "❌ Lỗi: Vui lòng cung cấp đường dẫn file sao lưu cần khôi phục!"
  echo "👉 Cách dùng: $0 ./backups/pos_backup_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Không tìm thấy file: $BACKUP_FILE"
  exit 1
fi

DB_CONTAINER="${POSTGRES_CONTAINER:-pos_postgres_db}"
DB_NAME="${POSTGRES_DB:-posorder}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "⚠️  CẢNH BÁO NGUY HIỂM:"
echo "Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại trong cơ sở dữ liệu [${DB_NAME}]!"
echo "File khôi phục: ${BACKUP_FILE}"
echo -n "Bạn có chắc chắn muốn tiếp tục không? (nhập 'yes' để xác nhận): "
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Đã hủy thao tác khôi phục."
  exit 0
fi

echo "▶ Đang giải nén và khôi phục dữ liệu..."

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  # Khôi phục qua Docker container
  gzip -dc "$BACKUP_FILE" | docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"
else
  # Khôi phục trực tiếp qua local psql
  gzip -dc "$BACKUP_FILE" | psql -U "${DB_USER}" -d "${DB_NAME}"
fi

echo "✅ Khôi phục cơ sở dữ liệu thành công từ file [${BACKUP_FILE}]!"
