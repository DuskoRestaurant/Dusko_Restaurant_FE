# Frontend on Vercel

Repository: https://github.com/DuskoRestaurant/Dusko_Restaurant_FE

## Live deployment (2026-10-15)

All three projects are deployed in the dusko-restaurant-app Hobby team,
linked to the public repository and production branch main. No Pro trial was used.

| Project name | Production URL | Default Vercel URL |
| --- | --- | --- |
| dusko-management | https://admin.dusko.io.vn | https://dusko-management.vercel.app |
| dusko-staff | https://staff.dusko.io.vn | https://dusko-staff.vercel.app |
| dusko-customer | https://order.dusko.io.vn | https://dusko-customer.vercel.app |

Tenten CNAME and ownership TXT records were added without changing the API,
apex, www or existing Google verification records. Vercel reports Valid
Configuration for all three custom domains; their HTTPS pages render.
EC2 allows these three origins and the three exact default Vercel origins.
HTTPS API /ready returns READY and CORS preflight checks return 204.
HTML, JS/CSS, staff sw.js and customer /t/:token SPA fallback return 200.
Authenticated login, ordering and realtime flows still need valid test accounts
and a real table QR; loading the SPA fallback alone does not verify a QR session.

## Project configuration

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
