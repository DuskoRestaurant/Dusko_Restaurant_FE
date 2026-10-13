# CI/CD trên GitHub Actions

## Cách hoạt động

- Push main hoặc mở PR vào main: cài từ lockfile, audit mức high, test và build.
- BE dùng PostgreSQL/MongoDB tạm trong CI, không dùng database cửa hàng để test.
- Build thành công được lưu artifact theo commit SHA trong 7 ngày.
- CD chỉ chạy trên main khi repository variable AZURE_DEPLOY_ENABLED=true; mặc định chưa bật vì chưa có Azure.
- Có workflow_dispatch để chạy lại từ tab Actions. Job production nối tiếp CI và dùng đúng artifact của lần chạy đó.
- Không hủy deployment đang chạy khi có push mới. Các lần cùng branch xếp hàng theo concurrency của GitHub.

## Thiết lập khi có Azure

Tạo GitHub Environment tên production trong mỗi repository. Có thể bật required reviewer và chỉ cho branch main triển khai. AZURE_DEPLOY_ENABLED và các URL VITE phải đặt ở cấp repository (không chỉ environment), vì điều kiện job/build đọc chúng trước khi vào production.

### Backend: Azure App Service Linux, Node.js 22

Repository variables:
- AZURE_DEPLOY_ENABLED=true (chỉ bật sau khi cấu hình xong).
- AZURE_WEBAPP_NAME: tên App Service.
- BACKEND_HEALTH_URL: https://<api-domain>/ready.

Environment production secrets:
- AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID.
- DIRECT_URL: kết nối PostgreSQL trực tiếp dùng cho migration.

Thiết lập federated identity OIDC cho subject repo:vinhtran2109/Dusko_Restaurant_BE:environment:production. Giới hạn quyền identity ở App Service cần triển khai. Không cần lưu client secret trong GitHub.

App Service giữ các biến runtime trong Application settings: DATABASE_URL, MONGODB_URI, MONGODB_AI_URI, JWT_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY, CUSTOMER_WEB_URL, CORS_ORIGINS và các biến ảnh/chat trong .env.example. Đặt NODE_ENV=production, SCM_DO_BUILD_DURING_DEPLOYMENT=false. Bật WebSocket, dùng một instance; nếu muốn giữ ảnh local phải dùng ổ bền vững, ưu tiên Azure Blob.

Database đang có bảng phải được baseline trước lần CD đầu tiên theo DEPLOYMENT.md. Pipeline không tự reset/baseline database. Migration thất bại sẽ chặn deploy. Sau deploy, /ready phải trả HTTP thành công. Nếu probe thất bại, job báo lỗi; không tự rollback database.

### Frontend: ba Azure Static Web Apps

Repository variables:
- AZURE_DEPLOY_ENABLED=true.
- VITE_API_BASE_URL=https://<api-domain>.
- VITE_STAFF_APP_URL=https://<staff-domain>.
- VITE_MANAGEMENT_APP_URL=https://<management-domain>.

Environment production secrets (deployment token của từng Static Web App):
- AZURE_SWA_MANAGEMENT_TOKEN.
- AZURE_SWA_STAFF_TOKEN.
- AZURE_SWA_CUSTOMER_TOKEN.

Ba job deploy dùng artifact đã build; không build lại trên Azure. Cấu hình navigationFallback hỗ trợ truy cập trực tiếp /t/<token>. Không đặt API key Gemini, SQL/Mongo URI hoặc khóa Azure trong VITE_*.

## Vận hành

Xem kết quả trong tab Actions. Khi chưa bật Azure, job deploy hiện Skipped là đúng. CI đỏ thì không deploy. Khi có lỗi sau triển khai, chọn commit trước đã kiểm chứng và chạy lại quy trình phù hợp; migration phải tương thích ngược hoặc có kế hoạch phục hồi đã thử. Ba frontend có thể thành công/thất bại độc lập, không phải một giao dịch deploy nguyên khối.

CI/CD không tự tạo tài nguyên Azure hoặc phát sinh đăng ký dịch vụ. Chưa có Azure nên chưa xác minh deployment thật.

Nguồn chính thức:
- https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions?tabs=openid
- https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration
