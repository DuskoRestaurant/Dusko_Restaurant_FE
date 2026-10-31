# Dashboard sao lưu dữ liệu

Ngày 31/10/2026: ADMIN mở **Hệ thống → Sao lưu dữ liệu**, nút trên Tổng quan hoặc `?page=backups`. MANAGER không có quyền mục này. Trang đọc `GET /api/admin/backups` của BE; backend cần cập nhật cùng phiên bản hỗ trợ endpoint, bootstrap và workspace `backups`.

Hiển thị tối đa 20 bản ghi manifest, thời điểm/dung lượng/số tệp, nguồn ảnh, nhắc bản ghi quá 24 giờ, trường hợp chưa kết nối thư mục/lỗi đọc/rỗng/bản ghi lỗi. Dữ liệu là metadata, chưa kiểm checksum hoặc xác minh restore. Bản SQL EC2 riêng và backup ngoài thư mục giám sát chưa được liệt kê. Không có nút tạo/khôi phục giả lập.

Kế hoạch chi tiết và cấu hình `BACKUP_ROOT`: repo BE, `docs/BACKUP_ADMIN_PLAN.md`. Các bước tiếp theo: worker nền và tạo backup ADMIN; lịch tự động/mã hóa/offsite/retention; ảnh cloud và diễn tập khôi phục. Production phải mount kho backup read-only cho BE trước khi inventory đọc được dữ liệu máy chủ.

Kiểm tra: BE build và 81 test; FE ba app build và 100 test. Browser với API giả lập kiểm tra ADMIN deep link/navigation, làm mới, bản ghi quá hạn, ảnh S3 chưa được sao lưu, thư mục chưa cấu hình và kích thước 1440/390px. Ảnh `docs/ui/backup-admin-*.png` dùng dữ liệu giả lập, không phải bằng chứng backup production.
