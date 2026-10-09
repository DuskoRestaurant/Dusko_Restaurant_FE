# Frontend UI Patterns

## 1. How to Use This Registry

Use this registry before creating frontend UI.

Discovery workflow:

```text
1. Identify application/context
2. Identify feature/workflow
3. Search for existing UI/helper/pattern
4. Check ownership boundary
5. Check readability.css for visual direction
6. Reuse existing pattern if appropriate
7. Only then consider creating something new
8. Check whether the new pattern duplicates an existing one
9. Check responsive behavior
10. Self-review against frontend governance
```

This registry documents current patterns. It does not create new components.

## 2. Application Ownership

Pattern: Root/Admin application
- Purpose: admin, manager, cashier, kitchen, inventory, forecast, analytics, catalog.
- Owner: root/admin.
- Application: root.
- File: `src/main.js`, `src/style.css`, `src/theme.css`, `src/readability.css`.
- Reuse boundary: root UI only unless a helper is already shared.

Pattern: Customer application
- Purpose: public QR ordering.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, `customer-web/src/style.css`.
- Reuse boundary: customer UI only.

Pattern: Staff application
- Purpose: staff PWA shell.
- Owner: staff.
- Application: staff-app.
- File: `staff-app/src/main.js`, `staff-app/src/style.css`.
- Reuse boundary: staff shell only.

Pattern: Service workspace
- Purpose: shared table-service workflow.
- Owner: shared root + staff.
- Application: root and staff.
- File: `src/service-workspace.js`, `src/service-workspace.css`, `src/readability.css`.
- Reuse boundary: service workspace workflow only.

## 3. Shared Primitives

Pattern: `confirmDialog()`
- Purpose: confirmation dialog.
- Owner: shared/root.
- Application: root, customer, service workspace consumers.
- File: `src/confirm-dialog.js`, `src/confirm-dialog.css`.
- Selector/helper: `confirmDialog()`, `.app-confirm`, `.app-confirm__button`.
- Consumers: root actions, customer order submit confirmation, service workspace confirmations.
- Reuse boundary: cross-application where a simple confirmation dialog satisfies the requirement.

Do:
- Inspect and reuse before creating another confirmation dialog.

Do not:
- Create a second confirmation-dialog implementation without a documented reason.

Pattern: `productPhoto()`
- Purpose: render product image or safe fallback.
- Owner: shared/root.
- Application: root and service workspace.
- File: `src/product-photo.js`.
- Selector/helper: `productPhoto(product, className = 'product-photo')`.
- Consumers: root product/kitchen/catalog flows, service workspace through shared code.
- Reuse boundary: product image rendering where URL validation and fallback are needed.

Do:
- Reuse for root/service product image rendering where appropriate.

Do not:
- Treat it as a full product card component.

Pattern: `font.css`
- Purpose: shared font reference.
- Owner: shared.
- Application: root, customer, staff.
- File: `src/font.css`.
- Selector/helper: `--font-ui`.
- Reuse boundary: typography family reference.

## 4. Root/Admin Patterns

Pattern: Root page shell
- Purpose: root app frame with sidebar, topbar, and page content.
- Owner: root.
- Application: root.
- File: `src/main.js`, `src/style.css`, `src/readability.css`.
- Selector/helper: `.layout`, `.sidebar`, `.main`, `.topbar`, `.content`.
- Consumers: all root pages.
- Reuse boundary: root application shell.

Pattern: Root page heading
- Purpose: consistent root page title and tools.
- Owner: root.
- Application: root.
- File: `src/main.js`.
- Selector/helper: `title()`, `.page-head`, `.head-tools`, `.eyebrow`.
- Consumers: root pages.
- Reuse boundary: root page rendering.

Pattern: Root panels
- Purpose: main root content surface.
- Owner: root.
- Application: root.
- File: `src/style.css`, `src/theme.css`, `src/readability.css`.
- Selector/helper: `.panel`, `.panel-head`.
- Consumers: dashboard, inventory, catalog, locations, analytics, forecast.
- Reuse boundary: root sections.

Pattern: Root tables
- Purpose: table wrapper and simple data tables.
- Owner: root.
- Application: root.
- File: `src/main.js`.
- Selector/helper: `table()`, `row()`, `.table-scroll`.
- Consumers: root data views.
- Reuse boundary: root app only.

