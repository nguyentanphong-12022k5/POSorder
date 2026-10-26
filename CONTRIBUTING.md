# Hướng Dẫn Đóng Góp Phát Triển (Contribution Guidelines)

Cảm ơn bạn đã quan tâm và muốn đóng góp cho dự án **POS Order & Kitchen Display System (KDS)**! Dưới đây là các quy chuẩn để đảm bảo mã nguồn luôn đạt chất lượng cao nhất.

---

## 🛠️ Quy Trình Phát Triển (Workflow)

1. **Fork kho lưu trữ**: Bấm **Fork** trên giao diện GitHub.
2. **Tạo nhánh tính năng mới**:
   ```bash
   git checkout -b feat/ten-tinh-nang-moi
   # hoặc:
   git checkout -b fix/ten-loi-can-sua
   ```
3. **Quy tắc đặt tên nhánh**:
   * `feat/`: Bổ sung tính năng mới (vd: `feat/table-qr-ordering`)
   * `fix/`: Sửa lỗi hệ thống (vd: `fix/printer-reprint-watermark`)
   * `docs/`: Cập nhật tài liệu, README, sơ đồ
   * `test/`: Viết thêm bộ kiểm thử unit / integration test
   * `refactor/`: Tối ưu hóa cấu trúc mã mà không đổi nghiệp vụ

---

## 🧪 Yêu Cầu Kiểm Thử & Kiểm Tra Kiểu (Testing & Linting)

Trước khi gửi Pull Request (PR), toàn bộ các bước kiểm tra sau bắt buộc phải vượt qua:

```bash
# 1. Kiểm tra lỗi kiểu TypeScript
npx tsc --noEmit

# 2. Chạy toàn bộ 12 test suites (98 unit & integration tests)
npm test

# 3. Chạy build kiểm tra production
npm run build
```

---

## 📝 Quy Chuẩn Viết Commit (Conventional Commits)

Chúng tôi tuân thủ quy chuẩn [Conventional Commits](https://www.conventionalcommits.org/):
* `feat: ...` -> Tính năng mới
* `fix: ...` -> Sửa lỗi
* `docs: ...` -> Tài liệu
* `test: ...` -> Viết test
* `refactor: ...` -> Tái cấu trúc mã
* `perf: ...` -> Cải thiện hiệu năng

---

## 🚀 Gửi Pull Request (PR)

1. Đẩy nhánh của bạn lên fork: `git push origin feat/ten-tinh-nang-moi`.
2. Tạo Pull Request trỏ vào nhánh `main` của kho gốc.
3. Mô tả rõ mục đích, các thay đổi và đính kèm ảnh chụp màn hình (nếu có thay đổi giao diện UI).
4. GitHub Actions CI/CD sẽ tự động chạy toàn bộ quy trình kiểm thử để đảm bảo PR hợp lệ.
