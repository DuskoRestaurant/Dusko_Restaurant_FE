# Giao diện POS — 05/10/2026

## Đường dẫn khi chạy trên máy

- Quản lý: http://localhost:5173/
- Nhân viên: http://localhost:5175/
- Khách: http://localhost:5174/ hướng dẫn quét QR; thực đơn cụ thể nằm tại `/t/<mã QR của bàn>`.
- Trang quản lý và trang đăng nhập có liên kết mở app nhân viên. App nhân viên có liên kết trở lại quản lý.
- Mỗi thư mục app chạy bằng `npm run dev`. Backend chạy tại cổng 8080.

## Thay đổi giao diện

- Dùng chung tông xanh dương, nền sáng, chữ Inter và hệ thống nút, ô nhập, thẻ dữ liệu.
- Bàn có cả màu và nhãn trạng thái: trống, đang phục vụ, đặt trước, cần hỗ trợ.
- Thực đơn nhân viên có ảnh, giá, tìm kiếm, nhóm món; giỏ bên phải trên máy tính.
- Khách chọn món theo thẻ ảnh, thấy tạm tính và ghi chú trong giỏ. Trên điện thoại có liên kết đi nhanh đến giỏ món.
- Đồng bộ giao diện tổng quan, bếp, kho, thực đơn, chi nhánh và các phần phân tích.
- Đăng nhập trực tiếp trên trang, hỗ trợ Enter, hiện/ẩn mật khẩu, báo lỗi và trạng thái đang đăng nhập.

## Giảm thời gian chờ

- Trang phục vụ quản lý truyền dữ liệu đã tải cho workspace, tránh tải bàn và sản phẩm lần thứ hai khi khởi tạo.
- Dùng lại thực đơn tối đa 12 giây khi chuyển bàn, gộp các yêu cầu thực đơn đang chạy. Làm mới thủ công và sau thao tác ghi sẽ yêu cầu dữ liệu mới.
- Nút chọn bàn, làm mới và thao tác ghi có phản hồi đang xử lý, ngăn bấm lặp trong lúc chờ.
- Backend lấy số đơn, món sẵn sàng và yêu cầu hỗ trợ đồng thời sau khi có danh sách bàn.
- Không bỏ kiểm tra quyền hoặc kiểm tra tồn kho trên máy chủ.
- API danh sách bàn đo trước thay đổi: 1.620 ms (một lần). Sau thay đổi: 614, 614, 628 ms. Đây là số đo cục bộ, chưa phải kiểm thử tải.
- App khách/nhân viên dùng API cùng origin qua Vite proxy, không gọi localhost của điện thoại. Đường dẫn hai app giữ hostname đang mở khi chạy cổng 5173/5175.

## Kiểm tra đã thực hiện

- Build quản lý, nhân viên, khách và TypeScript backend thành công.
- Đăng nhập quản lý và nhân viên; liên kết chuyển giữa hai app.
- Chọn bàn, mở và đóng phiên bàn trống số 2.
- Tìm món Cơm, thêm một suất cơm chiên 70.000 đồng, kiểm tra giỏ và bỏ món ở cả nhân viên/khách. Không gửi món thử xuống bếp, không phát sinh hóa đơn thanh toán.
- Bàn 2 đã được trả về trạng thái trống sau khi kiểm tra.
- Giao diện điện thoại: kiểm tra không tràn ngang ở trang khách và nhân viên.
- Kiểm tra ảnh món, bố cục desktop, màn hình bếp và danh sách bàn.

## Cấu hình khi triển khai

Nếu triển khai các app ở tên miền riêng, đặt `VITE_STAFF_APP_URL`, `VITE_MANAGEMENT_APP_URL` trước khi build. Nếu dùng cùng tên miền, cần cấu hình lại base khi build và đường dẫn phục vụ app nhân viên tại `/staff/`; API đặt tại `/api`. Dev proxy chỉ có tác dụng khi chạy Vite dev server. Mã QR trên điện thoại phải dùng địa chỉ LAN hoặc tên miền truy cập được; `localhost` chỉ trỏ về thiết bị đang mở trình duyệt.
