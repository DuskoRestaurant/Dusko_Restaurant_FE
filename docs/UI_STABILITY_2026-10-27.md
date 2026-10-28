# Ổn định giao diện và luồng phục vụ

## Không gian theo công việc

- Phục vụ: bàn, yêu cầu cần xác nhận, món cần mang ra, khách cần hỗ trợ. Thao tác thanh toán và lịch sử hóa đơn nằm trong khu vực Thu ngân.
- Thu ngân: ưu tiên bàn khách gọi tính tiền hoặc đã phục vụ đủ món; có các tab Hóa đơn và Khách hàng.
- Bếp: mẻ chờ làm, đang làm và mẻ vừa hoàn thành. Danh sách hoàn thành chỉ lưu tối đa 30 mẻ được hoàn thành trên màn hình đang mở, không phải lịch sử bếp lâu dài.
- Cập nhật 28/10: mọi tài khoản nhân viên (phục vụ, thu ngân, bếp), quản lý và quản trị đều thấy ba khung Bếp / Thu ngân / Phục vụ sau khi đăng nhập hoặc tải lại trang, và đều được vào cả ba. Có nút Đổi khu vực trong từng màn hình. Vai trò gốc của tài khoản không đổi; API nghiệp vụ nhân viên dùng chung quyền, vẫn giới hạn chi nhánh. Chỉ quản lý/quản trị được vào trang quản lý.

## Thao tác và dữ liệu

- Gắn khách ngay trong chi tiết bàn, sau khi đối chiếu số điện thoại. Gửi mã lượt phục vụ cùng yêu cầu để tránh gắn nhầm khi bàn vừa đóng rồi mở lại.
- Transport của app nhân viên nhận object và mã hóa JSON một lần. Bếp đọc đúng `product` và `orderItems` từ API.
- Hiển thị trạng thái cập nhật và thời điểm nhận dữ liệu. Bếp giữ danh sách cũ khi mất mạng, có nút thử lại và cập nhật dự phòng mỗi 15 giây.
- Khách quét QR có thể gọi món ngay; phần thành viên được thu gọn và không bắt buộc.
- Sidebar quản lý chia theo nhóm nghiệp vụ. Header, tab phục vụ và bảng được giới hạn CSS theo màn hình; màu dùng token navy/vàng cho cả sáng và tối.
- Hóa đơn tiếp tục dùng màn hình quản lý riêng, nội dung xem trong Shadow DOM và in qua iframe để tránh CSS của app làm hỏng bản in.

## Kiểm thử

```powershell
npm test
npm run build:all
node tools/contrast.js
node tests/browser/receipt-management.mjs
node tests/browser/staff-picker.mjs
```

Hai script browser cần Playwright và Microsoft Edge. Có thể đặt `NODE_PATH` đến một thư mục `node_modules` đã cài Playwright.

Luồng thực tế cần backend fixture riêng. Trong repository backend, chuẩn bị PostgreSQL/MongoDB **dùng riêng cho kiểm thử** ở localhost, đặt `DATABASE_URL`, `DIRECT_URL`, `MONGODB_URI`, `MONGODB_AI_URI`, `NODE_ENV=test`, `JWT_SECRET` dành riêng cho test và các biến cấu hình bắt buộc của app. Không dùng `.env` production. Chạy migration vào database test trước.

```powershell
# Terminal backend; giữ tiến trình chạy trong suốt bài kiểm thử.
$env:DUSKO_TEST_FIXTURE="$env:TEMP\dusko-test-fixture.json"
npm run db:migrate
node --import tsx scripts/stability-fixture.ts

# Terminal frontend; cùng đường dẫn fixture.
$env:DUSKO_TEST_FIXTURE="$env:TEMP\dusko-test-fixture.json"
node tests/browser/service-flow.mjs
```

Fixture tạo chi nhánh, tài khoản và dữ liệu test mới mỗi lần khởi động, chỉ lắng nghe `127.0.0.1:58080`. Tệp fixture chứa token test ngắn hạn: giữ ngoài Git. Khởi động fixture mới trước mỗi lần chạy toàn bộ luồng; dùng database có thể bỏ đi sau kiểm thử.

Luồng browser kiểm tra mở bàn → gắn khách → gọi món QR → nhận yêu cầu → nấu → mang món → thanh toán → in → xem lại hóa đơn → mở lượt mới; kiểm tra quyền, chi nhánh, yêu cầu cũ, mất mạng/phục hồi và không tràn ngang ở 390/1440 px trong hai chế độ màu. Ảnh nằm trong `%TEMP%\dusko-stability-qa`.

## Triển khai

Triển khai backend tương ứng và migration trước frontend. Việc push nhánh tính năng không đồng nghĩa đã cập nhật production. Script EC2 của backend chạy migration từ image mới trước khi thay container ứng dụng; nếu migration lỗi, dừng để kiểm tra log trước khi tiếp tục.
