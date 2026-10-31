# Dashboard backup ADMIN

ADMIN mở Hệ thống → Sao lưu dữ liệu, nút trên Tổng quan hoặc ?page=backups. MANAGER không có quyền. Deploy BE/FE cùng phiên bản.

GET /api/admin/backups trả inventory, capability, activeJob và 10 job gần nhất. Tạo backup ngay mở hộp thoại phạm vi + mã Authenticator mới, POST /api/admin/backups với {code}. Backend yêu cầu primary ADMIN và one-use TOTP. Thiếu tools/config/storage hoặc có job/khóa thì nút bị khóa kèm lý do.

HTTP 202 là tiếp nhận. Poll mỗi 4 giây, hiển thị công đoạn/thành công/lỗi/gián đoạn; hủy khi rời trang. Lỗi MFA cho sửa mã/thử lại. Không báo hoàn tất trước khi dump + SHA-256 hoàn thành. Giữ vị trí cuộn bảng và focus sau poll.

Chưa backup ảnh cloud/secrets, chưa có snapshot chung SQL/Mongo/ảnh. Inventory không hash lại file khi đọc. Hoàn tất chưa chứng minh restore. Chưa có restore production, lịch tự động, offsite hoặc retention.

Bật production theo repo BE docs/BACKUP_ADMIN_RUNBOOK.md: BACKUP_ENABLED=true, image mới có tools và volume private. Mặc định chưa bật tạo mới. Chưa chạy backup production thật trong lượt này.

Kiểm tra: BE 89 unit test và build; FE 101 test và build management. Browser fixture kiểm MFA sai/thử lại, tiếp nhận so với hoàn tất, chặn tạo trùng, polling, cleanup khi rời trang, inventory rỗng/cloud/quá hạn, 1440px/390px. Ảnh docs/ui/backup-admin-*.png là fixture, không phải bằng chứng backup production.