## 5. Customer Patterns

Pattern: Customer product card
- Purpose: public QR menu item.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, `customer-web/src/style.css`.
- Selector/helper: `.dish`, `.photo`, `.dish-body`, `.stepper`.
- Consumers: customer menu.
- Reuse boundary: customer QR ordering only.

Do:
- Keep customer `.dish` customer-specific.

Do not:
- Copy customer `.dish` into admin or staff UI.
- Create a universal ProductCard from it without approval.

Pattern: Customer cart
- Purpose: selected items, notes, total, submit.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, `customer-web/src/style.css`.
- Selector/helper: `cartHtml()`, `.cart`, `.cart-item`, `.total`, `.primary`.
- Consumers: customer QR ordering flow.
- Reuse boundary: customer app.

Pattern: Customer service actions
- Purpose: call staff or request bill.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, `customer-web/src/style.css`.
- Selector/helper: `serviceActions()`, `.service-actions`, `.service-hint`.
- Consumers: customer page.
- Reuse boundary: customer app.

## 6. Staff Patterns

Pattern: Staff login shell
- Purpose: staff authentication UI.
- Owner: staff.
- Application: staff-app.
- File: `staff-app/src/main.js`, `staff-app/src/style.css`.
- Selector/helper: `renderLogin()`, `.login`, `.primary`.
- Consumers: staff app before authentication.
- Reuse boundary: staff shell.

Pattern: Staff header
- Purpose: authenticated staff app frame.
- Owner: staff.
- Application: staff-app.
- File: `staff-app/src/main.js`, `staff-app/src/style.css`.
- Selector/helper: `.staff-app-header`, `.staff-identity`, `.staff-branch`.
- Consumers: staff app.
- Reuse boundary: staff shell.

## 7. Service Workspace Patterns

Pattern: `createServiceWorkspace()`
- Purpose: shared table workflow for cashier desktop and staff app.
- Owner: shared root + staff.
- Application: root and staff.
- File: `src/service-workspace.js`, `src/service-workspace.css`, `src/readability.css`.
- Selector/helper: `createServiceWorkspace()`, `.service-workspace`, `.sw-*`.
- Consumers: root orders page, staff app.
- Reuse boundary: service workflow only.

Do:
- Inspect both root and staff consumers before changing `.sw-*` behavior or styles.

Do not:
- Treat `.sw-*` styles as root-only.

Pattern: Service workspace button
- Purpose: workflow action button.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`.
- Selector/helper: local `button()` helper, `.sw-button`, `.sw-primary`, `data-sw`.
- Consumers: service workspace.
- Reuse boundary: service workspace.

Do not:
- Replace `.sw-button` with `.btn`.

Pattern: Service table card
- Purpose: table selection and attention state.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`, CSS.
- Selector/helper: `.sw-table`, `.sw-attention`.
- Consumers: service workspace table list.
- Reuse boundary: service workspace.

## 8. Layout Patterns

Pattern: Two-column root layout
- Purpose: root page section layout.
- Owner: root.
- Application: root.
- File: root CSS.
- Selector/helper: `.two-col`, `.order-layout`, `.catalog-layout`.
- Reuse boundary: root pages.

Pattern: Customer content/cart layout
- Purpose: menu beside sticky cart on desktop.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/style.css`.
- Selector/helper: `.customer-layout`.
- Reuse boundary: customer app.

Pattern: Service workspace layout
- Purpose: table, tabs, products, cart, and workflow panels.
- Owner: service workspace.
- Application: root and staff.
- File: service workspace CSS and `readability.css`.
- Selector/helper: `.sw-menu-layout`, `.sw-tables`, `.sw-tabs`, `.sw-content`, `.sw-cart`.
- Reuse boundary: service workspace.

## 9. Form Patterns

Pattern: Root field
- Purpose: root form label and control wrapper.
- Owner: root.
- Application: root.
- File: `src/main.js`.
- Selector/helper: `field()`, `.field`.
- Reuse boundary: root app.

Pattern: Management form
- Purpose: modal management forms.
- Owner: root.
- Application: root.
- File: `src/management.css`, `src/main.js`.
- Selector/helper: `.manage-form`, `.check-field`, `.form-error`.
- Reuse boundary: root management workflows.

Pattern: Service workspace input
- Purpose: service search, category filter, notes, payment select.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`, CSS.
- Selector/helper: `[data-sw-input]`, `.sw-filters`.
- Reuse boundary: service workspace.

