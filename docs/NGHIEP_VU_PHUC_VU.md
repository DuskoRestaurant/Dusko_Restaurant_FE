# Luồng phục vụ Dusko

Cập nhật ngày 03/10/2026. Đây là cách sử dụng luồng đang triển khai trong code; không phải kết quả chạy thử tại nhà hàng.

## 1. Cách tổ chức công việc

Mỗi bàn chỉ có một lượt phục vụ đang mở. Khách có thể gọi nhiều lần bằng QR; nhân viên có thể gọi thêm giúp khách. Các lượt đã được nhận đều nằm trong cùng hóa đơn của bàn.

| Người dùng | Màn hình | Công việc chính |
| --- | --- | --- |
| Khách | Website mở từ QR cố định tại bàn | Chọn món, gửi yêu cầu, theo dõi xác nhận và phục vụ |
| Nhân viên | App nhân viên → chọn bàn | Mở bàn, kiểm tra yêu cầu, gọi món giúp khách, mang món ra |
| Bếp | Màn hình bếp | Bắt đầu chế biến, đánh dấu làm xong |
| Thu ngân | Phục vụ & thu ngân → chọn bàn → Hóa đơn | Kiểm tra tổng tiền, nhận thanh toán, đóng bàn |

Trang thu ngân và app nhân viên dùng chung màn hình nghiệp vụ theo bàn. Quyền thanh toán chỉ có ở tài khoản quản trị, quản lý và thu ngân. Nhân viên phục vụ thấy hướng dẫn báo thu ngân khi đã phục vụ đủ món.

## 2. Luồng thông thường

1. Khách đến: nhân viên chọn đúng bàn, bấm **Mở bàn phục vụ**. QR đã in vẫn giữ nguyên.
2. Khách quét QR, chọn món và ghi chú, bấm **Gửi yêu cầu cho nhân viên**.
3. Nhân viên thấy bàn có yêu cầu chờ xác nhận, đến bàn đọc lại món và ghi chú với khách.
4. Nếu yêu cầu đúng, bấm **Đã kiểm tra · Nhận yêu cầu**. Nếu khách gửi nhầm, bấm **Từ chối**, nhập lý do và xác nhận. Website khách hiển thị lý do này.
5. Món cần chế biến tự vào màn hình bếp. Nước đóng chai, món tráng miệng làm sẵn đã được cấu hình phục vụ trực tiếp chuyển ngay vào mục **Món sẵn sàng**.
6. Bếp bấm **Bắt đầu nấu**, sau đó **Đã làm xong**. Phiếu bếp ghi số lượng và ghi chú của từng bàn để phân món đúng.
7. Nhân viên vào **Món sẵn sàng**, mang món đến bàn rồi bấm **Đã mang ra** cho dòng món tương ứng. Một dòng có nhiều suất chỉ đánh dấu sau khi mang đủ số suất của dòng đó.
8. Khi khách cần thanh toán, thu ngân mở **Hóa đơn** của bàn. Hệ thống chỉ cộng các lượt đã nhận, không cộng yêu cầu chờ xác nhận hoặc bị từ chối.
9. Nếu còn yêu cầu chưa xử lý hoặc món chưa mang ra, hóa đơn chỉ rõ bước cần hoàn tất. Sau khi đủ điều kiện, thu ngân chọn tiền mặt, chuyển khoản hoặc thẻ; kiểm tra đã nhận tiền rồi bấm **Đã nhận tiền · Thanh toán và đóng bàn**.
10. BE cộng tiền từ dữ liệu đã lưu, trừ kho theo định lượng, đánh dấu đã thanh toán và trả bàn về trạng thái trống trong cùng một giao dịch.

## 3. Bốn mục trong bàn

| Mục | Hiển thị | Thao tác |
| --- | --- | --- |
| Chờ xác nhận | Yêu cầu khách gửi qua QR chưa được nhận | Đọc lại với khách; nhận hoặc từ chối có lý do |
| Món sẵn sàng | Món phục vụ trực tiếp và món bếp đã làm xong; bên dưới có món bếp đang xử lý | Mang món đến bàn, đánh dấu đã mang ra |
| Gọi thêm | Thực đơn, ảnh, giá, giỏ món, ghi chú | Nhân viên gọi giúp khách; yêu cầu được nhận ngay |
| Hóa đơn | Tất cả lượt đã nhận, tình trạng từng món, tổng tiền | Xử lý việc còn thiếu, thanh toán hoặc đóng bàn chưa gọi món |

Danh sách bàn ưu tiên bàn có yêu cầu cần xác nhận, tiếp theo là bàn có món sẵn sàng. Có bộ lọc bàn chờ xác nhận, bàn có món cần mang ra và bàn trống.

## 4. Các tình huống cần xử lý

**Khách không quét được QR:** nhân viên chọn bàn đã mở, vào **Gọi thêm**, chọn món và ghi chú rồi gửi. Không cần xác nhận lần hai vì nhân viên đã trực tiếp kiểm tra với khách.

**Khách gọi thêm:** giữ nguyên bàn và lượt phục vụ; tạo thêm một lượt gọi món. Không tạo hóa đơn mới hoặc mở lại bàn.

**Bàn mở nhưng khách chưa gọi món:** vào **Hóa đơn** → **Đóng bàn chưa gọi món**. Chỉ đóng được khi không còn yêu cầu chờ xác nhận hoặc món đã nhận. Yêu cầu đã bị từ chối không cản việc đóng bàn.

**Mất phản hồi khi gửi từ app:** bản nháp giữ nguyên mã yêu cầu. Kiểm tra các lượt đã ghi nhận, rồi dùng **Thử gửi lại** nếu cần. Gửi lại cùng mã không tạo thêm lượt. Bản nháp có mã lượt phục vụ nên không được gửi vào lượt khách mới sau khi bàn đã đóng và mở lại. Không xem bản nháp trên điện thoại là món bếp đã nhận.

