# Giỏ nổi trên màn hình gọi món của khách

- Phạm vi: ứng dụng khách, điện thoại/tablet rộng tối đa 1050px.
- Thanh cố định dưới màn hình hiển thị số lượng và tổng tiền từ giỏ dùng chung, tính cả ưu đãi combo. Cập nhật theo cùng vòng render giỏ hiện có.
- Chạm thanh hoặc liên kết xem giỏ để mở dialog từ đáy. Di chuyển chính panel giỏ hiện có, không nhân đôi ID, nút gửi hay dữ liệu. Có thể chỉnh số lượng, bỏ món, ghi chú và gửi bằng luồng hiện có.
- Dialog native giữ focus, hỗ trợ Escape, nút đóng và chạm ngoài. Khóa cuộn nền, trả lại vị trí thực đơn khi đóng. Giữ trạng thái mở qua lần render toàn trang, trả giỏ về cột bên phải khi chuyển sang desktop.
- Chừa vùng safe area và khoảng cuối trang; nút hỏi nhà hàng nằm phía trên thanh giỏ. Nút gửi vô hiệu dùng màu xám.
- Build customer thành công. Kiểm tra UI bằng fixture 24 thẻ ở 390×844 và 820×1180: mở/đóng, tăng số lượng, cập nhật thanh tổng, Escape trả focus, không tràn ngang; đổi sang 1366×900 khi đang mở trả panel về desktop và giải phóng cuộn nền.
- Fixture `/tools/customer-cart-preview.html?theme=light` dùng controller/CSS thật và dữ liệu giả lập; không gọi API hay gửi đơn. Chưa kiểm tra đồng bộ nhiều khách hoặc ghi đơn với BE thật. Chưa deploy.

Ảnh: [thanh nổi](customer-cart-dock-mobile.png), [giỏ mở](customer-cart-sheet-mobile.png).

## Điều chỉnh giỏ biểu tượng và menu theo danh mục

- Thay thanh rộng bằng nút giỏ tròn 56px, có badge số lượng, tên truy cập và tạm tính trong tooltip. Đặt dưới nút hỏi nhà hàng trên mobile/tablet.
- Sau khi server xác nhận thêm thành công: hiệu ứng nhấn ở nút thêm, nhún nút giỏ, thông báo tên món và nhãn số lượng đã chọn. Tôn trọng reduced motion. Thêm nhiều món được xếp hàng để phản hồi cũ không ghi đè phản hồi mới.
- Sửa fixture trước đây gán mọi lượt thêm thành cơm chiên 89.000đ. Fixture hiện dùng đúng ID, tên, giá, số lượng và ghi chú cho từng món. Tổng trong app dùng giá từ cùng snapshot giỏ với từng dòng, tính cả combo, không trộn giá thực đơn vừa làm mới với giá giỏ cũ.
- Menu dùng thẻ có ảnh nhỏ trên điện thoại, lưới trên tablet/desktop và nút cộng tròn 44px. Danh mục bên trái sticky, tự đánh dấu nhóm chiếm nhiều vùng nhìn thấy nhất; bấm danh mục chuyển tới nhóm tương ứng.
- Mỗi danh mục có tối đa 8 món/trang, trước/sau và tổng số món; giữ lựa chọn giỏ khi đổi trang. Tìm kiếm trên toàn bộ sản phẩm trước khi chia trang. Tìm kiếm và trang đang xem được giữ khi app render lại dữ liệu.
- Kiểm tra fixture 78 món/6 nhóm ở 360/390/820/1366px: không tràn ngang; chuyển danh mục và cập nhật khi cuộn; trang sau có đủ món, gồm món tạm hết; tìm được món số 13 dù ban đầu ở trang 2. Giỏ gồm gỏi cuốn 49.000đ, cơm chiên 89.000đ và khoai tây 39.000đ hiển thị đúng tên, tổng 177.000đ.
- 62/62 test FE đạt. Test mới kiểm tra không mất/trùng sản phẩm qua các trang, tìm kiếm, trang vượt giới hạn, tổng giỏ và giảm giá combo. Customer build thành công. Chưa kiểm thử đơn thật/đồng bộ nhiều khách với BE, chưa deploy.

Ảnh mới: [menu mobile](customer-menu-mobile.png), [menu tablet](customer-menu-tablet.png).

## Menu toàn chiều ngang và tùy chỉnh món

