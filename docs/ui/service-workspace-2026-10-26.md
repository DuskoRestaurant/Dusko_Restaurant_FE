# Màn mẫu Phục vụ & thu ngân — 26/10/2026

Phạm vi: màn phục vụ trong ứng dụng quản lý và component phục vụ dùng chung với nhân viên. Đây là bước làm màn mẫu trước khi áp dụng quy tắc sang các màn khác.

## Quy tắc giao diện

- Dùng Nunito và bảng màu có sẵn trong `src/tokens.css`. Nền trung tính, bề mặt ít bóng, màu trạng thái ở nhãn nhỏ kèm chữ.
- Tiêu đề trang 28px trên desktop, 24px trên mobile; tiêu đề khu vực 18px; nội dung 14px; nhãn phụ 12–13px.
- Khoảng cách theo thang 4 / 8 / 12 / 16 / 24 / 32px. Nút tối thiểu 44px; input mobile 16px.
- Danh sách: tiêu đề và thao tác phụ → thống kê gọn → tìm kiếm/lọc → thẻ bàn. Hướng dẫn phục vụ có thể mở khi cần.
- Chi tiết: quay lại / tên bàn → tóm tắt → tab công việc → nội dung. Màu chủ đạo dành cho hành động chính và tab được chọn.
- Gọi món: lưới thẻ món, chạm toàn thẻ hoặc ảnh để thêm; tối đa 8 món mỗi trang sau khi tìm kiếm/lọc. Giỏ bên cạnh trên desktop, bên dưới trên mobile. Ảnh trong yêu cầu xác nhận cố định 48px.
- Desktop: thực đơn có vùng cuộn tối đa 60% chiều cao màn hình; các dòng trong giỏ có vùng cuộn tối đa 45%, phần tạm tính và gửi món nằm ngoài vùng cuộn này.
- Mobile: thanh giỏ cố định ở đáy, hiện số lượng và tạm tính; chạm để tới giỏ, có liên kết quay lại chọn món. Có khoảng trống cuối nội dung để thanh này không che nút gửi.
- Thay các rule màu/bố cục phục vụ cũ trong `pos-theme.css` bằng một phần có scope `.service-workspace`, dùng chung đúng component hiện có. Không đổi luồng nghiệp vụ hay quyền thanh toán.

## Xem thử an toàn

Chạy `npm run dev`, mở `/tools/service-preview.html?theme=light`.

- App nhân viên: thêm `app=staff`.
- Bỏ `theme=light` để dùng chế độ sáng/tối theo hệ điều hành.
- Trạng thái: thêm `state=empty`, `state=error` hoặc `state=loading`.
- Thực đơn lớn: thêm `stress=1` để dùng 120 món giả lập, có tên dài, thiếu ảnh và món tạm hết. Mở Bàn 02 → Gọi thêm để kiểm tra.

Trang xem thử dùng component thật và dữ liệu giả lập; mọi yêu cầu đi qua adapter cục bộ, không gọi API nhà hàng. Thao tác ghi dữ liệu bị chặn. Shell là bản rút gọn, không phải phiên đăng nhập thật. Trang này không nằm trong entry build production.

## Kiểm tra

- Baseline đã quan sát: desktop 1280px và nhân viên 390px; thẻ bàn có màu cố định bị lệch khi hệ điều hành dùng chế độ tối.
- Bản mới: danh sách / chi tiết kiểm tra ở 360, 390, 760, 1050 và 1366px, không tràn ngang phần phục vụ.
- Kiểm tra tìm bàn, lọc bàn trống, không có kết quả, bàn chưa mở, yêu cầu xác nhận, tab gọi món, thêm món và tạm tính; nút gửi bị vô hiệu khi giỏ rỗng.
- Kiểm tra loading, empty, lỗi kết nối và nút thử lại với adapter giả lập.
- `npm test`: 55/55 đạt, gồm kiểm tra phân trang không mất/trùng món, lọc trước khi phân trang và điều chỉnh trang khi dữ liệu giảm. `npm run build:all`: cả ba ứng dụng build thành công.
- `node tools/contrast.js`: 37 cặp màu chữ và 2 cặp màu viền đạt kiểm tra của repo. Đây là kiểm tra token, không thay thế audit accessibility toàn ứng dụng.
- Đối chiếu AST CSS: các rule ngoài phạm vi phục vụ được giữ nguyên, gồm theme trang khách.
- Chưa kiểm thử ghi đơn, đồng bộ realtime hay thanh toán với BE thật. Không deploy.

Ảnh: [desktop sáng](service-desktop-light.png), [desktop tối](service-desktop-dark.png), [chi tiết desktop](service-detail-desktop.png), [mobile sáng](service-mobile-light.png).

## Kiểm tra với thực đơn lớn

Đã kiểm tra bằng UI với 120 món giả lập và giỏ 9 món khác nhau:

- 15 trang, mỗi trang tối đa 8 món; chọn từ nhiều trang vẫn giữ số lượng và ghi chú.
- Tìm được món số 120, lọc nhóm 30 món thành 4 trang, không có kết quả hiện thông báo; nút trước/sau khóa ở giới hạn.
- Giỏ 9 món có phần dòng món cuộn riêng; tạm tính 1.021.000 ₫ và nút gửi vẫn ở ngoài vùng cuộn. Tên dài không ép giá tiền xuống nhiều dòng.
- Thanh giỏ mobile chuyển thẳng đến giỏ, liên kết quay lại chọn món hoạt động; làm mới giữ giỏ và ghi chú.
- Không tràn ngang ở 360, 390, 760, 1050 và 1366px trong dữ liệu kiểm tra.

