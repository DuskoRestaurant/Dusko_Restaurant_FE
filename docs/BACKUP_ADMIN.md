# Dashboard sao lưu và khôi phục

ADMIN: Hệ thống → Sao lưu dữ liệu, nút Tổng quan hoặc ?page=backups. Cấu trúc mới: trạng thái/tuổi bản/lịch tiếp theo; dung lượng disk thực đo; sao lưu ngay/cấu hình lịch; bảng archive với Restore/Download/Delete; nơi lưu và nhật ký. Giải thích dài đặt trong details thu gọn. Mobile hiển thị archive thành các hàng thẻ.

GET /api/admin/backups trả inventory, capability, disk storage, destinations, schedule và jobs. Progress là phần trăm công đoạn đã hoàn tất, có heartbeat; không mô phỏng băng thông hoặc ETA. Dung lượng là toàn ổ đĩa máy chủ, không giả gói cloud 50 GB. Cloud chưa kết nối hiển thị Chưa cấu hình.

Mutation đều dùng fresh Authenticator, primary ADMIN. Restore/Delete bắt buộc CONFIRM chính xác; restore thêm checkbox có tài khoản ADMIN/Authenticator của bản nguồn. ZIP tải qua response binary, không dùng public URL. Delete giữ một bản khác còn nguyên vẹn. Schedule cho OFF/HOURLY/DAILY/WEEKLY theo UTC+7.

Restore trả token theo dõi riêng chỉ đọc tiến độ, gửi trong X-Backup-Monitor, không nằm trong URL. Token lưu sessionStorage để reload; main.js chuyển thẳng vào monitor mà không bootstrap DB đang restore. Thành công yêu cầu đăng nhập lại và xóa token monitor. Lỗi giữa chừng giữ maintenance để vận hành kiểm tra.

Cần deploy BE/FE cùng phiên bản; bật BACKUP_ENABLED và BACKUP_RESTORE_ENABLED theo runbook BE. Bản cũ thiếu metadata/schema/đích/khóa không được tự restore trên UI. Chưa gồm ảnh cloud, source, secret, offsite hoặc retention.

Kiểm tra unit/build cả ba app và browser fixture: measured storage, desktop1440/mobile390, CONFIRM/MFA sai/thử lại, ZIP download, delete, lịch tuần, backup progress, restore monitor qua reload và thu hồi session. Ảnh docs/ui/backup-admin-*.png và backup-restore-confirm.png dùng dữ liệu giả lập, không phải dữ liệu/backup production.

## Cập nhật giao diện 01/11/2026

Bố cục dùng phần nội dung rộng hơn, giảm padding/gap, làm nổi trạng thái và nút Sao lưu ngay màu xanh. Thẻ lịch có lối tắt Bật lịch tự động/Chỉnh lịch. Nơi lưu trữ là các thẻ compact, không tạo liên kết cloud giả. Hành động mỗi hàng có chiều cao tối thiểu 44px; nút Xóa được tách khoảng cách, vẫn giữ CONFIRM/MFA và xác nhận credentials khi restore.

Dung lượng ổ đĩa chuyển cam từ 75%, đỏ từ 90%, kèm cảnh báo chữ; chưa đọc được số liệu không giả định là 0%. Tiến trình server hiển thị ngay khi nhận job backup, rồi cập nhật theo chu kỳ 4 giây, có phase, phần trăm và chỉ báo đang chạy. Phần trăm vẫn theo công đoạn, không phải số byte/ETA.

Tìm theo mã/người tạo hoặc ngày hiển thị, lọc loại MANUAL/AUTO/SAFETY, khoảng ngày tính theo UTC+7 (bao gồm cả hai ngày đầu/cuối). Phân trang 5/10/20 dòng, giữ bộ lọc/trang và con trỏ tìm kiếm qua polling, tự đưa trang về phạm vi hợp lệ khi kết quả thay đổi.

API admin trả metadata trong tối đa 1.000 thư mục mới nhất để lọc được kho có hàng trăm bản; không đọc/hash nội dung archive khi tải danh sách. Chức năng inventory mặc định dùng nội bộ vẫn trả 20 dòng. Nếu vượt giới hạn hoặc server cũ còn trả một phần, UI ghi rõ danh sách chưa đầy đủ và bộ lọc chỉ tìm trong các bản đã tải. Giới hạn này không phải retention và không tự xóa file. Cần cập nhật BE cùng FE để tìm được các bản ngoài 20 bản cũ.
