# Dusko Restaurant FE

## Hai ứng dụng gọi món mới

- `customer-web/`: website khách mở từ QR của từng bàn, chạy local bằng `cd customer-web; npm ci; npm run dev` ở `http://localhost:5174`.
- `staff-app/`: PWA phục vụ độc lập, chạy bằng `cd staff-app; npm ci; npm run dev` ở `http://localhost:5175`.

Hai app gọi BE ở `http://localhost:8080` theo mặc định. Khi triển khai, đặt `VITE_API_BASE_URL` ở từng app và `CUSTOMER_WEB_URL` ở BE trước khi in QR. Không in QR chứa `localhost` cho bàn thật. `POST /api/catalog/branches/:branchId/tables/:id/qr` luôn trả QR cố định của bàn để in lại khi cần; `/qr/reissue` chỉ dùng khi phải thu hồi mã cũ. Món khách gửi chỉ chuyển xuống bếp sau khi nhân viên tới bàn và bấm xác nhận trong Staff PWA.

Customer Web lọc món theo nhóm, theo dõi các lượt đã gọi trong phiên và cập nhật trạng thái định kỳ. Staff PWA làm mới danh sách bàn/phiên định kỳ; khi mất mạng lúc gửi món, bản nháp được giữ trên thiết bị với UUID cũ để nhân viên chủ động thử gửi lại. Giao diện ghi rõ bản nháp chưa tới máy chủ và bếp chưa nhận món. Đây là lưu nháp cục bộ, chưa phải hàng đợi đồng bộ chạy nền.

Màn hình bếp tự tải lại mỗi 15 giây, có chế độ toàn màn hình, lọc trạm, số suất, bàn, mã lượt, ghi chú từng món và nhóm riêng cho mẻ chờ trên 60 phút để nhân viên xác minh. Quản lý QR tại mục **Chi nhánh & bàn** cho phép tạo/tải lại, khóa và cấp mã mới. Ảnh trong `public/dishes/` và `Dusko_Restaurant_BE/assets/dishes/` là ảnh minh họa tạo cho dữ liệu mẫu; thay bằng ảnh chụp món thật của cửa hàng trước khi vận hành chính thức.

Dashboard tiếng Việt cho backend Express trong thư mục `Dusko_Restaurant_BE`.

## Chạy local

1. Khởi động backend tại `http://localhost:8080` theo cấu hình `.env` và cơ sở dữ liệu của BE.
2. Trong thư mục FE chạy `npm install`, sau đó `npm run dev`.
3. Mở `http://localhost:5173`. Vite chuyển tiếp `/api` và `/health` sang backend.

Nếu API chạy ở địa chỉ khác, tạo `.env` với `VITE_API_URL=https://dia-chi-api`. Khi đó backend cần cho phép CORS từ origin của FE.

## Chức năng

FE có 8 trang chính. Menu thay đổi theo vai trò đăng nhập.

Thực đơn và màn hình tạo đơn hiển thị ảnh món. Quản trị viên chọn file JPG, PNG hoặc WebP (tối đa 5 MB) khi thêm hoặc sửa món. BE lưu ảnh tải lên trong `uploads/dishes/`; cần giữ thư mục này khi triển khai và sao lưu. Ảnh dùng cho dữ liệu mẫu được đóng gói trong `public/dishes/` và `Dusko_Restaurant_BE/assets/dishes/` để có mặt sau khi clone/deploy.

- Tổng quan doanh thu, đơn hàng, bếp, cảnh báo kho.
- Tạo đơn từ thực đơn và bàn còn trống của chi nhánh; thanh toán theo quyền thu ngân/quản lý. Đơn được lưu trên máy khi mất mạng và đồng bộ với mã UUID chống ghi trùng.
- Gom mẻ bếp, bắt đầu nấu, hoàn thành.
- Xem/cập nhật tồn kho; lập và duyệt kế hoạch mua hàng.
- Chạy dự báo, phát hiện bất thường, huấn luyện mô hình (ADMIN). Màn hình cho biết số ngày dữ liệu thực tế đã có theo món/chi nhánh trước khi train. LSTM cần 38 ngày bán liên tiếp đã hoàn tất; mô hình bất thường cần 30 ngày có đơn đã thanh toán. Khi chưa đủ dữ liệu LSTM, BE dùng trung bình số suất bán từ các ngày có đơn đã thanh toán trong 30 ngày trước ngày dự báo. Kiểm tra bất thường lấy chỉ số từ đơn thật của ngày được chọn.
- Phân tích giá vốn và lợi nhuận từng món.
- Quản lý chi nhánh và bàn; tạo/sửa nhóm món, món, công thức định lượng; ngừng bán hoặc bật bán lại món. Quản trị viên tạo/sửa nguyên liệu, quản lý có thể sửa bàn trong chi nhánh.
- Đăng nhập trước khi sử dụng; menu hiển thị theo vai trò ADMIN, MANAGER, CASHIER, WAITER và CHEF. Chi nhánh của nhân viên được lấy từ tài khoản.

Chạy `npm run build` để kiểm tra bản build.

Đơn offline được lưu trong localStorage của trình duyệt hiện tại. Khi có mạng, vào mục Đơn hàng và chọn **Đồng bộ đơn**; các đơn bị từ chối (ví dụ bàn đã bận hoặc giá món thay đổi) vẫn nằm trong danh sách để xử lý. Không xóa dữ liệu trình duyệt trước khi đồng bộ.