- Thay danh mục bên trái bằng thanh cuộn ngang sticky dưới header 64px; vẫn tự đánh dấu nhóm đang nhìn và đưa nhóm được chọn vào vùng thanh ngang nhìn thấy. Header hiển thị tên quán và bàn.
- Thẻ dùng toàn chiều ngang trên điện thoại: ảnh 100px bên trái, tên/mô tả/giá bên phải, nút cộng 44px. Tăng khoảng cách thẻ 18px và chừa lề 14px; tablet có 2 cột ở 820px.
- Nút hỏi nhà hàng/AI chuyển thành biểu tượng bong bóng chat 52px, có accessible name, giữ chức năng chat và nội dung công bố hiện có.
- Bấm ảnh, tên hoặc cộng mở dialog chi tiết trước khi thêm: ảnh, mô tả, nhãn, số lượng, ghi chú 500 ký tự và tổng tiền tương ứng. Escape/đóng không đổi giỏ. Khóa submit khi đang gửi, đóng màn hình chỉ sau khi thêm thành công; lỗi giữ dữ liệu để thử lại.
- Ghi chú gửi cùng POST thêm món qua API sẵn có. Giỏ dùng chung gộp theo productId nên ghi chú áp dụng cho toàn bộ suất cùng món; dialog nêu rõ điều này và nạp lại ghi chú đang có. Để trống khi món đã có ghi chú sẽ giữ ghi chú cũ theo quy tắc backend.
- Hỗ trợ metadata nhãn `tags: ['BEST_SELLER', 'SPICY', 'VEGETARIAN']`, mô tả `description` và nút lọc nhãn trước khi phân trang. Chỉ hiện nhãn có metadata rõ ràng, không suy ra món chay/cay hoặc bán chạy từ tên món. Backend Product hiện chưa có những trường này: dữ liệu mẫu minh họa nhãn, còn catalog thật cần bổ sung cấu hình và API trước khi nhãn xuất hiện.
- Chưa có mô hình topping/options và giá phụ thu ở backend. Bản này hỗ trợ ghi chú yêu cầu, không tự tạo topping hoặc cộng giá giả; nhân viên xác nhận khả năng đáp ứng và phụ thu riêng.
- QA fixture: 360/390/820px không tràn ngang; bàn phím chọn danh mục; lọc món chay; mở/đóng dialog; thêm 2 suất gỏi cuốn kèm ghi chú, giỏ đúng 98.000đ; mở lại nạp đúng ghi chú; Escape giữ nguyên giỏ và trả cuộn nền. 63/63 test FE đạt, customer build thành công. Chưa kiểm thử gửi món với BE thật/chưa deploy.

Ảnh: [menu toàn chiều ngang](customer-menu-horizontal-mobile.png), [tùy chỉnh món](customer-dish-options-mobile.png), [tablet](customer-menu-horizontal-tablet.png).

## Tinh chỉnh cuối: cuộn liên tục, stepper và CTA

- Bỏ phân trang cho menu khách: toàn bộ món trong mỗi danh mục nằm trong luồng cuộn; ảnh vẫn lazy-load. Tìm kiếm và nhãn tiếp tục lọc toàn bộ catalog.
- Thanh danh mục sticky ngay dưới header cố định; danh mục đang xem có gạch nâu 3px. QA 390px: top thanh 64px, bấm Món chính đưa tiêu đề đến đúng khoảng trống dưới thanh; cuộn xuống cuối tự chuyển sang Tráng miệng.
- Popup dùng cụm nút `− / số lượng / +`, output có aria-live; chặn giảm dưới 1 hoặc vượt số suất còn lại, khóa tăng/giảm khi gửi. Tổng tiền cập nhật theo số lượng.
- Xóa nhãn bàn trùng trong hero ở cả app và fixture, chỉ còn bàn trên header. Mô tả thẻ chính giới hạn 1 dòng có ellipsis, mô tả popup giữ đầy đủ.
- Nút gửi dùng màu thương hiệu khi giỏ hợp lệ; giữ disabled xám cho giỏ rỗng/không hợp lệ/đang cập nhật. Fixture trước đó luôn khóa gửi để tránh ghi đơn; nay có nút gửi mô phỏng và thông báo không tạo đơn thật.
- QA fixture: 78 thẻ, không có phân trang; tăng 1→2→3 rồi giảm 2, thêm giỏ đúng 98.000đ. Nút gửi enabled có nền rgb(192,81,54), gửi mô phỏng hiện xác nhận. Không gọi API thật. 64/64 test FE đạt, customer build thành công. Chưa deploy.

Ảnh: [menu liên tục](customer-menu-continuous-mobile.png), [stepper](customer-detail-stepper-mobile.png), [CTA gửi](customer-cart-send-mobile.png).

