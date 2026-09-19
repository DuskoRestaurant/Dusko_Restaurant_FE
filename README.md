# Dusko Restaurant FE

Dashboard tiếng Việt cho backend Express trong thư mục `Dusko_Restaurant_BE`.

## Chạy local

1. Khởi động backend tại `http://localhost:8080` theo cấu hình `.env` và cơ sở dữ liệu của BE.
2. Trong thư mục FE chạy `npm install`, sau đó `npm run dev`.
3. Mở `http://localhost:5173`. Vite chuyển tiếp `/api` và `/health` sang backend.

Nếu API chạy ở địa chỉ khác, tạo `.env` với `VITE_API_URL=https://dia-chi-api`. Khi đó backend cần cho phép CORS từ origin của FE.

## Chức năng

- Tổng quan doanh thu, đơn hàng, bếp, cảnh báo kho.
- Tạo đơn từ thực đơn và bàn còn trống của chi nhánh; thanh toán theo quyền thu ngân/quản lý. Đơn được lưu trên máy khi mất mạng và đồng bộ với mã UUID chống ghi trùng.
- Gom mẻ bếp, bắt đầu nấu, hoàn thành.
- Xem/cập nhật tồn kho; lập và duyệt kế hoạch mua hàng.
- Chạy dự báo, phát hiện bất thường, huấn luyện mô hình (ADMIN).
- Phân tích giá vốn và lợi nhuận từng món.
- Đăng nhập trước khi sử dụng; menu hiển thị theo vai trò ADMIN, MANAGER, CASHIER, WAITER và CHEF. Chi nhánh của nhân viên được lấy từ tài khoản.

Chạy `npm test` cho kiểm thử API client, `npm run build` để kiểm tra bản build.

Đơn offline được lưu trong localStorage của trình duyệt hiện tại. Khi có mạng, vào mục Đơn hàng và chọn **Đồng bộ đơn**; các đơn bị từ chối (ví dụ bàn đã bận hoặc giá món thay đổi) vẫn nằm trong danh sách để xử lý. Không xóa dữ liệu trình duyệt trước khi đồng bộ.
