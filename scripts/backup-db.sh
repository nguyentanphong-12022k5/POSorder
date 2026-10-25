#!/usr/bin/env bash
# ==============================================================================
# Script Tự Động Sao Lưu Cơ Sở Dữ Liệu PostgreSQL (pg_dump)
# Tự động nén gzip, đặt tên theo ngày giờ, và xóa bản sao lưu cũ > 14 ngày
# ==============================================================================

set -euo pipefail

# 1. Cấu hình thư mục và biến môi trường
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/pos_backup_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS=14

# Thông tin kết nối Postgres (Ưu tiên lấy từ biến môi trường hoặc Docker Compose mặc định)
DB_CONTAINER="${POSTGRES_CONTAINER:-pos_postgres_db}"
DB_NAME="${POSTGRES_DB:-posorder}"
DB_USER="${POSTGRES_USER:-postgres}"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "▶ Bắt đầu tiến trình sao lưu cơ sở dữ liệu [${DB_NAME}]..."

# 2. Thực hiện pg_dump
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  # Nếu Postgres đang chạy trong Docker container
  log "Đang sao lưu từ Docker container [${DB_CONTAINER}]..."
  docker exec -t "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "$BACKUP_FILE"
else
  # Nếu Postgres chạy trực tiếp trên máy chủ
  log "Đang sao lưu từ local PostgreSQL..."
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "$BACKUP_FILE"
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "✅ Sao lưu thành công: ${BACKUP_FILE} (Dung lượng: ${FILE_SIZE})"

# 3. Tạo mã băm SHA256 để đảm bảo tính toàn vẹn
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
fi

# 4. Dọn dẹp bản sao lưu cũ hơn RETENTION_DAYS ngày
log "🧹 Đang dọn dẹp các bản sao lưu cũ hơn ${RETENTION_DAYS} ngày..."
find "$BACKUP_DIR" -type f -name "pos_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
find "$BACKUP_DIR" -type f -name "pos_backup_*.sql.gz.sha256" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;

log "🎉 Hoàn tất tiến trình sao lưu cơ sở dữ liệu."
