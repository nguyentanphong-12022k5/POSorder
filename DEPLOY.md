# HƯỚNG DẪN TRIỂN KHAI PRODUCTION HỆ THỐNG POS ORDER (15 PHÚT)

Tài liệu này hướng dẫn chi tiết cách triển khai trọn gói hệ thống **POS Bán Hàng & Màn Hình Bếp KDS** lên máy chủ VPS Linux (Ubuntu 22.04 / 24.04 LTS) bằng **Docker Standalone Multi-stage** hoặc nền tảng **Vercel + Supabase**, tích hợp máy in bill LAN ESC/POS, sao lưu tự động và giám sát Sentry.

---

## 📋 Yêu Cầu Phần Cứng & Môi Trường
- **VPS / Cloud Server**: Tối thiểu 1 vCPU, 2GB RAM (khuyến nghị 2 vCPU, 4GB RAM).
- **Hệ điều hành**: Ubuntu 22.04 LTS hoặc 24.04 LTS (x86_64 hoặc ARM64).
- **Tên miền (Domain)**: Trỏ bản ghi `A` về IP máy chủ (ví dụ: `pos.quanban.vn`).
- **Mạng quán**: Máy in bill LAN (ví dụ: 192.168.1.100) cùng lớp mạng hoặc mở cổng 9100.

---

## ⏱️ LỘ TRÌNH 15 PHÚT TRIỂN KHAI LÊN VPS LINUX

### Bước 1: Cài đặt Docker & Docker Compose (3 phút)
SSH vào VPS của bạn và chạy lệnh cài Docker chính thức:
```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker & công cụ phụ trợ
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Kiểm tra phiên bản
docker --version
docker compose version
```

---

### Bước 2: Clone Mã Nguồn & Thiết Lập Biến Môi Trường (3 phút)
```bash
# Tạo thư mục làm việc và tải source code
sudo mkdir -p /opt/pos-order && cd /opt/pos-order
sudo git clone https://github.com/your-username/pos-drink-order.git .

# Tạo file cấu hình môi trường từ mẫu
cp .env.example .env
nano .env
```

**Các thông số quan trọng cần thay đổi trong `.env`:**
```ini
# 1. Mật khẩu Postgres an toàn
POSTGRES_PASSWORD="MatKhauCucKyAnToan_2026!@#"
DATABASE_URL="postgresql://postgres:MatKhauCucKyAnToan_2026!@#@postgres:5432/posorder?schema=public"

# 2. Khóa bảo mật đăng nhập (Tạo bằng: openssl rand -base64 32)
JWT_SECRET="e9b28a8d116c49cbbcfb1e4a36279930f1d5e38bb0f1c349"

# 3. Domain của quán
NEXT_PUBLIC_APP_URL="https://pos.quanban.vn"

# 4. IP máy in hóa đơn trong mạng nội bộ quán (nếu dùng LAN)
PRINTER_REAL_LAN_IP="192.168.1.100"
PRINTER_PORT=9100

# 5. Khóa giám sát Sentry (Nếu có)
SENTRY_DSN="https://xxxx@sentry.io/yyyy"
NEXT_PUBLIC_SENTRY_DSN="https://xxxx@sentry.io/yyyy"
```

---

### Bước 3: Khởi Chạy Ứng Dụng Bằng Docker Compose (4 phút)
Khởi chạy đồng thời: Web App (Next.js Standalone) + PostgreSQL 16 + Printer Bridge:
```bash
docker compose up -d --build
```
Kiểm tra tình trạng các container đang chạy:
```bash
docker compose ps
```
Kiểm tra endpoint giám sát sức khỏe:
```bash
curl http://localhost:3000/api/health
```
*(Kết quả trả về `{"status":"healthy","checks":{"database":{"status":"up"}}}` là thành công).*

---

### Bước 4: Khởi Tạo Dữ Liệu Ban Đầu & Seed Menu Mẫu (2 phút)
Chạy lệnh push cấu trúc database và nạp sẵn menu đồ uống, topping và tài khoản:
```bash
# Đồng bộ bảng database
docker compose exec app npx prisma db push

# Nạp dữ liệu mẫu ban đầu (admin: admin@pos.vn / admin123)
docker compose exec app npx tsx prisma/seed.ts
```