Đây là kiểm tra khả năng chứa nội dung, chưa phải xác nhận trên toàn bộ dữ liệu BE thật hay đo hiệu năng mạng. API vẫn trả danh sách sản phẩm hiện có; phân trang thực hiện ở FE, chưa phải phân trang phía máy chủ.

Ảnh bổ sung: [thực đơn lớn trên mobile](service-large-menu-mobile.png), [giỏ nhiều món trên mobile](service-large-cart-mobile.png).

## Hoàn thiện màn hóa đơn — 27/10/2026

- Khi mở bàn, ẩn tiêu đề trang lặp lại; tên bàn là tiêu đề của ngữ cảnh đang xử lý.
- Tách phần hóa đơn thành các lượt gọi món và khối thanh toán riêng. Desktop đặt khối thanh toán bên phải; mobile đặt trước danh sách các lượt.
- Các lượt dùng disclosure native để mở đối chiếu tên món, trạng thái phục vụ, ghi chú, giá và giảm giá combo. Vùng danh sách có chiều cao giới hạn; làm mới giữ lượt đang mở và vị trí cuộn.
- Giữ nguyên điều kiện xác nhận yêu cầu, mang đủ món và quyền thu tiền. Nhân viên phục vụ không có nút thanh toán; VNPay được ghi rõ là Sandbox.
- Tab dùng roving tabindex, liên kết ARIA với panel, hỗ trợ phím trái/phải/Home/End. Tăng/giảm món giữ focus ở nút vừa thao tác.
- Kiểm tra bằng fixture `?theme=light&stress=1&bill=1`: 24 lượt, 72 món, tổng 10.008.000 ₫; không tràn cột ở 360/390/760/1050/1366px. Kiểm tra mở chi tiết, giảm giá và giữ trạng thái sau làm mới.
- Kiểm tra app nhân viên: không có nút Thanh toán hoặc bộ chọn phương thức khi dùng quyền WAITER.
- 55 test FE đạt; cả ba ứng dụng build được. Giao diện mới đang ở source local, chưa deploy FE.

Ảnh: [thu ngân desktop](service-checkout-desktop.png), [thu ngân mobile](service-checkout-mobile.png).

## Điều chỉnh theo phản hồi — 28/10/2026

- Danh sách bàn: gộp thống kê thành nút lọc có số lượng; tìm kiếm tối đa 320px, thẻ bàn gọn hơn và có vạch màu trạng thái. Giữ đồng thời các nhãn khi bàn vừa có yêu cầu vừa có món sẵn sàng. Desktop 1366px hiển thị 7 cột.
- Xác nhận: nút nhận yêu cầu màu xanh lá, kích thước vừa nội dung; từ chối viền đỏ, chữ đỏ. Hướng dẫn 14px, đậm và tương phản hơn.
- Mang món: số lượng thành nhãn đậm; khu vực bếp có nền rõ hơn, biểu tượng và chữ phân biệt đang chế biến/đang chờ.
- Gọi thêm: toàn thẻ món là một nút, có nhãn số lượng đã chọn; 4 cột trên desktop, 2 cột ở 390px. Tên dài giới hạn 3 dòng, vẫn đọc được đầy đủ qua tên truy cập và giỏ. Nút vô hiệu màu xám, không chuyển tiếp qua màu cam.
- Hóa đơn: nêu rõ chưa thể thanh toán và nguyên nhân; nút xử lý yêu cầu nổi bật. Khóa thanh toán khi còn yêu cầu hoặc món chưa phục vụ, giữ quyền thu tiền hiện có.
- Kiểm tra UI bằng 120 món giả lập: chọn qua ảnh trên điện thoại; tìm món tạm hết bị khóa; tìm kiếm/làm mới giữ giỏ và tổng tiền. Các tab ở 390px không tràn ngang. Nút xử lý yêu cầu chuyển đúng tab xác nhận.
- 58/58 test FE đạt, gồm kiểm tra bộ lọc/sắp xếp bàn và phân trang món. Build cả ba ứng dụng thành công. Các cặp màu mới dùng đạt tương phản AA (xanh lá/chữ trắng 6,11; đỏ/nền trắng 5,76).
- Đây là kiểm tra component với fixture cục bộ; chưa kiểm tra thao tác ghi đơn/thanh toán với BE thật. Chưa deploy FE.

Ảnh: [bàn](service-feedback-tables.png), [xác nhận](service-feedback-confirm.png), [bếp](service-feedback-ready.png), [menu lưới](service-feedback-menu.png), [thanh toán bị khóa](service-feedback-checkout.png).

## Sửa lỗi runtime sau gộp main — 29/10/2026

- Production hiển thị `updateSync is not defined` trên màn phục vụ/thu ngân. Khối conflict tableView đã làm thiếu định nghĩa updateSync, customerSummary và verifyCustomer, dù các chỗ gọi mới vẫn còn.
- Khôi phục 3 helper từ main, giữ UI đã duyệt và bỏ một nhãn sync bị lặp ở danh sách bàn.
- Thêm kiểm tra controller runtime: ADMIN/CASHIER/WAITER khởi động, báo sync và mở phiên bàn có thông tin khách. Đây là phần các test filter/menu thuần trước đó không bao phủ.
- 80/80 test FE đạt, build cả ba app thành công. Kiểm tra UI cục bộ: mở bàn, mở/đóng hộp thoại gắn khách (không submit dữ liệu), đổi tab gọi thêm và làm mới không có console error.
