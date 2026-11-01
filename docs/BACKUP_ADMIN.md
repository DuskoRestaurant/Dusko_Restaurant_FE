# Module sao lưu ADMIN

Chỉ thay đổi trong module Sao lưu dữ liệu. Bộ chọn chi nhánh, điều hướng dùng chung và các luồng nghiệp vụ khác giữ nguyên. Quyền và API backend giữ nguyên: ADMIN chính có MFA mới được quản trị dữ liệu; backup/restore áp dụng toàn hệ thống, không bị giới hạn theo bộ chọn chi nhánh bên ngoài.

## Cấu trúc vận hành

- Một vùng nội dung căn giữa tối đa 1.200px. CTA chính Sao lưu ngay đặt tại tiêu đề.
- Một dòng ghi nhận bản hoàn tất gần nhất và thời điểm. Không kết luận dữ liệu an toàn chỉ từ manifest hay một lần tạo thành công.
- Tổng quan ngắn: số bản hoàn tất đã tải và tổng size của chúng; trạng thái/lần chạy tiếp theo của lịch; phần trăm toàn ổ đĩa, dung lượng trống và footprint kho backup được ghi riêng.
- Cảnh báo theo dữ liệu thực: không có bản hoàn tất, bản hơn 24 giờ (mốc gợi ý UI, không phải chính sách RPO cấu hình), tắt lịch, lịch lỗi, tác vụ thất bại/gián đoạn/bảo trì, dung lượng trống dưới ngưỡng preflight thực tế 512 MiB. API chưa có ngưỡng cảnh báo phần trăm cấu hình nên 79%/90% không tự phát cảnh báo. Các giới hạn offsite/kiểm chứng restore/checksum nằm trong phần Giới hạn bảo vệ mở khi cần.
- Bảng trung tâm: thời gian/người tạo, loại, dung lượng, hoàn tất và menu thao tác. Hoàn tất chỉ phản ánh manifest hoàn chỉnh; chưa chứng minh toàn vẹn hiện tại hay đã diễn tập restore.
- Bộ lọc thu gọn, tìm theo mã/người tạo/ngày; lọc MANUAL/AUTO/SAFETY và khoảng ngày UTC+7. Phân trang 5/10/20 dòng. Tab riêng Nhật ký hoạt động và Cấu hình.
- Menu từng bản có Thông tin bản sao và Tải về; Khôi phục/Xóa nằm trong nhóm cần xác nhận, cách bằng đường phân chia. Desktop menu mở sang trái để không che nút hàng kế tiếp; mobile mở trong hàng để không chồng lên bản khác. Escape/nhấn ngoài trong module đóng menu, chỉ một menu mở.
- Thông tin bản sao nêu ID, phạm vi toàn hệ thống, thành phần, nơi lưu, compatibility và tác động restore. Cấu hình hiển thị nơi đang dùng; cloud chưa tích hợp chỉ là thông tin mở rộng, không có nút kết nối giả. Retention/phân quyền/phạm vi là thông tin đúng hiện trạng, không tạo bộ chỉnh sửa chức năng chưa có.

## Cơ chế được giữ

GET /api/admin/backups trả metadata tối đa 1.000 thư mục mới nhất; nếu truncated, UI nói rõ bộ lọc chỉ áp dụng cho phần đã tải. Đây không phải retention. Inventory nội bộ mặc định vẫn trả 20 bản; API admin mở rộng riêng ở backend.

Tiến độ nhận từ server, theo công đoạn, polling khoảng 4 giây; không giả phần trăm theo byte/ETA. Job backup hiển thị ngay khi được nhận. Bộ lọc/trang/tab và disclosure đang mở được giữ qua polling.

Mutation dùng fresh Authenticator. Restore/Delete bắt buộc CONFIRM chính xác; restore thêm xác nhận có tài khoản/MFA của bản nguồn. Khôi phục tạo SAFETY, tạm dừng nghiệp vụ; lỗi sau ghi giữ bảo trì để vận hành đối soát. Không tự rollback toàn hệ thống. Nguồn gồm PostgreSQL public, hai MongoDB và uploads local nếu có; không gồm source/.env/khóa vận hành/ảnh cloud.

Restore có token monitor riêng qua X-Backup-Monitor, sessionStorage hỗ trợ reload cùng tab; không đặt token trong URL. Sau thành công phải đăng nhập lại. Download ZIP là response binary, không có static URL công khai. Delete giữ một bản khác có toàn vẹn hợp lệ. Lịch OFF/HOURLY/DAILY/WEEKLY theo UTC+7. Không có cancel job đã nhận, offsite, retention tự động hoặc tạo snapshot đồng thời đa DB.

## Kiểm chứng

Unit test kiểm tra trạng thái không tuyên bố an toàn, số liệu dung lượng phân biệt, dữ liệu escape, giới hạn bảo vệ, lọc và khóa. Browser fixture kiểm tra tab, chi tiết/menu, filter qua polling, bộ chọn chi nhánh dùng chung vẫn giữ cùng DOM node, màn hình 390/768/1024/1280/1440/1920/2560/3840px và CSS zoom 67%/80%/125%. Đây không phải điều khiển zoom native. Luồng MFA/CONFIRM sai/đúng, ZIP, xóa, lịch tuần, backup progress và restore monitor qua reload vẫn được kiểm tra với API giả lập.

