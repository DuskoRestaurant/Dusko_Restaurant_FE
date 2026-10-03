# Liên kết kho và bán hàng

Cập nhật ngày 03/10/2026. Nội dung mô tả chức năng đã triển khai; không phải xác nhận hệ thống đã đáp ứng mọi nghiệp vụ nhà hàng.

## Luồng sử dụng

1. Trong **Kho & mua hàng**, thêm nguyên liệu, đơn vị và ngưỡng tồn. **Nhận hàng** cộng số lượng giao thực tế; **Kiểm kê** đặt lại số tồn thực tế và bắt buộc ghi lý do.
2. Trong **Thực đơn → Công thức**, chọn nguyên liệu, lượng dùng cho một suất và tỷ lệ hao hụt. Lượng nguyên liệu cần = số suất × định lượng / (1 − tỷ lệ hao hụt). Các món phục vụ trực tiếp cũng cần định lượng, ví dụ một chai nước tương ứng một đơn vị hàng trong kho; không tự tạo các định lượng này.
3. Thực đơn khách và nhân viên lấy trạng thái đặt được từ kho. Thiếu định lượng hoặc thiếu nguyên liệu sẽ khóa món và nêu lý do. Làm mới nền cập nhật trạng thái tại chỗ, giữ tìm kiếm và giỏ món. Backend kiểm tra tổng lượng cho toàn bộ giỏ; giới hạn từng món trên giao diện không thay thế kiểm tra này.
4. Yêu cầu QR chờ xác nhận chưa giữ nguyên liệu. Nhân viên xác nhận sẽ kiểm tra lại kho. Đơn đã nhận nhưng chưa thanh toán được tính vào lượng nguyên liệu đang cần, kể cả món đã nấu hoặc đã mang ra.
5. Món cần chế biến đi tới bếp; món phục vụ trực tiếp sẵn sàng để nhân viên mang ra. Không tự đổi quy trình bếp theo số tồn.
6. Thanh toán phiên bàn chỉ được thực hiện sau khi xử lý hết yêu cầu QR và mang ra hết món. Thanh toán trừ nguyên liệu một lần trong cùng giao dịch với trạng thái hóa đơn và ghi nhật ký xuất kho. Thanh toán lặp không trừ thêm.
7. Dự báo theo ngày cung cấp số suất cho kế hoạch mua. Kế hoạch quy đổi qua định lượng và dùng tồn khả dụng, đã trừ lượng cần cho các đơn được nhận. Duyệt đề xuất chỉ ghi nhận phê duyệt. Nhận hàng mới cộng tồn; có thể nhận từng phần, không vượt lượng đề xuất còn lại.
8. Tổng quan cảnh báo nguyên liệu theo lượng khả dụng. Phân tích món dùng giá vốn tham khảo đã nhập tại Thực đơn; nếu chưa nhập thì để trống, không tự gán giá vốn.

## Cách đọc trang Kho

| Thông tin | Ý nghĩa |
|---|---|
| Tồn ghi sổ | Số tồn sau nhận hàng, kiểm kê và hóa đơn đã thanh toán |
| Đơn đã nhận cần | Tổng nguyên liệu theo định lượng của các đơn PENDING |
| Còn khả dụng | Tồn ghi sổ trừ lượng cho các đơn đã nhận, tối thiểu 0 |
| Món sử dụng | Các món có công thức sử dụng nguyên liệu đó |
| Lịch sử xuất–nhập | 100 giao dịch mới nhất; có lý do hoặc tham chiếu hóa đơn/phiên |

Không thay định lượng khi món đang có đơn chưa thanh toán. Không đổi đơn vị nguyên liệu đã dùng trong công thức để tránh nhầm kg/g, chai/thùng. Kiểm kê thấp hơn lượng đang cần sẽ bị chặn; cần đối soát các đơn trước.

## Phạm vi hiện tại và dữ liệu còn thiếu

- Kho hiện là **kho dùng chung**, chưa có tồn riêng hoặc chuyển kho giữa chi nhánh. Không hiểu việc chọn chi nhánh là chọn một kho độc lập.
- Lúc kiểm tra thực đơn có **16 món không đặt được do thiếu định lượng**. Phải nhập định lượng thật trước khi bán; không tạo công thức giả để mở khóa.
- Giá vốn vẫn là giá vốn tham khảo nhập theo món, chưa tính giá vốn theo lô nhập hoặc giá bình quân của nguyên liệu.
- Nhật ký xuất bán bắt đầu từ phiên bản này. Không dựng lại giao dịch lịch sử thiếu chứng cứ.
- Chưa triển khai quản lý nhà cung cấp, công nợ, lô/hạn sử dụng, trả hàng, xuất hủy và chuyển kho. Nhận hàng hiện ghi số lượng và lý do/số phiếu.
- Chất lượng dự báo phụ thuộc dữ liệu đã thanh toán và mô hình đã được huấn luyện. Kiểm tra luồng dưới đây không chứng minh độ chính xác dự báo trên dữ liệu cửa hàng.

## Kiểm tra đã thực hiện

- [x] 14 tình huống tích hợp với nguyên liệu/món/bàn tạm: QR chưa giữ kho, xác nhận giữ kho và hao hụt, chặn vượt tồn, chặn sửa định lượng đang dùng, kế hoạch dùng tồn khả dụng, duyệt/nhận từng phần, chặn nhận vượt, phục vụ/thanh toán, chặn trừ lặp, nhật ký, hết hàng/nhập lại.
- [x] Dọn dữ liệu tạm sau kiểm tra; không sửa số tồn hay định lượng món có sẵn.
- [x] Giao diện Kho ở 1440px và 390px; mở sang Thực đơn và Dự báo.
- [x] Kiểm tra nút nhận hàng gửi đúng số lượng và lý do bằng phản hồi API giả lập; không nhận hàng giả vào dữ liệu cửa hàng.
- [x] Thực đơn khách khóa/mở món khi phản hồi tồn thay đổi; giữ nguyên vùng thực đơn và tìm kiếm.
- [x] Thực đơn nhân viên khóa món thiếu nguyên liệu tại chỗ, không tải lại cả trang.
- [x] API chặn nhân viên xem nhật ký kho/nhận hàng; từ chối số lượng nhận bằng 0.
- [x] Nhập hàng API dùng UUID chống ghi trùng; gửi lại cùng phiếu chỉ cộng kho một lần, dùng lại mã với nội dung khác bị chặn.
- [x] Khách gọi nhân viên/yêu cầu thanh toán, yêu cầu được liệt kê theo đúng bàn và phiên, nhân viên ghi nhận xử lý; gửi lặp không sinh thêm yêu cầu.
- [x] Backend biên dịch TypeScript; giao diện quản lý, khách và nhân viên build thành công.
