# Checklist rà soát FE — 18/10/2026

Nhánh `work/updates-20261018`. Checklist tổng và tình trạng backup nằm ở BE: docs/REVIEW_CHECKLIST_2026-10-18.md; hướng dẫn backup: docs/BACKUP_RESTORE.md.

- [x] Kiểm tra quản trị, app nhân viên, khách, shared modules và build/deploy config.
- [x] Test/build ban đầu và npm audit: không có cảnh báo bảo mật dependency.
- [x] Customer Web đọc lịch sử an toàn khi localStorage bị chặn/JSON hỏng; lịch sử sai kiểu không làm trắng trang.
- [x] Gửi món luôn giải phóng trạng thái busy; bản nháp phải lưu được trước khi gửi API để giữ UUID qua lần thử lại.
- [x] Nếu bản nháp lỗi/hỏng, dừng gửi và hướng dẫn nhờ nhân viên kiểm tra; tránh sinh UUID khác khi trạng thái gửi trước chưa rõ.
- [x] Lỗi ghi lịch sử sau khi API đã nhận đơn không bị báo thành gửi thất bại.
- [x] CI chạy khi push nhánh work, build cả ba app.
- [ ] Kiểm tra hồi quy cuối và push nhánh work.

Theo dõi tiếp: chưa nghiệm thu ba UI đồng thời trên thiết bị thật; ExcelJS chunk lớn nhưng đang nạp động; JS nghiệp vụ cần tách dần cùng test. Không đánh dấu những việc này hoàn tất chỉ dựa trên build.
