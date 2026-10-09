# Frontend Architecture

## 1. Purpose

This document describes the current frontend architecture of Dusko Restaurant FE and the confirmed architectural direction for future work.

Current State:
- The frontend is a vanilla JavaScript + Vite codebase.
- UI is rendered with JavaScript template strings.
- Styling uses global CSS files.
- The project has an implicit design system, not a fully centralized component library.

This is not a migration plan. Future agents must preserve existing application boundaries and reuse existing patterns within their current ownership boundary.

## 2. Application Contexts

### Root/Admin

Current State:
- Root: `Dusko_Restaurant_FE/`
- Entry point: `src/main.js`
- Purpose: restaurant operating system for admin, manager, cashier, kitchen, inventory, catalog, forecast, and analytics workflows.
- Main CSS: `src/style.css`, `src/theme.css`, `src/readability.css`, plus feature CSS.
- Own patterns: root shell, sidebar, topbar, `.btn`, `.panel`, `.metric-grid`, `.badge`, root-local helpers.

### Customer

Current State:
- Root: `customer-web/`
- Entry point: `customer-web/src/main.js`
- Purpose: public QR ordering experience for guests at a table.
- Main CSS: `customer-web/src/style.css`
- Shared imports: `../../src/font.css`, `../../src/confirm-dialog.js`, `../../src/pos-theme.css`
- Own patterns: `.dish`, customer cart, receipt, service request buttons, customer quantity stepper.

### Staff

Current State:
- Root: `staff-app/`
- Entry point: `staff-app/src/main.js`
- Purpose: staff PWA for table service.
- Main CSS: `staff-app/src/style.css`
- Shared imports: `../../src/service-workspace.js`, `../../src/readability.css`, `../../src/font.css`, `../../src/pos-theme.css`
- Own patterns: staff login shell, staff header, staff branch selector.
- Shared workflow: `createServiceWorkspace()`.

## 3. Application Boundaries

Current State:
- The repository contains three frontend contexts: root/admin, customer, and staff.
- Similar UI does not automatically mean shared architecture.
- Shared code exists where reuse is already demonstrated, especially `confirmDialog()`, `productPhoto()`, and `createServiceWorkspace()`.

Confirmed Decision:
- Preserve existing application boundaries.
- Reuse does not mean merge.
- Do not standardize patterns merely because they look visually similar.

## 4. Shared vs Application-Specific Responsibilities

Shared responsibilities:
- Confirmation dialog: `src/confirm-dialog.js`
- Product image normalization/fallback: `src/product-photo.js`
- Staff/table service workflow: `src/service-workspace.js`
- Active runtime theme layer: `src/pos-theme.css`
- Supporting visual reference: `src/readability.css`
- Approved visual direction: Warm Modern Restaurant
- Approved font direction: Nunito
- Font reference: `src/font.css`

Application-specific responsibilities:
- Root page rendering and root helpers remain in `src/main.js`.
- Customer `.dish` and customer cart remain customer-specific.
- Staff shell remains staff-specific.
- Service workspace `.sw-*` patterns are shared between root and staff only.

## 5. Styling Architecture

### pos-theme.css

Current State:
- `src/pos-theme.css` is imported by Root/Admin, Customer, and Staff.
- It is the final theme layer in each entry point and overrides duplicated declarations from earlier CSS layers.
- It currently defines the POS blue visual direction, including runtime custom properties, controls, shells, workspace styles, and responsive rules.
- The approved refactor target is the Warm Modern Restaurant palette; implementation must replace the current blue values through this runtime layer.

Confirmed Decision:
- `pos-theme.css` is the runtime visual source of truth for this refactor.
- The target foundation is shared across all three applications: warm canvas, espresso ink, terracotta primary, sage accent, and Nunito typography.
- New shared visual tokens or overrides must be added here when they are intended to affect all applications.
- Changes must be checked in all three application contexts.

### readability.css

Current State:
- `src/readability.css` defines a newer neutral visual direction and partial CSS variables such as `--surface`, `--canvas`, `--ink`, `--muted`, `--line`, and `--radius`.
- It is imported by root and staff contexts before `pos-theme.css`.

Confirmed Decision:
- `readability.css` is a supporting/reference layer, not the final runtime theme authority.
- Declarations duplicated by `pos-theme.css` do not control the final runtime appearance.
- Do not add a visual change only to this file when the change is expected to be visible in the active POS theme.

Future Direction:
- Before adding new colors, typography, spacing, or visual primitives, inspect `readability.css` first.

### style.css

Current State:
- `src/style.css` contains older/root layout, shell, panel, button, metric, table, order, and form styles.
- It remains part of the current working implementation.

Confirmed Decision:
- Do not remove or rewrite `style.css` merely to align with `readability.css`.

### theme.css

Current State:
- `src/theme.css` contains root visual overrides, root responsive rules, kitchen/KDS styles, and legacy order tooling styles.

Confirmed Decision:
- `theme.css` remains.
- Do not move or migrate existing working styles as part of normal feature work.

## 6. Component / Helper Architecture

Current State:
- The project does not use framework components.
- Component-like behavior is implemented by helper functions and template-string renderers.

Important helpers:
- Root local helpers in `src/main.js`: `btn`, `field`, `title`, `table`, `empty`, `badge`
- Shared dialog: `confirmDialog()` in `src/confirm-dialog.js`
- Shared service workflow: `createServiceWorkspace()` in `src/service-workspace.js`
- Shared image helper: `productPhoto()` in `src/product-photo.js`
- Root feature renderers: `locationsHtml()`, `catalogHtml()`, `kitchenControls()`, `kitchenPanel()`