Pattern: Customer input
- Purpose: search, category select, cart note.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, CSS.
- Selector/helper: `#search`, `#category`, `[data-note]`.
- Reuse boundary: customer app.

## 10. Button Patterns

Pattern: Root `.btn`
- Purpose: root page actions.
- Owner: root.
- Application: root.
- File: `src/main.js`, root CSS.
- Selector/helper: `btn()`, `.btn`, `.btn.secondary`, `.btn.small`, `.btn.text`.
- Reuse boundary: root UI.

Do:
- Use for root page UI.

Do not:
- Replace `.sw-button`.

Pattern: Service `.sw-button`
- Purpose: service workspace actions.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`, CSS.
- Selector/helper: `.sw-button`, `.sw-primary`.
- Reuse boundary: service workspace.

Do:
- Use inside service workspace.

Do not:
- Replace with `.btn`.

Pattern: Customer `.primary`
- Purpose: customer submit button.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/style.css`.
- Selector/helper: `.primary`.
- Reuse boundary: customer app.

## 11. Dialog Patterns

Pattern: Confirmation dialog
- Purpose: ask user to confirm an action.
- Owner: shared.
- Application: root/customer/service workspace.
- File: `src/confirm-dialog.js`, `src/confirm-dialog.css`.
- Selector/helper: `confirmDialog()`.
- Reuse boundary: simple confirmation flows.

Do:
- Reuse when it satisfies the requirement.

Do not:
- Create duplicate confirmation dialogs.

Pattern: Root custom modal/form
- Purpose: login and management forms.
- Owner: root.
- Application: root.
- File: `src/main.js`, root CSS.
- Selector/helper: `.modal-wrap`, `.modal`, `.modal-close`.
- Reuse boundary: root-specific modal/form flows.

## 12. Product / Image Patterns

Pattern: Product image helper
- Purpose: render safe product image/fallback.
- Owner: shared/root.
- Application: root/service.
- File: `src/product-photo.js`.
- Selector/helper: `productPhoto()`, `.product-photo`.
- Reuse boundary: product images, not full cards.

Pattern: Customer dish
- Purpose: public product selection card.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`, CSS.
- Selector/helper: `.dish`.
- Reuse boundary: customer app only.

Pattern: Catalog product row
- Purpose: admin product management.
- Owner: root.
- Application: root.
- File: `src/management.js`, `src/readability.css`.
- Selector/helper: `.product-row`, `.catalog-product-info`, `.catalog-status`.
- Reuse boundary: root catalog.

Pattern: Service product row
- Purpose: staff/cashier add item to table.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`.
- Selector/helper: `.sw-product`, `.sw-photo`.
- Reuse boundary: service workspace.

## 13. Status Patterns

Pattern: Root badge
- Purpose: compact root status display.
- Owner: root.
- Application: root.
- File: `src/main.js`, CSS.
- Selector/helper: `badge()`, `.badge`, `.paid`, `.completed`, `.pending`, `.scheduled`, `.warning`, `.cooking`.
- Reuse boundary: root UI.

Pattern: Service status text
- Purpose: table/order item workflow status.
- Owner: service workspace.
- Application: root and staff.
- File: `src/service-workspace.js`.
- Selector/helper: `statusText()`.
- Reuse boundary: service workspace.

