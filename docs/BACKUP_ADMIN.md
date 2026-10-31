# Dashboard sao lưu và khôi phục

ADMIN: Hệ thống → Sao lưu dữ liệu, nút Tổng quan hoặc ?page=backups. Cấu trúc mới: trạng thái/tuổi bản/lịch tiếp theo; dung lượng disk thực đo; sao lưu ngay/cấu hình lịch; bảng archive với Restore/Download/Delete; nơi lưu và nhật ký. Giải thích dài đặt trong details thu gọn. Mobile hiển thị archive thành các hàng thẻ.

GET /api/admin/backups trả inventory, capability, disk storage, destinations, schedule và jobs. Progress là phần trăm công đoạn đã hoàn tất, có heartbeat; không mô phỏng băng thông hoặc ETA. Dung lượng là toàn ổ đĩa máy chủ, không giả gói cloud 50 GB. Cloud chưa kết nối hiển thị Chưa cấu hình.

Mutation đều dùng fresh Authenticator, primary ADMIN. Restore/Delete bắt buộc CONFIRM chính xác; restore thêm checkbox có tài khoản ADMIN/Authenticator của bản nguồn. ZIP tải qua response binary, không dùng public URL. Delete giữ một bản khác còn nguyên vẹn. Schedule cho OFF/HOURLY/DAILY/WEEKLY theo UTC+7.

Restore trả token theo dõi riêng chỉ đọc tiến độ, gửi trong X-Backup-Monitor, không nằm trong URL. Token lưu sessionStorage để reload; main.js chuyển thẳng vào monitor mà không bootstrap DB đang restore. Thành công yêu cầu đăng nhập lại và xóa token monitor. Lỗi giữa chừng giữ maintenance để vận hành kiểm tra.

Cần deploy BE/FE cùng phiên bản; bật BACKUP_ENABLED và BACKUP_RESTORE_ENABLED theo runbook BE. Bản cũ thiếu metadata/schema/đích/khóa không được tự restore trên UI. Chưa gồm ảnh cloud, source, secret, offsite hoặc retention.

Kiểm tra unit/build cả ba app và browser fixture: measured storage, desktop1440/mobile390, CONFIRM/MFA sai/thử lại, ZIP download, delete, lịch tuần, backup progress, restore monitor qua reload và thu hồi session. Ảnh docs/ui/backup-admin-*.png và backup-restore-confirm.png dùng dữ liệu giả lập, không phải dữ liệu/backup production.
