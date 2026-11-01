# Kết quả đồng bộ kích thước và kiểm thử sao lưu — 01/11/2026

## Kết luận trong phạm vi đã chạy

Các suite tự động hiện có đã chạy thành công. Có thêm một vòng backup/restore thật với database dùng một lần trên CI. Không ghi đè hoặc restore dữ liệu production. Chỉ CSS của module sao lưu được chỉnh; không sửa module Phục vụ, Thu ngân, bộ chọn chi nhánh hoặc mã nghiệp vụ backend.

## Kích thước được đo từ màn hình menu thật

Script `tests/browser/backup-menu-scale.mjs` khởi chạy entry staff, đăng nhập bằng fixture và mở menu lần lượt bằng WAITER/CASHIER. API được giả lập; DOM, CSS, font và cascade là của ứng dụng thật. Chờ font tải hoàn tất rồi đo ở 1440px/390px.

| Thuộc tính | Phục vụ | Thu ngân | Sao lưu sau chỉnh |
| --- | --- | --- | --- |
| Nội dung / line-height | 14px / 1.5 | 14px / 1.5 | 14px / 1.5 |
| Nút menu / min-height | 16px / 44px | 16px / 44px | 16px / 44px |
| Input desktop / mobile | 14px / 16px | 14px / 16px | 14px / 16px |
| Input min-height | 44px | 44px | 44px |
| Tên món / tên bản | 14px | 14px | 14px |
| Chữ phụ | 12px | 12px | 12px |
| Bo control / panel | 10px / 16px | 10px / 16px | Token chung 10px / 16px |
| Padding panel desktop / mobile | 24px / 16px | 24px / 16px | 24px / 16px; tổng quan gọn 16px |

Nút menu có quy tắc `font-size:16px!important` từ readability.css; chỉ đọc khai báo 14px trong pos-theme.css sẽ bỏ sót kích thước hiệu lực này. Native select có thể cao hơn 44px theo nền tảng; 44px là kích thước tối thiểu chung. Không sao chép chiều cao ảnh món 96px hoặc card món 210px vì các thành phần này không có vai trò tương đương trong backup.

Bằng chứng đầy đủ: `ui/backup-menu-sizing.json`. Browser test backup so sánh trực tiếp font, radius và min-height với JSON đo được; hai role cũng được so sánh với nhau để tránh lấy nhầm thông số riêng một màn hình.

## Các lượt chạy

| Lượt | Kết quả | Cách kiểm tra |
| --- | --- | --- |
| Backend `tests/backup*.test.ts` | 25/25 PASS | Filesystem tạm, worker/tool fixture, HTTP localhost |
| Backend `tests/mfa.test.ts` | 3/3 PASS | TOTP RFC6238, replay counter, mã hóa và khóa không giải mã được |
| Frontend `npm test` | 104/104 PASS | Bao gồm render backup, lọc, trạng thái, menu/service và startup các role |
| Đo menu Phục vụ/Thu ngân | PASS | Hai role × desktop/mobile, CSS thật và API giả lập |
| Browser `backup-admin.mjs` | PASS | Menu, chi tiết, tab, bộ lọc qua polling, MFA/CONFIRM, ZIP, xóa, lịch tuần, progress, restore monitor/reload và token hết hạn |
| Build frontend | PASS | Management + staff + customer |
| Backend CI checks | PASS | Unit/integration/build trên dịch vụ CI cô lập |
| Backup/restore database thật | PASS | PostgreSQL 18 + MongoDB 7 + uploads local trong container dùng một lần |
| Deploy EC2 từ lượt QA | SKIPPED | Không phải nhánh main/Tong |

Các lỗi 400/403 trong log kiểm thử quyền là kết quả mong đợi của ca phủ định, không phải lỗi làm suite thất bại.

## Vòng dữ liệu thật

[CI run 41258784223](https://github.com/DuskoRestaurant/Dusko_Restaurant_BE/actions/runs/41258784223).

- Source nghiệp vụ: `cc78bae4d6c7ca391064604409b68e62cc4ccb0f`.
- Nhánh QA: `qa/backup-verification-20261101-menu-scale`.
- Commit QA: `00428f502f1b5d9ec0fd0907e7bb7babc4fc3fac`; chỉ thêm tài liệu yêu cầu test, không đổi code/config nghiệp vụ. SHA riêng tạo image tag riêng, không thay tag image production.
- Docker CLI có trên máy nhưng local daemon không hoạt động; vì thế vòng database thật chạy bằng workflow hiện có trên CI. Điều kiện workflow chặn deploy trên nhánh QA.

Fixture `backup-live-restore.mjs` tạo ADMIN/MFA, một probe SQL, probe ở cả Mongo app/AI và ảnh local `before`. Chạy backup thật; đổi chúng thành `after`, thêm collection Mongo mới và tăng tokenVersion. Sau đó chạy restore thật và kiểm tra:

1. Giá trị probe SQL trở lại `before`.
2. Giá trị probe ở cả hai MongoDB trở lại `before`.
3. Collection chỉ được tạo sau snapshot không còn.
4. File uploads local trở lại byte nội dung `before`.
5. tokenVersion của user sau restore lớn hơn giá trị trước restore (8).
6. Có manifest SAFETY và kết quả worker `completed:true`.

Dòng kết quả trong log: `PASS: real SQL/Mongo/local images restore, safety copy, removal of post-snapshot collections, session revocation`.

Job IDs và bằng chứng log nằm tại `BACKUP_VERIFICATION_CI_2026-11-01.json`.

## Những gì các suite backup đã phủ

- Một writer giữ khóa bền vững; job lỗi, timeout/mất manifest không được báo hoàn tất; shutdown và recovery khóa cũ.
- Manifest/artifact, SHA-256, compatibility schema/đích/khóa; Mongo replica set/SRV; bảo vệ path traversal; inventory cũ ngoài cửa sổ 20/100.
- ZIP chỉ chứa artifact được phép; xóa giữ bản thay thế có toàn vẹn.
- Maintenance chặn nghiệp vụ, monitor riêng, lỗi trước/sau ghi giữ hoặc gỡ bảo trì theo checkpoint.
- ADMIN/MFA/CONFIRM và xác nhận credentials; lịch UTC+7, persistence và cạnh tranh scheduler.

Các bài worker/fault injection phần lớn dùng fixture để kiểm tra coordinator và filesystem. Chúng không thay thế việc phá kết nối database thật ở đúng từng bước import.

## Giới hạn của kết luận

Bộ 72 test case trong `Regression_Test_Cases_Backup_Restore.md` là thiết kế rộng hơn các suite tự động đã có. Lượt này **không được ghi là 72/72 PASS**. Chưa thực thi đầy đủ các ca disk-full thật ở từng phase, dump rất lớn, deadline 10/35/70 phút theo đồng hồ thật, crash nguồn điện, mất toàn volume, mọi biến thể dữ liệu/role và mọi điểm lỗi giữa các DB.

Vòng CI xác nhận khả năng backup và khôi phục bộ fixture, không phải diễn tập production hoặc xác nhận RPO/RTO cho dữ liệu thực tế. Các giới hạn kiến trúc vẫn giữ: không snapshot đồng thời đa DB, không rollback toàn hệ thống, chưa backup source/cloud/offsite, chưa retention tự động. Không có lỗi phát hiện trong phạm vi các lượt đã chạy; không suy ra bảo đảm tuyệt đối không mất dữ liệu.
