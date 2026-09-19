# Dusko Restaurant FE

Dashboard tiếng Việt cho backend Express trong thư mục `Dusko_Restaurant_BE`.

## Chạy local

1. Khởi động backend tại `http://localhost:8080` theo cấu hình `.env` và cơ sở dữ liệu của BE.
2. Trong thư mục FE chạy `npm install`, sau đó `npm run dev`.
3. Mở `http://localhost:5173`. Vite chuyển tiếp `/api` và `/health` sang backend.

Nếu API chạy ở địa chỉ khác, tạo `.env` với `VITE_API_URL=https://dia-chi-api`. Khi đó backend cần cho phép CORS từ origin của FE.

## Chức năng

- Tổng quan doanh thu, đơn hàng, bếp, cảnh báo kho.
- Tạo đơn từ danh sách món lấy qua API phân tích giá vốn; thanh toán và chọn phương thức.
- Gom mẻ bếp, bắt đầu nấu, hoàn thành.
- Xem/cập nhật tồn kho; lập và duyệt kế hoạch mua hàng.
- Chạy dự báo, phát hiện bất thường, huấn luyện mô hình (ADMIN).
- Phân tích giá vốn và lợi nhuận từng món.
- Đăng nhập cho chức năng cần quyền MANAGER/ADMIN. FE không tự tạo tài khoản admin.

Chạy `npm test` cho kiểm thử API client, `npm run build` để kiểm tra bản build.

**Giới hạn API hiện tại:** BE chưa có endpoint danh sách chi nhánh, bàn và CRUD món. FE dùng mã chi nhánh/bàn nhập tay và API `/api/analytics/recipe-cost` làm danh sách món. API này hiện trả `costPrice` mặc định 50.000đ khi dữ liệu giá vốn còn trống, nên kết quả phân tích có thể chỉ mang tính tham khảo.
