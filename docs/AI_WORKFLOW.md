# Dự báo AI theo công việc quản lý

Trang được tổ chức theo mục tiêu vận hành thay vì chỉ giới thiệu thuật toán:

1. **Chuẩn bị món và nguyên liệu:** chọn ngày, ước tính nhu cầu; mỗi món ghi rõ dùng mô hình đã học hay trung bình lịch sử. Từ kết quả chọn Lập dự trù nguyên liệu để tính và lưu kế hoạch qua API hiện có, xem nguyên liệu cần bổ sung, rồi mở Kho để xem/duyệt. Không tự nhập kho hoặc đặt hàng.
2. **Xây dựng combo:** phân tích khoảng ngày, xem nhóm món và căn cứ. Chuẩn bị combo dùng chính chi nhánh/khoảng ngày kết quả để tạo bộ dữ liệu FP-Growth. Admin chuyển tới Duyệt combo đặt giá; Manager chuyển tới Luồng FP-Growth. Không tự duyệt hoặc công bố combo. Đổi ngày cần phân tích lại trước khi chuyển dữ liệu.
3. **Rà soát biến động:** kiểm tra ngày đã kết thúc, sau đó mở báo cáo hóa đơn của chính ngày đó với doanh thu thuần, giảm giá và nguồn dữ liệu. Khi mô hình chưa sẵn sàng vẫn có thể đối chiếu hóa đơn ngày chọn. Không suy diễn nguyên nhân từ điểm bất thường.

Các chỉ số mô hình được đưa vào nội dung mở rộng. Trang ghi rõ phạm vi chi nhánh, hóa đơn đã thanh toán, dữ liệu thật/mô phỏng và giới hạn sử dụng dự báo. Kết quả chi nhánh khác không được giữ khi đổi chi nhánh; ngày dự trù phải trùng ngày dự báo đã chạy.

Dùng lại API nghiệp vụ hiện có, không thay thuật toán hoặc schema database. Kiểm tra: test tổng hợp kết quả và render bảng dữ liệu; test FE; build đủ ba app; kiểm tra bố cục với bản render từ template thực tế.