Ảnh docs/ui/backup-admin-*.png, backup-actions-menu.png, backup-settings.png và backup-restore-confirm.png dùng dữ liệu giả lập; không phải số liệu dung lượng/quota hay thao tác trên production.

## Nhịp bố cục tinh gọn

Tổng quan mặc định khoảng 140–165px trên desktop, một hàng trạng thái và một hàng ba chỉ số; không có vạch dọc hoặc đồ thị dung lượng. Dung lượng trống và footprint kho backup đặt chung dòng phụ, vẫn phân biệt rõ. Giới hạn bảo vệ mở qua biểu tượng thông tin có nhãn truy cập bàn phím. Lưu ý vận hành tối đa hai mục mặc định, các mục còn lại mở rộng; link nằm ngay cạnh nội dung.

Tab là tầng điều hướng duy nhất: bỏ tiêu đề card danh sách và bỏ lối tắt Cấu hình cuối trang. Thanh công cụ nhỏ chứa số bản, Bộ lọc và Làm mới. Menu mỗi bản dùng icon ba chấm với title/aria-label; cơ chế xác nhận dữ liệu giữ nguyên.

Typography trong module: tiêu đề trang 22px semibold, tiêu đề khu vực 14px, nội dung 13px, nhãn phụ 12px, chỉ số 20px. Button/input desktop 36px, mobile giữ 44px để thao tác bằng tay. Card padding 16px, section gap 20px, hàng bảng desktop 56–64px. Cột bảng 35/15/12/18/20%. Kiểm thử thêm một bản duy nhất để bảo đảm card không tự kéo chiều cao; ảnh backup-admin-single.png dùng fixture 3,9MB.

## Đồng bộ kích thước theo menu Phục vụ / Thu ngân

Thông số mới ưu tiên kết quả đo trình duyệt của hai màn hình menu, thay cho bộ kích thước 36px ở bản tinh gọn trước. Không sửa các module tham chiếu hoặc bộ chọn chi nhánh.

| Thành phần chung | Đo ở menu | Áp dụng cho Sao lưu |
| --- | --- | --- |
| Font / nội dung | Nunito Variable, 14px, line-height 1.5 | Font/token chung, nội dung và tên bản 14px |
| Nút / pagination menu | 16px (readability.css !important), min-height 44px | 16px, min-height 44px |
| Input desktop / mobile | 14px / 16px, min-height 44px | 14px / 16px, min-height 44px |
| Chữ phụ | 12px | 12px |
| Tiêu đề trong menu | 18px | Tiêu đề khu vực 18px; tiêu đề trang theo workspace 24px |
| Bo control / panel | 10px / 16px | Dùng --radius-control / --radius-card |
| Panel desktop / mobile | padding 24px / 16px (không tính footer giỏ hàng riêng) | Bảng/cấu hình 24px / 16px; tổng quan giữ gọn ở 16px |
| Khoảng cách | 8, 12, 16, 24px | Dùng token --space-* và nhịp chung |

Script tests/browser/backup-menu-scale.mjs mở entry staff thật, vào menu bằng role WAITER và CASHIER với API giả lập, đo computed styles ở 1440/390px và xác nhận hai role dùng cùng kích thước. Kết quả tại docs/ui/backup-menu-sizing.json. tests/browser/backup-admin.mjs so sánh font/control/radius của backup với các giá trị đã đo, cùng các luồng MFA, lọc, menu, lịch và restore monitor. Chiều cao tổng quan/hàng bảng được phép tăng tự nhiên theo kích thước chung, không ép font nhỏ để giữ mốc cũ.

## Bảng theo mẫu quản lý danh sách

Tìm kiếm mã/người tạo và lọc loại sao lưu luôn hiển thị ngay phía trên khung bảng; ngày bắt đầu/kết thúc trong Bộ lọc mở rộng. Bảng và chân phân trang dùng chung khung viền mảnh, header nền nhạt, hàng xen kẽ/hover nhẹ và trạng thái dạng pill viền. Cột mã BK rút gọn UUID có thể bấm mở thông tin; tooltip và phần chi tiết giữ ID đầy đủ. Mã rút gọn không dùng làm định danh API.

Phân trang có số trang, trang đầu/cuối và trước/sau, số dòng mỗi trang cùng tổng kết quả trong footer. Các nút số trang hoạt động trên tập metadata đã tải, vẫn có cảnh báo nếu inventory truncated. Không thêm bộ lọc trạng thái giả vì inventory chỉ liệt kê bản hoàn tất; tác vụ thất bại xem ở Nhật ký. Giữ chữ/control theo kích thước đã đo từ menu Phục vụ/Thu ngân và giữ nguyên xác nhận MFA/CONFIRM.
