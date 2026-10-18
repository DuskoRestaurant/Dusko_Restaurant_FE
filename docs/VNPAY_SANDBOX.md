# QR VNPay Demo

Tại hóa đơn bàn hoặc đơn mang đi, chọn phương thức **VNPay** rồi nhấn **Thanh toán** để mở mã QR. Chỉ ADMIN, MANAGER, CASHIER sử dụng; app nhân viên dùng cùng component với quản trị.

QR mở cổng VNPay Sandbox, tại đó chọn phương thức QR. Hộp thanh toán hiển thị tiền, thời hạn, liên kết mở cổng và trạng thái cập nhật mỗi 3 giây. Không dùng tiền thật. Đóng hộp không hủy giao dịch. Chỉ IPN có chữ ký hợp lệ ở backend mới cập nhật hóa đơn.

Cần cấu hình tài khoản Sandbox và IPN HTTPS ở backend; xem BE docs/VNPAY_SANDBOX.md. Khi chưa có credential, app hiển thị thông báo thiếu cấu hình. Không có HashSecret trong frontend.