Pattern: Customer tracked status
- Purpose: customer-facing order status.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/main.js`.
- Selector/helper: `updateStatus()`.
- Reuse boundary: customer app.

Future Direction:
- Centralize semantic mapping before visual unification.

## 14. Responsive Patterns

Pattern: Root/shared breakpoints
- Purpose: root mobile/tablet behavior.
- Owner: root/shared.
- Application: root.
- File: root CSS.
- Selector/helper: `@media(max-width:700px)`, `@media(max-width:1050px)`.
- Reuse boundary: root/shared new responsive behavior.

Pattern: Customer breakpoint
- Purpose: customer mobile menu/card behavior.
- Owner: customer.
- Application: customer-web.
- File: `customer-web/src/style.css`.
- Selector/helper: `@media(max-width:540px)`.
- Reuse boundary: customer app.

Pattern: Staff breakpoints
- Purpose: staff shell narrow-device behavior.
- Owner: staff.
- Application: staff-app.
- File: `staff-app/src/style.css`.
- Selector/helper: `@media(max-width:370px)`, `@media(max-width:500px)`.
- Reuse boundary: staff app.

## 15. CSS Namespace Conventions

Stable namespaces:
- `.sw-*`: service workspace.
- `.app-confirm__*`: confirmation dialog.
- `.catalog-*`: root catalog.
- `.manage-*`: root management.
- `.kitchen-*`, `.kt-*`, `.kds-*`: kitchen/KDS.
- `.staff-*`: staff shell.

Generic/global selectors exist:
- `body`, `button`, `input`, `select`, `header`, `main`, `section`, `table`.

Do:
- Keep namespaced CSS within its owner context.

Do not:
- Add broad generic selectors without checking cross-application impact.

## 16. Reuse Rules

Do:
- Reuse existing patterns within the relevant owner context.
- Reuse shared primitives where reuse is already demonstrated.
- Inspect `readability.css` before introducing new visual values.
- Check app-specific CSS near the feature being changed.

Do not:
- Merge patterns merely because they look similar.
- Introduce universal UI abstractions without approval.
- Duplicate existing dialogs, helpers, breakpoints, or product UI patterns.

## 17. Do Not Merge These Patterns

Do not merge:
- `.btn` and `.sw-button`
- Customer `.dish` and root/staff product UI
- Customer cart and service workspace cart
- Root badge visual component and customer/service status presentation
- Root local helpers and shared design-system helpers

Reason:
- These patterns have different ownership, workflow, or application context.

## 18. Pattern Discovery Checklist

Before creating UI, verify:

```text
[ ] Correct application context identified
[ ] Relevant JS template/helper searched
[ ] Relevant CSS searched
[ ] Shared modules checked
[ ] readability.css inspected for visual direction
[ ] Existing helper reuse considered
[ ] Ownership boundary checked
[ ] Responsive behavior checked
[ ] Cross-application impact checked
[ ] No duplicate pattern introduced
```

## 19. Screen and State Contract

Every screen refactor or new screen must document and preserve the following contract before implementation:

| Contract item | Required information |
|---|---|
| Application context | Root/Admin, Customer, Staff, or shared Service Workspace |
| Owner | The file/module and stylesheet that own the screen |
| Layout | Existing shell and layout patterns used |
| Data states | Loading, success, empty, error, unauthorized/forbidden |
| Interaction states | Busy, disabled, validation error, confirmation, success feedback |
| Responsive states | Active breakpoint(s), stacking/collapse behavior, overflow behavior |
| Accessibility | Labels, heading order, keyboard focus, dialog semantics, live feedback |
| Validation | Build plus manual or screenshot evidence for every affected app |

The happy path alone is not sufficient evidence that a screen is complete.

## 20. Runtime Theme Contract

- `src/pos-theme.css` is the final runtime theme layer for Root/Admin, Customer, and Staff.
- `src/readability.css` is a supporting/reference layer imported before the POS theme in Root and Staff.
- Shared visual changes belong in `pos-theme.css` when they must affect all applications.
- Application-specific differences remain in the owning stylesheet and must not be merged only for visual similarity.
- The active POS responsive transitions are `760px` and `1100px`; existing application-specific breakpoints remain valid where their behavior is intentional.

Approved visual foundation:

- Direction: Warm Modern Restaurant.
- Font: Nunito.
- Palette: warm canvas `#FBF7F2`, white surface `#FFFFFF`, espresso ink `#3B2923`, muted `#7C6D64`, line `#E8DED5`, terracotta primary `#C85A3F`, dark primary `#9F3F2D`, sage accent `#71856A`, soft sage `#E7EEE3`.
- Semantic colors: warning `#C58A32`, danger `#B84A45`, success `#4F8060`.
- Spacing: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`.
- Radius: `10px` controls, `16px` cards, `999px` pills.
- Shadows: subtle and reserved for elevated cards.

Before changing a pattern, identify both its ownership and its runtime cascade position.