## Lọc động, card gọn và cụm thao tác ở đáy

- Thanh danh mục chỉ còn tên nhóm, bỏ số đếm và tiêu đề lặp phía trên từng nhóm. Section vẫn có accessible name liên kết với nút danh mục. Lọc toàn catalog trước khi tạo danh mục; nhóm không có kết quả bị loại bỏ.
- Fixture nhãn bán chạy trước đây gắn cho toàn bộ 13 món khai vị. Đã thay thành 2 món khai vị và 1 món chính để kiểm tra nhóm có cả món thường và bán chạy. Khi lọc chỉ còn đúng 2 nhóm/3 card. Kết hợp tìm Lẩu thì không có kết quả và không còn danh mục thừa.
- Tên và nhãn cùng hàng nếu đủ chỗ; mô tả 1 dòng; giá và nút cộng cùng hàng. Không còn hàng riêng dành cho giá và khoảng đệm phía trên nút cộng. Card đầu cao 130px ở 360/390px.
- Thay cặp nút nổi chồng dọc bằng cụm ngang trong dải đáy có nền riêng trên mobile/tablet, tránh icon nổi trực tiếp trên nút cộng. Chat và giỏ đều 52×52px, cùng trục ngang, khoảng cách 16px. Chừa khoảng cuối nội dung và safe area; giữ panel chat và giỏ hiện có. Khi render lại app, trả host chat về nơi cũ trước khi dựng lại để giữ handler.
- Kiểm tra 360/390/820px không tràn ngang; lọc, empty, popup, thêm 1 món đúng 49.000đ và mở giỏ hoạt động. 65/65 test FE đạt, gồm trường hợp lọc bán chạy từ nhiều danh mục và bỏ nhóm rỗng. Customer build thành công; chưa deploy.

Ảnh: [lọc bán chạy và card gọn](customer-menu-filtered-compact.png).

## Badge danh mục căn giữa và FAB dọc

- Theo phản hồi mới, thay dải đáy bằng cụm FAB dọc sát phải 12px: giỏ 56px nền thương hiệu ở dưới, chat 48px nền sáng/viền mảnh phía trên. Cùng tâm ngang, cách nhau 18px; z-index 1010 và safe-area đáy. Nội dung cuối trang chừa 160px.
- Danh mục dạng viên thuốc 48px, active nền thương hiệu/chữ tương phản. Ẩn scrollbar cả Firefox/WebKit, giữ vuốt ngang và bàn phím.
- Khi active thay đổi do chọn nhóm hoặc cuộn nội dung, cuộn ngang mượt về tâm badge và kẹp trong khoảng 0..scrollWidth-clientWidth. Không gọi lại animation ở mọi frame nếu active không đổi, để người dùng có thể vuốt thanh. Click badge đang chọn vẫn căn giữa lại; đổi kích thước viewport cũng tính lại. Tôn trọng reduced motion.
- QA mobile: badge Rau & canh dừng cách tâm dưới 1px; đầu thanh scrollLeft=0, cuối thanh dừng sát giới hạn (sai số làm tròn native dưới 3px); cuộn về đầu tự active Khai vị. Tablet 820px: danh mục vừa thanh nên scrollLeft/max=0, không tràn ngang; tâm hai FAB trùng nhau, kích thước đúng 48/56px.
- 66/66 test FE đạt, thêm kiểm tra hàm căn giữa và kẹp biên, gồm trường hợp thanh ngắn hơn viewport. Customer build thành công. Chưa deploy.

Ảnh: [badge và FAB dọc](customer-category-pills-vertical-fab.png).

## Làm nhẹ badge và ổn định sticky/chuyển động

- Badge thường dùng nền chìm nhẹ, border 1px trong suốt; active giữ nền thương hiệu. Thêm transition màu 180ms, không thay kích thước/padding khi chọn. Focus bàn phím vẫn có outline 2px rõ ràng.
- Ô tìm kiếm bo tròn đồng bộ; hàng nhãn phụ chữ 12px, nền nhẹ, bỏ viền đậm và giữ vùng chạm 44px. Ẩn scrollbar cho cả thanh danh mục và nhãn phụ.
- Đo header bằng ResizeObserver thay vì giả định 64px. Sticky top bằng header thực tế +4px, phủ nền khoảng đệm; giữ chiều cao thanh tối thiểu 70px để không phát sinh thay đổi luồng khi ghim. Offset khi chọn nhóm tính theo header và chiều cao thanh thực tế.
- Bỏ chuyển dọc tức thì: chọn nhóm cuộn dọc mượt; giữ active nhóm đích trong lúc chuyển để badge không chạy qua các nhóm trung gian. Scrollspy trở lại khi đến đích hoặc khi người dùng chủ động wheel/touch/bàn phím. Căn giữa ngang vẫn kẹp biên; lưu vị trí thanh qua render dữ liệu. Reduced motion dùng chuyển tức thì và tắt transition.
- QA mobile: header thực tế 79px, thanh ghim top 83px, đáy 153px; nhóm đích top khoảng 161px, không bị che; badge Rau & canh dừng lệch tâm dưới 1px, card vẫn cao 130px. Kiểm tra build customer thành công và 66/66 test FE đạt. Chưa deploy.

