# Frontend on Vercel

Repository: https://github.com/DuskoRestaurant/Dusko_Restaurant_FE

Create three Vercel projects linked to this repository. Keep Root Directory at
the repository root for all three: each app imports shared source and fonts.
The root vercel.json provides Vite, npm ci and SPA rewrites (including /t/:token).

| Project | Build command | Output directory | Intended domain |
| --- | --- | --- | --- |
| Management | npm test && npm run build:management | dist | admin.dusko.io.vn |
| Staff | npm test && npm run build:staff | staff-app/dist | staff.dusko.io.vn |
| Customer | npm test && npm run build:customer | customer-web/dist | order.dusko.io.vn |

Override the build command/output directory in each project's Build settings.
Set Production Branch to main. Git pushes trigger Vercel deployments; build
commands run frontend tests before publishing. GitHub Actions additionally
audits, tests, and builds all three apps. The old Azure deploy job was removed.

Set these public build variables in all three projects:

```env
VITE_API_URL=https://api.dusko.io.vn
VITE_API_BASE_URL=https://api.dusko.io.vn
VITE_MANAGEMENT_APP_URL=https://admin.dusko.io.vn
VITE_STAFF_APP_URL=https://staff.dusko.io.vn
```

Management uses VITE_API_URL; staff/customer use VITE_API_BASE_URL. Shared
WebSocket code derives WSS from the HTTPS API URL. Do not put JWT, Supabase,
database or AWS secrets in any VITE variable: they are bundled into browser JS.

Configure EC2 CORS_ORIGINS with exactly the deployed frontend origins, and
CUSTOMER_WEB_URL with the customer domain for QR links. If testing default
vercel.app domains, add only the actual project URLs to CORS after verifying
ownership; do not allow all preview domains or use a wildcard in production.

Before production use, api.dusko.io.vn must resolve to the intended EC2 address
and present a valid TLS certificate. Configure each frontend custom domain
using the exact DNS values displayed by Vercel; do not guess CNAME targets.
Do not change an existing domain record without checking its current service.

Checks: management and staff login screens render; the customer /t/:token route
serves the app; image/font assets and the staff service worker load; API requests
and authenticated WebSocket connections have no CORS/mixed-content errors.