**Bàn có đơn cũ:** thu ngân đối soát trong **Mang đi và đơn cũ**. Không tự gán đơn cũ cho lượt khách mới. Đơn tại bàn mới phải đi qua màn hình theo bàn; khu vực tạo đơn cũ chỉ tạo đơn mang đi.

**Bếp tạm lỗi sau khi đơn được lưu:** giao diện thông báo yêu cầu đã nhận nhưng kết nối bếp gián đoạn. Báo bếp kiểm tra. Khi màn hình bếp đọc lại dữ liệu, BE thử gom các dòng đã được nhận nhưng chưa vào mẻ. Cơ chế này cần màn hình bếp đang mở; chưa thay thế một hàng đợi nền độc lập.

**Món chưa có định lượng nguyên liệu:** món chưa thể đặt. Quản trị viên cần nhập công thức hoặc định lượng hàng bán thực tế. Ví dụ nước đóng chai vẫn cần định lượng tồn kho của mặt hàng đó; bỏ tùy chọn chế biến không đồng nghĩa bỏ theo dõi kho.

## 5. Cấu hình món

Trong **Thực đơn → Sửa món**, tùy chọn **Bếp chế biến món này** quyết định món có vào KDS hay không. Bật cho món phải nấu hoặc chế biến. Bỏ chọn cho hàng có thể mang ra ngay. Món pha tại quầy vẫn cần chuẩn bị thì giữ bật và chọn trạm tương ứng.

Trạng thái **bếp làm xong** khác **đã mang ra bàn**. Thời điểm `servedAt` chỉ được lưu khi nhân viên bấm đã mang ra; không tự điền cho dữ liệu lịch sử.

## 6. Đường dẫn chạy tại máy phát triển

- Quản trị và thu ngân: `http://localhost:5173`, mục **Phục vụ & thu ngân**.
- App nhân viên: `http://localhost:5175`.
- Khách: URL `http://localhost:5174/t/<token>` lấy từ QR của bàn.
- BE: `http://localhost:8080`.

QR dùng trên điện thoại cần URL mà điện thoại truy cập được. Địa chỉ `localhost` ở đây dành cho kiểm tra trên máy phát triển.

## 7. Kết quả kiểm tra ngày 03/10/2026

Đã chạy 21 kiểm tra nghiệp vụ qua HTTP và Prisma trên database đang cấu hình tại máy phát triển; thêm 12 kiểm tra giao diện và luồng trình duyệt bằng Chrome chạy tự động. Mỗi nhóm dùng bàn, món và nguyên liệu kiểm thử tạm có tên `VERIFY-...`; các đơn được đánh dấu `SYNTHETIC`. Sau khi chạy đã xóa bàn, phiên, đơn, mẻ, công thức, nguyên liệu, QR và log Mongo thuộc nhóm kiểm thử. Không dùng kết quả này làm số liệu hiệu quả vận hành nhà hàng.

| Nhóm | Kết quả đã quan sát |
| --- | --- |
| Mở/đóng bàn | Chặn mở hai lần; chặn đóng khi có món/yêu cầu; đóng được bàn chưa gọi món hoặc chỉ có yêu cầu đã từ chối |
| QR và xác nhận | Cả món bếp và nước đều chưa sẵn sàng khi chưa xác nhận; xác nhận chỉ tạo một mẻ cho món bếp; từ chối có lý do |
| Phục vụ | Nước không có mẻ; không mang được món bếp chưa làm xong; lưu thời điểm đã mang ra; gửi lại không ghi thêm; phục vụ chưa trừ kho |
| Thanh toán | Chặn nhân viên phục vụ thanh toán và chặn thanh toán trước khi xử lý đủ món; gộp hai lượt QR/nhân viên đúng; thử lại không trừ kho lần hai |
| Dữ liệu kiểm thử | Một món bếp 15.000đ và ba phần nước 12.000đ cho tổng 51.000đ; yêu cầu ba phần nước đã từ chối không được cộng. Kho kiểm thử từ 50 còn 46 đúng bốn đơn vị, sau đó được xóa |
| Lượt khách mới | Bản nháp gắn phiên cũ bị từ chối sau khi bàn đóng và mở lại; luồng tạo đơn cũ không được tạo đơn mới tại bàn |
| App nhân viên | Thêm món và làm mới giữ ô tìm kiếm/ghi chú; nước tới mục sẵn sàng tự động; nhân viên thấy hướng dẫn chuyển thu ngân; khung 390 × 844 px không tràn ngang |
| Thu ngân | Dùng cùng màn hình theo bàn; thanh toán thẻ đóng bàn; mục đơn cũ thu gọn và biểu mẫu mới chỉ tạo đơn mang đi |
| Website khách | Thêm món giữ bộ lọc tìm kiếm; hiển thị chờ xác nhận và lý do từ chối thực tế |
| Lỗi trình duyệt | Không có lỗi JavaScript trong các luồng đã chạy |

BE và cả ba FE đã biên dịch thành công. Ở lượt rà soát tiếp theo, đăng nhập quản trị và chuyển nhanh qua các mục liên tiếp cũng được kiểm tra; mục cuối vẫn hiện đúng sau khi các yêu cầu tải dữ liệu cũ hoàn tất. Bộ tải trang đã được chặn kết quả cũ ghi đè màn hình mới. Kiểm tra điện thoại ở đây là kích thước trình duyệt mô phỏng; chưa thay thế thử camera quét QR, thao tác trên điện thoại thật hoặc chạy ca tại quán.