Confirmed Decision:
- Root helpers remain local for now.
- Do not extract, export, or replace them without explicit architectural approval.

## 7. Layout Architecture

Current State:
- Root layout uses `.layout`, `.sidebar`, `.main`, `.topbar`, `.content`, `.page-head`, `.two-col`, `.metric-grid`, and `.table-scroll`.
- Customer layout uses `.customer-layout`, `.menu`, `.dish`, `.cart`, and `.receipt`.
- Service workspace layout uses `.service-workspace`, `.sw-heading`, `.sw-filters`, `.sw-tables`, `.sw-tabs`, `.sw-content`, `.sw-menu-layout`, and `.sw-cart`.
- Kitchen layout uses `.kitchen-controls`, `.kitchen-statusline`, `.kitchen-grid`, and `.kitchen-ticket`.

Future Direction:
- Prefer existing layout classes within the relevant application context before creating new layout patterns.

## 8. Responsive Architecture

Current State:
- Existing styles contain `700px` and `1050px` rules in root/shared layers.
- The active `pos-theme.css` layer adds the effective POS transitions at `760px` and `1100px`.
- Customer has `540px` and `1050px`.
- Staff has `370px`, `500px`, and `700px`.

Confirmed Decision:
- For new shared visual work, reuse the active POS breakpoints `760px` and `1100px`.
- Existing `700px` and `1050px` rules remain valid legacy/root behavior until individually verified.
- Customer `540px` and Staff `370px`/`500px` remain valid application-specific exceptions.
- Do not introduce a new breakpoint without a concrete responsive requirement.

## 9. Status Semantics

Current State:
- Backend/order statuses are displayed in multiple places:
  - Root badges via `badge()` in `src/main.js`
  - Service workspace status text in `src/service-workspace.js`
  - Customer tracked order status in `customer-web/src/main.js`
  - Kitchen/KDS state in `src/kitchen-view.js`

Confirmed Decision:
- Backend status semantics should eventually have centralized semantic mapping.
- The first standardization target is semantic consistency, not one shared visual status component.

Future Direction:
- Centralize backend status, semantic meaning, workflow meaning, and user-facing labels before attempting visual unification.

## 10. Confirmed Architectural Decisions

### Decision 1

`pos-theme.css` is the active final theme layer for Root/Admin, Customer, and Staff. `readability.css` remains a supporting reference layer. The approved target is Warm Modern Restaurant, not the current POS-blue values.

### Decision 2

Root `.btn` and service-workspace `.sw-button` remain intentionally independent.

### Decision 3

Customer `.dish` remains customer-specific. Do not force customer product cards into root or staff UI.

### Decision 4

Backend status semantics should eventually be centralized, but visual presentation may remain application-specific.

### Decision 5

The active POS theme uses `760px` and `1100px` responsive transitions. Existing `700px`, `1050px`, `540px`, `370px`, and `500px` rules remain application-specific behavior and must not be removed without evidence. New responsive work must first reuse the breakpoint of the owning runtime layer.

### Decision 6

Root helpers `btn`, `field`, `title`, `table`, `empty`, and `badge` remain local. Do not extract or export them unless explicitly instructed.

### Decision 7

Initial enforcement should be lightweight. Do not introduce aggressive token linting or large design-system enforcement before token standardization.

## 11. Known Constraints

- Do not introduce React, Vue, TypeScript, Tailwind, or a new UI framework as part of normal frontend work.
- Do not change application boundaries.
- Do not broadly refactor global CSS during unrelated feature work.
- Do not create universal UI abstractions without explicit architectural approval.
- Do not change known-good behavior merely for consistency.
- Do not add visual values to `readability.css` alone when `pos-theme.css` is the active runtime layer.
- Do not change `pos-theme.css` without checking Root, Customer, and Staff.
- Do not call a screen complete without loading, empty, error, disabled, and responsive states.

## 12. Known Architectural Risks

Current State:
- UI patterns are discoverable only by reading source files.
- CSS is global and layered.
- Several patterns look similar but are intentionally owned by different contexts.
- Root helpers are local and not documented by code-level registry.
- Automated enforcement is currently lightweight or absent.

Risk:
- Future AI agents may duplicate dialogs, buttons, product cards, breakpoints, or visual values if they do not search first.

## 13. What Must NOT Be Changed Automatically

Future agents must not automatically:
- Merge `.btn` and `.sw-button`.
- Replace `.btn` with `.sw-button`.
- Replace `.sw-button` with `.btn`.
- Copy customer `.dish` into root or staff.
- Create a universal Button component.
- Create a universal ProductCard component.
- Extract root helpers.
- Migrate all CSS to `readability.css`.
- Introduce broad design-token enforcement.
- Add new breakpoints without a requirement.
- Refactor unrelated code.
- Change application boundaries.

## 14. Future Evolution Direction

Future Direction:
- Improve documentation and discovery before refactoring.
- Prefer existing patterns within their ownership boundary.
- Centralize cross-application semantics where reuse is already demonstrated.
- Consider status semantic mapping before visual status unification.
- Add lightweight checks or review checklist items before introducing strict linting.

Core Principle:

Preserve existing application boundaries. Prefer existing patterns and helpers within their ownership boundary. Centralize only cross-application semantics or primitives where reuse is already demonstrated. Do not standardize merely because two UI patterns look similar.