---

### Bước 5: Cấu Hình HTTPS / SSL Tự Động Với Caddy (3 phút)
Caddy tự động cấp chứng chỉ SSL miễn phí (Let's Encrypt) chỉ với 3 dòng cấu hình:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y

# Cấu hình domain
sudo tee /etc/caddy/Caddyfile <<EOF
pos.quanban.vn {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl restart caddy
```
👉 **Xong!** Bây giờ bạn có thể truy cập `https://pos.quanban.vn` từ trình duyệt hoặc cài đặt PWA lên Tablet.

---

## 🖨️ CẤU HÌNH MÁY IN HÓA ĐƠN LAN ESC/POS (Xprinter / Epson)
Service `printer-bridge` trong Docker Compose đóng vai trò làm cầu nối socket chuyển tiếp yêu cầu in từ container ra máy in vật lý:
1. Đảm bảo máy in cắm dây mạng LAN vào router quán và đã được đặt IP tĩnh (ví dụ: `192.168.1.100`).
2. Trong file `.env`, đặt `PRINTER_REAL_LAN_IP="192.168.1.100"`.
3. Kiểm tra kết nối từ trang quản trị: Truy cập `https://pos.quanban.vn/settings` $\rightarrow$ bấm nút **"Test kết nối máy in"** (gọi `/api/print/health`).

---

## 💾 THIẾT LẬP SAO LƯU TỰ ĐỘNG HẰNG NGÀY (CRONJOB)

Hệ thống đã có sẵn script sao lưu nén gzip và tự động xoá file cũ quá 14 ngày.
Cấp quyền thực thi cho script:
```bash
chmod +x /opt/pos-order/scripts/*.sh
```

Cấu hình Cronjob chạy tự động lúc 02:00 sáng mỗi ngày:
```bash
crontab -e
```
Thêm dòng sau vào cuối file crontab:
```cron
0 2 * * * /opt/pos-order/scripts/backup-db.sh >> /opt/pos-order/backups/cron.log 2>&1
```

### Cách Phục Hồi Dữ Liệu Khi Gặp Sự Cố:
Khi cần restore lại dữ liệu từ một bản sao lưu cụ thể:
```bash
/opt/pos-order/scripts/restore-db.sh /opt/pos-order/backups/pos_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🚀 TÙY CHỌN 2: DEPLOY LÊN VERCEL + SUPABASE POSTGRES
Nếu bạn muốn sử dụng mô hình Serverless hoàn toàn miễn phí:
1. Tạo database PostgreSQL trên **Supabase** hoặc **Neon**.
2. Đẩy mã nguồn lên GitHub.
3. Import repository vào **Vercel**:
   - Thêm Environment Variables: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `SENTRY_DSN`.
   - Vercel tự động nhận diện và build Next.js.
4. Chạy migration: `npx prisma db push` từ máy local trỏ vào database URL của Supabase.

---

## 📊 GIÁM SÁT & XEM LOGS PRODUCTION
- Xem logs thời gian thực dạng JSON của ứng dụng:
  ```bash
  docker compose logs -f --tail=100 app
  ```
- Xem logs database PostgreSQL:
  ```bash
  docker compose logs -f postgres
  ```
- Kiểm tra trạng thái sức khỏe chi tiết:
  ```bash
  curl -s http://localhost:3000/api/health | jq .
  ```

---

## 🛠️ CÁC LỖI THƯỜNG GẶP KHI KHỞI CHẠY (TROUBLESHOOTING)
* **Lỗi `Could not find a production build in the '.next' directory`**:
  Do gõ `npm start` khi chưa chạy `npm run build`. Khi chạy local dev, luôn dùng `npm run dev`. Khi chạy production, bắt buộc chạy `npm run build` trước.
* **Lỗi `EADDRINUSE: address already in use :::3000`**:
  Cổng 3000 đang bị chiếm bởi một phiên bản cũ. Tắt tiến trình bằng: `npx kill-port 3000` (Linux/Mac) hoặc `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force` (Windows).
* **Xem thêm chi tiết tại**: Mục 8 trong [README.md](file:///e:/dien_khung/POSorder/README.md).
