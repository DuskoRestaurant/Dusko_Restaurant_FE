# Thực đơn — 29/10/2026

Trang quản lý món có bộ đếm, danh sách nhóm kèm số món, tìm theo tên/mã không dấu, lọc tình trạng và phân trang 12 món. Các thao tác giá bán, công thức và ngừng bán vẫn dùng luồng hiện có. Bố cục thích ứng ở 1440px, 1024px và 390px.

ADMIN có thể xóa nhóm trống sau xác nhận. Với nhóm còn món, giao diện yêu cầu chọn nhóm nhận; API chuyển toàn bộ món (kể cả món ngừng bán) và ẩn nhóm trong cùng transaction. Nhóm cũ được giữ trong database để bảo toàn tham chiếu khuyến mãi. Không xóa món hay dòng đơn hàng. Các vai trò khác không thấy thao tác xóa.

Kiểm chứng: 97 unit tests, build cả management/staff/customer và 8 kiểm tra trình duyệt đều đạt. Trình duyệt kiểm tra tìm không dấu, lọc nhóm, phân trang, hai luồng xóa, không tràn ngang tại ba kích thước và không có lỗi JavaScript. Backend có kiểm thử riêng cho rollback khi thiếu/sai nhóm nhận, chuyển cả món ngừng bán, giữ lịch sử và từ chối tạo món vào nhóm đã xóa.

Ảnh dùng dữ liệu kiểm thử, không phải giao dịch thật:

- [Desktop](catalog-1440.png)
- [Tablet](catalog-1024.png)
- [Mobile](catalog-390.png)

Xem thử cục bộ tại `/tools/catalog-preview.html`; trang này không gửi yêu cầu ghi dữ liệu đến backend.
