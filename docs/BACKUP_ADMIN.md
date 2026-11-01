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

## Archive table and compact controls

Search, backup type and both UTC+7 date filters are always visible above the framed archive table. Clear filters and refresh share the desktop baseline; fields stack on narrow screens. The table keeps its short clickable BK code, full identifier in details, status pill, alternating rows and contextual action menu. Short codes never identify API requests.

Customer order controls in `customer-web/src/customer-menu.css` and `customer-web/src/style.css` provide the reference for subtle `--line` borders, surface, control radius and restrained secondary buttons. Backup fields use 36px desktop / 40px mobile height; secondary toolbar buttons use 36px / 13px text. Focus uses the shared navy `--focus-ring`, 2px outline with 2px offset, without changing borders, dimensions or adding shadows. The main backup action and restore/delete safety flow retain their existing size and confirmation requirements.

Pagination buttons use 28px desktop / 32px mobile targets and 12px text, with a compact rows-per-page selector and unchanged first/previous/numbered/next/last behavior. Filtering still precedes pagination and preserves values across polling; inventory truncation remains visible.

Validation: 104 FE tests, all three production builds, and mocked Edge browser coverage at 390-3840px plus zoom. Browser checks include all five field focus states, date/type/search combinations, clear filters, polling retention, numbered and boundary navigation, unchanged branch control identity, MFA/CONFIRM and restore monitoring. Screenshots use fixtures only.

## Management overview, activity and settings (2026-11-01)

All three tabs now share the same header, four metric cards (archives, latest completed archive, schedule and server capacity), protection disclosures and operational notices. Only the tab content differs. Pastel fills classify metrics; subtle hover does not imply the cards are clickable. The grid uses four desktop columns, two tablet columns and one narrow-screen column. Server usage and backup bytes remain distinct; no unsupported safety claim or capacity threshold was added.

Activity is a table backed solely by `data.jobs` from the existing server endpoint. Search, operation/result filters, five-row pagination, public event details and CSV export operate on the loaded set. The API currently returns at most ten recent jobs, explicitly shown in the UI. This is not a complete, immutable security audit: request IDs, source IP and denied authorization attempts are not supplied. CSV exports every matching loaded row, not just the selected page, allowlists public columns and neutralizes spreadsheet formulas. It excludes arbitrary metadata, monitor tokens, MFA and server messages.

Settings groups the real schedule workflow with storage, manual retention, server capacity, security/restore policy and data scope. Schedule changes still require a fresh MFA code and are persisted/audited by the existing backend. Offsite targets and automatic retention are not implemented; no pretend dropdown or local-only saved setting is offered. Read-only detail disclosures keep technical limits available without filling the page with explanatory paragraphs. Archive details explicitly state that per-archive restore verification results are not available.

Validation: 108 FE tests and all three builds pass. Mocked Edge checks cover stable header/overview/tab geometry at 390-3840px, metric grid ratios, separate pagination state across tabs, activity filters/details/polling/CSV, shared focus styling, responsive layouts, branch DOM identity and existing MFA/CONFIRM/restore-monitor flows. Screenshots in `docs/ui/backup-*` use isolated fixture data. No production database restore or backend deployment is part of this UI update.

## Shared operational-overview presentation

The later shared-component change supersedes the pastel KPI styling described above. Backup now uses `metricCard` / `metricGrid`, `tableMarkup` / `tableFrame` and `statusBadge` from `src/ui/admin-components.js`, with the same stylesheet as the operational overview. Both archive and activity tables use its cream header, white rows, typography, padding, dividers and pill statuses. Module CSS retains only operational layout, column sizing, filters, menus and narrow-screen flow. See `docs/ADMIN_COMPONENTS.md` for the reusable API and adoption scope.

## Compact archive workspace and visible restore

The archive view omits the subtitle, duplicated footprint/status text, UTC+7 filter suffixes and range/count summary. Date filtering still uses Vietnam calendar boundaries. Protection/verification limitations remain in Settings, while the schedule-off banner is replaced with a shortcut inside the schedule card. Fault, stale-backup and low-capacity warnings remain conditional.

Each archive row exposes Restore directly beside its secondary menu, with the same capability checks and disabled reason. Download/Delete remain in the menu; Restore still requires the existing CONFIRM, fresh MFA and source-credential acknowledgement. Creator information is available in the timestamp tooltip and archive details. Single-page navigation is omitted; multipage controls and page-size selection continue to work. Shared card/table presentation and branch controls are unchanged.