Ảnh: [menu nhẹ và khoảng ghim](customer-menu-soft-sticky-mobile.png).

## Khôi phục hình khối nút và giảm chiều cao kén

- Bộ lọc phụ có nền trắng và viền mảnh, active nền thương hiệu nhẹ/viền rõ hơn. Hình khối cao 32px trong vùng bấm 44px, giúp dễ định vị bằng chuột nhưng vẫn chạm được trên điện thoại.
- Danh mục chưa chọn dùng nền trắng, viền token line và bóng 1px nhẹ để tách khỏi canvas kem; hình khối cao 36px trong vùng bấm 44px. Active giữ màu thương hiệu; focus bàn phím và hover có phản hồi riêng.
- Thanh danh mục giảm từ 70 xuống 52px; cập nhật scroll-margin tương ứng, chuyển động và phép đo header vẫn giữ. Thay đổi chỉ ở CSS, không đổi quy tắc lọc/giỏ.
- QA UI 390/820px không tràn ngang; vùng bấm đo được 44px; thanh cao 52px. Lọc bán chạy vẫn đúng 3 card thuộc 2 danh mục. Customer build thành công, diff check sạch. Chưa deploy.

Ảnh: [bộ lọc rõ hình khối và kén gọn](customer-filters-defined-compact.png).

## Tiêu đề nhóm và scrollspy ổn định — 29/10/2026

- Thêm h3 tên danh mục ngay đầu mỗi nhóm món; giữ thanh badge để điều hướng. Không thêm số đếm lặp.
- Thay chọn nhóm theo diện tích nhìn thấy bằng đường đọc ngay dưới sticky. Thêm vùng trễ 24px mỗi phía và chờ 160ms cho ứng viên ổn định để tránh đổi qua lại ở ranh giới. Chọn badge vẫn phản hồi ngay và cuộn mượt tới tiêu đề; kẹp biên giữ nguyên.
- Thu lịch sử gọi món thật vào disclosure “Món đã gọi”, mặc định đóng; giữ trạng thái mở qua các lần cập nhật. Giữ toàn bộ giá/trạng thái bên trong và escape nội dung. Rút trạng thái kết nối, số khách dùng chung; hướng dẫn hỗ trợ vẫn có cho trình đọc màn hình nhưng không lặp thành đoạn dài.
- Fixture bỏ mô tả boilerplate lặp trên mọi món và đồng bộ header/foundation với app thật.
- Quan sát trang thật: các nhãn như VNP-78ba2320 và nhiều món nằm trong Bia là dữ liệu catalog hiện có, không phải chuỗi debug sinh bởi component. Không xóa hoặc sửa phân loại production trong lần thay đổi giao diện này.
- 84/84 test FE đạt, build:all thành công. QA viewport 390px: tiêu đề Món chính top ~156px, sticky bottom 148px; không tràn ngang. Test mới bao phủ đường đọc, vùng trễ, nhóm lọc/cuối trang và lịch sử đóng/mở/escape.

## Áp dụng vào nhánh Tong

- Giao diện được nối trực tiếp vào entry của customer-web và component phục vụ dùng chung của quản lý/nhân viên; tools chỉ là fixture xem thử, không nằm trong entry production.
- Gộp origin/main b524e50 trước khi áp dụng UI. Resolve conflict customer-web/src/main.js bằng cách giữ customer recognition/render và menu/controller mới. Giữ luồng khách hàng, ưu đãi máy chủ, phân quyền/role picker và receipt mới từ main.
- Bản gộp: 77/77 test FE đạt, build:all thành công; đối chiếu token contrast đạt. BE origin/main 2e12e63: Prisma client generate, TypeScript build và 71/71 test đạt (HTTP loopback test cần chạy ngoài sandbox).
- Chỉ cập nhật nhánh Tong theo yêu cầu, không triển khai production hoặc chạy migration database. Các ghi chú triển khai riêng được giữ local.
