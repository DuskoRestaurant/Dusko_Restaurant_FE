# Dự báo AI theo công việc quản lý

Cập nhật 28/10/2026. Trang còn hai công việc: **Chuẩn bị món và nguyên liệu**, **Xây dựng combo**. Autoencoder và phần rà soát bất thường đã được gỡ khỏi giao diện/API.

Mỗi kết quả dự báo có mục “Vì sao ra … suất?”: nguồn đơn đã thanh toán, khoảng ngày UTC+7 theo thời điểm tạo đơn, số đơn thật/mô phỏng, bảng suất theo ngày, công thức trung bình hoặc phiên bản LSTM, 14 vector đầu vào và đầu ra trước làm tròn. Lịch sử theo giờ là số liệu đối chiếu, không phải dự báo theo giờ. Đặc trưng tháng chưa chứng minh mô hình học được mùa vụ.

Trung bình lịch sử = tổng suất / số ngày có bán trong 30 ngày đã hoàn tất; không mặc định chia 30. Ví dụ minh họa 60 suất / 2 ngày = 30 suất/ngày. LSTM cần ít nhất 38 ngày liên tiếp đã hoàn tất, dùng lượng bán trễ 1/7/14 ngày, trung bình/độ lệch 7 ngày và lịch thứ/cuối tuần/tháng.

Phân tích giỏ, luồng FP-Growth và duyệt combo có số giỏ cùng công thức support, confidence và lift. Một đơn là một giỏ; số suất không nhân số giỏ. Giá combo do quản trị viên đặt và duyệt.

Dự trù nguyên liệu cho biết từng món đóng góp bao nhiêu theo công thức: suất × định lượng / (1 − hao hụt). Lượng mua = max(0, tổng nhu cầu + tồn an toàn − tồn khả dụng). Kế hoạch đã lưu không bịa phân rã từ công thức mới. Chưa tự mua hàng hoặc nhập kho.

KDS giải thích quy tắc 3 suất/mẻ, cùng món/trạm/chi nhánh, thời điểm tạo đơn cách nhau tối đa 5 phút. Đơn đến sau được bổ sung vào mẻ chưa bắt đầu nấu còn chỗ; mẻ đang nấu được giữ nguyên.

Kiểm tra giao diện: `node tests/browser/ai-explanations.mjs` (Playwright + Edge). Bao gồm baseline, LSTM, bảng số liệu, dự trù, công thức FP-Growth, kết quả rỗng/lỗi và bố cục sáng/tối 390/1440 px.

## Bốn lỗi vận hành sửa ngày 28/10/2026

LSTM dựng lại cửa sổ đặc trưng từ đơn SQL khi dự báo. Với ngày đích D, dùng 14 vector D−14…D−1; các độ trễ cần 27 ngày bán liên tiếp D−28…D−2. Dự báo ngày mai dùng dữ liệu đến hôm qua, không lấy số bán dở dang hôm nay và không cần huấn luyện lại chỉ để làm mới đặc trưng. Thiếu ngày hoặc chọn xa hơn ngày mai thì hiện rõ lý do dùng trung bình.

Mỗi dòng dự báo có runId. Nút Lập dự trù gửi forecastRunId của kết quả đang xem; API trả 409 nếu lần chạy đã bị thay thế. Bộ kết quả mới thay cả bộ cũ, kể cả kết quả rỗng, và bỏ dự trù chưa duyệt để tránh mua theo số cũ. Dự trù đã duyệt được giữ; không trộn với lần dự báo khác.

Tổng quan ghi “Doanh thu đơn tạo hôm nay”: ngày tạo đơn theo UTC+7, chỉ tính đơn đã thanh toán. Đây không phải số tiền thu theo giờ thanh toán. Báo cáo Excel ghi rõ mốc ngày và hiển thị giờ UTC+7 bất kể múi giờ máy người dùng.
